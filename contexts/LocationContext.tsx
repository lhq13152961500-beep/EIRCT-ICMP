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

async function fetchIpLocation(): Promise<{ lat: number; lng: number; city: string } | null> {
  const apis = [
    {
      url: "https://ipapi.co/json/",
      parse: (d: any) => ({ lat: d.latitude, lng: d.longitude, city: d.city || d.region || "未知位置" }),
    },
    {
      url: "http://ip-api.com/json/?lang=zh-CN&fields=lat,lon,city,regionName,status",
      parse: (d: any) => d.status === "success" ? ({ lat: d.lat, lng: d.lon, city: d.city || d.regionName || "未知位置" }) : null,
    },
  ];

  for (const api of apis) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(api.url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const result = api.parse(data);
      if (result && typeof result.lat === "number" && typeof result.lng === "number") {
        console.log("[loc] IP geolocation success:", result.city);
        return result;
      }
    } catch (e) {
      console.log("[loc] IP API failed:", api.url, e);
    }
  }
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh&zoom=12`,
      { headers: { "User-Agent": "guanyou-app/1.0" } },
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address ?? {};
      const parts = [
        addr.city || addr.town || addr.county,
        addr.state || addr.province,
      ].filter(Boolean);
      if (parts.length > 0) return parts[0];
      return data.display_name?.split(",")[0] || "当前位置";
    }
  } catch {}

  try {
    if (Platform.OS !== "web") {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        return r.city || r.district || r.name || "当前位置";
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

    const updateWithName = (lat: number, lng: number, name: string, accuracy?: number) => {
      if (!mounted) return;
      gotFix = true;
      setIsLocating(false);
      setLocationStatus({ state: "located", lat, lng, locationName: name, accuracy });
    };

    const updateWithGeocode = async (lat: number, lng: number, accuracy?: number) => {
      if (!mounted) return;
      gotFix = true;
      setIsLocating(false);
      setLocationStatus({ state: "located", lat, lng, locationName: "正在解析地址…", accuracy });
      const name = await reverseGeocode(lat, lng);
      if (mounted) {
        setLocationStatus({ state: "located", lat, lng, locationName: name, accuracy });
      }
    };

    (async () => {
      console.log("[loc] Step 1: trying IP geolocation...");
      const ipLoc = await fetchIpLocation();
      if (ipLoc && mounted && !gotFix) {
        updateWithName(ipLoc.lat, ipLoc.lng, ipLoc.city);
      }

      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          console.log("[loc] Step 2: trying browser geolocation...");
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (mounted) updateWithGeocode(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
            },
            () => {},
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
          );
          webWatchId = navigator.geolocation.watchPosition(
            (pos) => {
              if (mounted) updateWithGeocode(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
            },
            () => {},
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
          );
        }
      } else {
        console.log("[loc] Step 2: requesting device GPS permission...");
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (!mounted) return;
          console.log("[loc] GPS permission:", status);
          if (status === "granted") {
            console.log("[loc] Step 3: starting GPS watch...");
            locationSubRef.current?.remove();
            Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Low,
                timeInterval: 5000,
                distanceInterval: 10,
                mayShowUserSettingsDialog: true,
              },
              (l) => {
                console.log("[loc] GPS watch fired ±", l.coords.accuracy?.toFixed(0), "m");
                if (mounted) updateWithGeocode(l.coords.latitude, l.coords.longitude, l.coords.accuracy ?? undefined);
              },
            ).then((sub) => {
              if (mounted) {
                locationSubRef.current = sub;
                setWatchActive(true);
                console.log("[loc] GPS watch subscribed");
              } else {
                sub.remove();
              }
            }).catch((e) => console.warn("[loc] GPS watch failed:", e));

            try {
              const pos = await withTimeout(
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
                10000,
              );
              if (mounted) {
                console.log("[loc] GPS one-shot ±", pos.coords.accuracy?.toFixed(0), "m");
                updateWithGeocode(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
              }
            } catch (e) {
              console.log("[loc] GPS one-shot failed:", e);
            }
          } else if (!gotFix) {
            setLocationStatus({ state: "denied" });
            setIsLocating(false);
          }
        } catch (e) {
          console.warn("[loc] GPS permission error:", e);
        }
      }

      setTimeout(() => {
        if (mounted && !gotFix) {
          console.log("[loc] final timeout - no fix");
          setIsLocating(false);
        }
      }, 20000);
    })().catch((e) => console.warn("[loc] error:", e));

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
