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
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        if (status !== "granted") {
          setIsLocating(false);
          setLocationStatus({ state: "denied" });
          return;
        }

        try {
          const cached = await Location.getLastKnownPositionAsync({ maxAge: 60 * 60 * 1000 });
          if (cached && mounted && !gotFix) {
            update(cached.coords);
          }
        } catch {}

        locationSubRef.current?.remove();
        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
            mayShowUserSettingsDialog: true,
          },
          (l) => {
            if (mounted) update(l.coords);
          },
        ).then((sub) => {
          if (mounted) {
            locationSubRef.current = sub;
            setWatchActive(true);
          } else {
            sub.remove();
          }
        }).catch((e) => console.warn("[loc] watch failed:", e));

        try {
          const pos = await withTimeout(
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            15000,
          );
          if (mounted) update(pos.coords);
        } catch {}

        setTimeout(() => {
          if (mounted && !gotFix) setIsLocating(false);
        }, 20000);
      })().catch(() => {});
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
