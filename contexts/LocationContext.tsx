import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";

export type LocationStatus =
  | { state: "none" }
  | { state: "denied" }
  | { state: "located"; lat: number; lng: number; locationName: string; accuracy?: number };

type LocationContextType = {
  locationStatus: LocationStatus;
  isLocating: boolean;
  watchActive: boolean;
  retry: () => void;
  overrideLocation: (lat: number, lng: number, name: string) => void;
};

const LocationContext = createContext<LocationContextType>({
  locationStatus: { state: "none" },
  isLocating: true,
  watchActive: false,
  retry: () => {},
  overrideLocation: () => {},
});

export function useLocation() {
  return useContext(LocationContext);
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    if (Platform.OS !== "web") {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.district, r.city].filter(Boolean);
        return parts.slice(0, 2).join(" · ") || "当前位置";
      }
    } else {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        return r.city || r.region || r.district || r.name || "当前位置";
      }
    }
  } catch {}
  return "当前位置";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timerId = setTimeout(() => reject(new Error(`${ms}ms timeout`)), ms);
    promise.then(
      (v) => { clearTimeout(timerId); resolve(v); },
      (e) => { clearTimeout(timerId); reject(e); },
    );
  });
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [locationStatus, setLocationStatus] = useState<LocationStatus>({ state: "none" });
  const [isLocating, setIsLocating] = useState(true);
  const [watchActive, setWatchActive] = useState(false);
  const [trigger, setTrigger] = useState(0);

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const lastGeocodedRef = useRef<{ lat: number; lng: number } | null>(null);

  const retry = useCallback(() => setTrigger((n) => n + 1), []);

  const overrideLocation = useCallback((lat: number, lng: number, name: string) => {
    setLocationStatus({ state: "located", lat, lng, locationName: name });
    setIsLocating(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    let gotFix = false;
    let webWatchId: number | null = null;

    setIsLocating(true);
    setWatchActive(false);
    setLocationStatus({ state: "none" });
    lastGeocodedRef.current = null;

    const update = ({ latitude, longitude, accuracy }: { latitude: number; longitude: number; accuracy?: number | null }) => {
      if (!mounted) return;
      gotFix = true;
      setIsLocating(false);

      const last = lastGeocodedRef.current;
      const shouldGeocode = !last || (() => {
        const R = 6371000, toR = (v: number) => (v * Math.PI) / 180;
        const dLat = toR(latitude - last.lat), dLon = toR(longitude - last.lng);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(last.lat)) * Math.cos(toR(latitude)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) > 50;
      })();

      setLocationStatus((prev) => {
        const prevName = prev.state === "located" ? prev.locationName : "正在解析地址…";
        return { state: "located", lat: latitude, lng: longitude, locationName: shouldGeocode ? "正在解析地址…" : prevName, accuracy: accuracy ?? undefined };
      });

      if (shouldGeocode) {
        lastGeocodedRef.current = { lat: latitude, lng: longitude };
        reverseGeocode(latitude, longitude).then((name) => {
          if (mounted) {
            setLocationStatus({ state: "located", lat: latitude, lng: longitude, locationName: name, accuracy: accuracy ?? undefined });
          }
        });
      }
    };

    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { if (mounted) update({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }); },
          () => { if (mounted) setIsLocating(false); },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
        );
        webWatchId = navigator.geolocation.watchPosition(
          (pos) => { if (mounted) update({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }); },
          () => {},
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
        );
      } else {
        setIsLocating(false);
      }
    } else {
      (async () => {
        console.log("[loc] requesting permissions...");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        console.log("[loc] permission:", status);
        if (status !== "granted") {
          setIsLocating(false);
          setLocationStatus({ state: "denied" });
          return;
        }

        console.log("[loc] trying cached position...");
        try {
          const cached = await withTimeout(
            Location.getLastKnownPositionAsync({ maxAge: 60 * 60 * 1000 }),
            3000,
          );
          if (cached && mounted && !gotFix) {
            console.log("[loc] cached position found ±", cached.coords.accuracy?.toFixed(0), "m");
            update(cached.coords);
          } else {
            console.log("[loc] no cached position available");
          }
        } catch (e) {
          console.log("[loc] cached position timeout/error:", e);
        }

        console.log("[loc] starting watch (Low accuracy)...");
        locationSubRef.current?.remove();
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Low,
            timeInterval: 3000,
            distanceInterval: 5,
            mayShowUserSettingsDialog: true,
          },
          (l) => {
            console.log("[loc] watch fired ±", l.coords.accuracy?.toFixed(0), "m");
            if (mounted) update(l.coords);
          },
        ).then((sub) => {
          if (mounted) {
            locationSubRef.current = sub;
            setWatchActive(true);
            console.log("[loc] watch subscribed OK");
          } else {
            sub.remove();
          }
        }).catch((e) => console.warn("[loc] watch failed:", e));

        console.log("[loc] trying Low accuracy one-shot...");
        try {
          const pos = await withTimeout(
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
            8000,
          );
          if (mounted) {
            console.log("[loc] Low fix ±", pos.coords.accuracy?.toFixed(0), "m");
            update(pos.coords);
          }
        } catch (e) {
          console.log("[loc] Low one-shot failed:", e);
        }

        if (!gotFix) {
          console.log("[loc] trying Balanced one-shot...");
          try {
            const pos = await withTimeout(
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
              12000,
            );
            if (mounted) {
              console.log("[loc] Balanced fix ±", pos.coords.accuracy?.toFixed(0), "m");
              update(pos.coords);
            }
          } catch (e) {
            console.log("[loc] Balanced one-shot failed:", e);
          }
        }

        setTimeout(() => {
          if (mounted && !gotFix) {
            console.log("[loc] 25s timeout - no fix obtained");
            setIsLocating(false);
          }
        }, 25000);
      })().catch((e) => console.warn("[loc] top-level error:", e));
    }

    return () => {
      mounted = false;
      if (webWatchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(webWatchId);
      }
      locationSubRef.current?.remove();
      locationSubRef.current = null;
    };
  }, [trigger]);

  return (
    <LocationContext.Provider value={{ locationStatus, isLocating, watchActive, retry, overrideLocation }}>
      {children}
    </LocationContext.Provider>
  );
}
