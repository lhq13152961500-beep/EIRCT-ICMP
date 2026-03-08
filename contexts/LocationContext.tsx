import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Platform, Alert, Linking } from "react-native";
import * as Location from "expo-location";

export type LocationStatus =
  | { state: "none" }
  | { state: "denied" }
  | { state: "located"; lat: number; lng: number; locationName: string; accuracy?: number; source: "ip" | "gps" | "manual" };

type LocationContextType = {
  locationStatus: LocationStatus;
  isLocating: boolean;
  watchActive: boolean;
  isGpsPrecise: boolean;
  retry: () => void;
  overrideLocation: (lat: number, lng: number, name: string) => void;
};

const LocationContext = createContext<LocationContextType>({
  locationStatus: { state: "none" },
  isLocating: true,
  watchActive: false,
  isGpsPrecise: false,
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
      console.log("[loc] IP API failed:", api.url);
    }
  }
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh&zoom=16`,
      { headers: { "User-Agent": "guanyou-app/1.0" }, signal: controller.signal },
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const addr = data.address ?? {};
      const detailed = addr.tourism ?? addr.amenity ?? addr.road ?? addr.village ?? addr.neighbourhood;
      const district = addr.suburb ?? addr.district ?? addr.town ?? addr.city ?? addr.county;
      const parts = [detailed, district].filter(Boolean);
      if (parts.length > 0) return parts.join(" · ");
      return data.display_name?.split(",")[0] || "当前位置";
    }
  } catch {}

  try {
    if (Platform.OS !== "web") {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.district, r.city].filter(Boolean);
        return parts.slice(0, 2).join(" · ") || "当前位置";
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
  const [isGpsPrecise, setIsGpsPrecise] = useState(false);
  const [trigger, setTrigger] = useState(0);

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);

  const retry = useCallback(() => setTrigger((n) => n + 1), []);

  const overrideLocation = useCallback((lat: number, lng: number, name: string) => {
    setLocationStatus({ state: "located", lat, lng, locationName: name, source: "manual" });
    setIsGpsPrecise(true);
    setIsLocating(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    let hasIpFix = false;
    let hasGpsFix = false;
    let webWatchId: number | null = null;

    setIsLocating(true);
    setWatchActive(false);
    setIsGpsPrecise(false);
    setLocationStatus({ state: "none" });

    const setIpLocation = (lat: number, lng: number, name: string) => {
      if (!mounted) return;
      hasIpFix = true;
      if (!hasGpsFix) {
        setIsLocating(false);
        setLocationStatus({ state: "located", lat, lng, locationName: name, source: "ip" });
      }
    };

    const setGpsLocation = async (lat: number, lng: number, accuracy?: number) => {
      if (!mounted) return;
      hasGpsFix = true;
      setIsGpsPrecise(true);
      setIsLocating(false);
      setLocationStatus({ state: "located", lat, lng, locationName: "正在解析地址…", accuracy, source: "gps" });
      const name = await reverseGeocode(lat, lng);
      if (mounted) {
        setLocationStatus({ state: "located", lat, lng, locationName: name, accuracy, source: "gps" });
      }
    };

    (async () => {
      console.log("[loc] Step 1: IP geolocation...");
      const ipLoc = await fetchIpLocation();
      if (ipLoc && mounted) {
        setIpLocation(ipLoc.lat, ipLoc.lng, ipLoc.city);
      }

      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          console.log("[loc] Step 2: browser geolocation...");
          navigator.geolocation.getCurrentPosition(
            (pos) => { if (mounted) setGpsLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined); },
            () => {},
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
          );
          webWatchId = navigator.geolocation.watchPosition(
            (pos) => { if (mounted) setGpsLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined); },
            () => {},
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          );
        }
      } else {
        console.log("[loc] Step 2: checking GPS service...");

        const gpsEnabled = await Location.hasServicesEnabledAsync();
        console.log("[loc] GPS service enabled:", gpsEnabled);

        if (!gpsEnabled) {
          console.log("[loc] GPS service is OFF - prompting user");
          if (mounted && !hasIpFix) setIsLocating(false);
          Alert.alert(
            "需要开启定位服务",
            "发布声音作品需要精确的GPS位置（100米范围），请在系统设置中开启定位/GPS服务",
            [
              { text: "去设置", onPress: () => Linking.openSettings() },
              { text: "稍后再说", style: "cancel" },
            ],
          );
          return;
        }

        console.log("[loc] Step 3: requesting permission...");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        console.log("[loc] permission:", status);

        if (status !== "granted") {
          if (!hasIpFix) {
            setLocationStatus({ state: "denied" });
            setIsLocating(false);
          }
          Alert.alert(
            "需要位置权限",
            "发布声音作品需要精确位置，请允许位置权限",
            [
              { text: "去设置", onPress: () => Linking.openSettings() },
              { text: "取消", style: "cancel" },
            ],
          );
          return;
        }

        console.log("[loc] Step 4: trying last known position...");
        try {
          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 5 * 60 * 1000,
            requiredAccuracy: 500,
          });
          if (lastKnown && mounted && !hasGpsFix) {
            console.log("[loc] Last known GPS ±", lastKnown.coords.accuracy?.toFixed(0), "m (cached)");
            setGpsLocation(lastKnown.coords.latitude, lastKnown.coords.longitude, lastKnown.coords.accuracy ?? undefined);
          } else {
            console.log("[loc] No recent cached position available");
          }
        } catch (e) {
          console.log("[loc] getLastKnownPositionAsync failed:", e);
        }

        console.log("[loc] Step 5: starting GPS watch + one-shot...");
        locationSubRef.current?.remove();

        Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 2000,
            distanceInterval: 3,
            mayShowUserSettingsDialog: true,
          },
          (l) => {
            console.log("[loc] GPS watch ±", l.coords.accuracy?.toFixed(0), "m");
            if (mounted) setGpsLocation(l.coords.latitude, l.coords.longitude, l.coords.accuracy ?? undefined);
          },
        ).then((sub) => {
          if (mounted) {
            locationSubRef.current = sub;
            setWatchActive(true);
            console.log("[loc] GPS watch OK");
          } else {
            sub.remove();
          }
        }).catch((e) => {
          console.warn("[loc] GPS watch failed:", e);
        });

        const accuracyLevels: { level: Location.Accuracy; name: string; timeout: number }[] = [
          { level: Location.Accuracy.High, name: "High", timeout: 30000 },
          { level: Location.Accuracy.Balanced, name: "Balanced", timeout: 20000 },
          { level: Location.Accuracy.Low, name: "Low", timeout: 15000 },
          { level: Location.Accuracy.Lowest, name: "Lowest", timeout: 10000 },
        ];

        let gotFix = false;
        for (const { level, name, timeout } of accuracyLevels) {
          if (gotFix || !mounted) break;
          try {
            console.log(`[loc] GPS one-shot (${name}, ${timeout / 1000}s)...`);
            const pos = await withTimeout(
              Location.getCurrentPositionAsync({ accuracy: level }),
              timeout,
            );
            if (mounted) {
              console.log(`[loc] GPS fix (${name}) ±`, pos.coords.accuracy?.toFixed(0), "m");
              setGpsLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
              gotFix = true;
            }
          } catch {
            console.log(`[loc] ${name} accuracy failed`);
          }
        }

        if (!gotFix && mounted) {
          console.log("[loc] all GPS one-shot attempts failed, watch still active");
          if (!hasIpFix && !hasGpsFix) setIsLocating(false);
        }
      }

      setTimeout(() => {
        if (mounted && !hasIpFix && !hasGpsFix) {
          console.log("[loc] final timeout");
          setIsLocating(false);
        }
      }, 25000);
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
    <LocationContext.Provider value={{ locationStatus, isLocating, watchActive, isGpsPrecise, retry, overrideLocation }}>
      {children}
    </LocationContext.Provider>
  );
}
