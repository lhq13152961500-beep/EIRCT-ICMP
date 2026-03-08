import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Platform, Alert, Linking } from "react-native";
import * as Location from "expo-location";
import { getApiUrl } from "@/lib/query-client";

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
  console.log("[loc] Starting IP Geolocation...");

  try {
    const baseUrl = getApiUrl();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(new URL("/api/geocode/ip", baseUrl).href, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data.city && data.lat != null && data.lng != null) {
        console.log("[loc] IP Geolocation Success (Amap):", data.city);
        return { lat: data.lat, lng: data.lng, city: data.city };
      }
    }
  } catch (e) {
    console.log("[loc] Amap IP API Failed:", e);
  }

  const fallbackApis = [
    {
      url: "https://ipapi.co/json/",
      parse: (d: any) => ({ lat: d.latitude, lng: d.longitude, city: d.city || d.region || "未知城市" }),
    },
    {
      url: "http://ip-api.com/json/?lang=zh-CN&fields=lat,lon,city,regionName,status",
      parse: (d: any) => d.status === "success" ? ({ lat: d.lat, lng: d.lon, city: d.city || d.regionName || "未知城市" }) : null,
    },
  ];

  for (const api of fallbackApis) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(api.url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const result = api.parse(data);
      if (result && typeof result.lat === "number" && typeof result.lng === "number") {
        console.log(`[loc] IP Geolocation Fallback Success:`, result.city);
        return result;
      }
    } catch (e) {
      console.log(`[loc] IP Fallback Failed (${api.url}):`, e);
    }
  }
  console.log("[loc] All IP Geolocation APIs failed.");
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const baseUrl = getApiUrl();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      new URL(`/api/geocode/reverse?lat=${lat}&lng=${lng}`, baseUrl).href,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data.name) {
        console.log("[loc] Reverse Geocoded (Amap):", data.name);
        return data.name;
      }
    }
  } catch (e) {
    console.warn("[loc] Amap Reverse Geocode Failed:", e);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh&zoom=16`,
      {
        headers: { "User-Agent": "GuanyouApp/1.0 (contact@guanyou.app)" },
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const addr = data.address ?? {};
      const detailed = addr.tourism ?? addr.amenity ?? addr.road ?? addr.village ?? addr.neighbourhood;
      const district = addr.suburb ?? addr.district ?? addr.town ?? addr.city ?? addr.county;
      const parts = [detailed, district].filter(Boolean);
      const name = parts.length > 0 ? parts.join(" · ") : (data.display_name?.split(",")[0] || "当前位置");
      console.log("[loc] Reverse Geocoded (OSM fallback):", name);
      return name;
    }
  } catch (e) {
    console.warn("[loc] OSM Reverse Geocode Failed:", e);
  }

  if (Platform.OS !== "web") {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.district, r.city].filter(Boolean);
        return parts.slice(0, 2).join(" · ") || "当前位置";
      }
    } catch (e) {
      console.warn("[loc] Native Reverse Geocode Failed:", e);
    }
  }

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

  const retry = useCallback(() => {
    console.log("[loc] Manual Retry Triggered");
    setTrigger((n) => n + 1);
  }, []);

  const overrideLocation = useCallback((lat: number, lng: number, name: string) => {
    console.log("[loc] Manual Override:", lat, lng, name);
    setLocationStatus({ state: "located", lat, lng, locationName: name, source: "manual" });
    setIsGpsPrecise(true);
    setIsLocating(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    let hasIpFix = false;
    let hasGpsFix = false;
    let webWatchId: number | null = null;

    console.log("[loc] LocationProvider Started (Trigger:", trigger, ")");

    setIsLocating(true);
    setWatchActive(false);
    setIsGpsPrecise(false);
    setLocationStatus({ state: "none" });

    const setIpLocation = (lat: number, lng: number, name: string) => {
      if (!mounted) return;
      hasIpFix = true;
      if (!hasGpsFix) {
        console.log("[loc] Set IP Location:", name);
        setIsLocating(false);
        setLocationStatus({ state: "located", lat, lng, locationName: name, source: "ip" });
      }
    };

    const setGpsLocation = async (lat: number, lng: number, accuracy?: number) => {
      if (!mounted) return;
      hasGpsFix = true;
      setIsGpsPrecise(true);
      setIsLocating(false);
      console.log(`[loc] Set GPS Location: ${lat}, ${lng} (+-${accuracy}m)`);

      setLocationStatus((prev) => {
        if (prev.state === "located" && prev.source === "gps" && (prev.accuracy ?? 9999) < (accuracy ?? 9999)) {
          return prev;
        }
        return { state: "located", lat, lng, locationName: "正在解析地址…", accuracy, source: "gps" };
      });

      const name = await reverseGeocode(lat, lng);
      if (mounted) {
        setLocationStatus({ state: "located", lat, lng, locationName: name, accuracy, source: "gps" });
      }
    };

    (async () => {
      const ipLoc = await fetchIpLocation();
      if (ipLoc && mounted) {
        setIpLocation(ipLoc.lat, ipLoc.lng, ipLoc.city);
      }

      if (Platform.OS === "web") {
        console.log("[loc] Running in WEB mode");
        if (typeof navigator !== "undefined" && navigator.geolocation) {

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              console.log("[loc] Browser GPS Success");
              if (mounted) setGpsLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
            },
            (error) => {
              console.error("[loc] Browser GPS Error:", error.code, error.message);
              if (!mounted) return;
              if (!hasIpFix) {
                if (error.code === 1) setLocationStatus({ state: "denied" });
                setIsLocating(false);
              }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
          );

          webWatchId = navigator.geolocation.watchPosition(
            (pos) => {
              console.log("[loc] Watch Position Update");
              if (mounted) setGpsLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
            },
            (error) => console.warn("[loc] Watch Error:", error),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
          );
        } else {
          console.error("[loc] Geolocation API not supported in this browser");
          setIsLocating(false);
        }
      } else {
        console.log("[loc] Running in NATIVE mode");
        try {
          const gpsEnabled = await Location.hasServicesEnabledAsync();
          if (!gpsEnabled) {
            console.warn("[loc] GPS Service Disabled");
            if (mounted && !hasIpFix) setIsLocating(false);
            Alert.alert("需要开启定位服务", "请在系统设置中开启定位/GPS服务", [
              { text: "去设置", onPress: () => Linking.openSettings() },
              { text: "稍后再说", style: "cancel" },
            ]);
            return;
          }

          const { status } = await Location.requestForegroundPermissionsAsync();
          if (!mounted) return;

          if (status !== "granted") {
            console.warn("[loc] Permission Denied");
            if (!hasIpFix) setLocationStatus({ state: "denied" });
            setIsLocating(false);
            Alert.alert("需要位置权限", "请允许位置权限", [
              { text: "去设置", onPress: () => Linking.openSettings() },
              { text: "取消", style: "cancel" },
            ]);
            return;
          }

          try {
            const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 500 });
            if (lastKnown && mounted && !hasGpsFix) {
              console.log("[loc] Using Cached Position");
              setGpsLocation(lastKnown.coords.latitude, lastKnown.coords.longitude, lastKnown.coords.accuracy ?? undefined);
            }
          } catch (e) { /* ignore */ }

          locationSubRef.current?.remove();
          Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 3 },
            (l) => { if (mounted) setGpsLocation(l.coords.latitude, l.coords.longitude, l.coords.accuracy ?? undefined); }
          ).then((sub) => {
            if (mounted) { locationSubRef.current = sub; setWatchActive(true); }
            else sub.remove();
          });

          const accuracies = [Location.Accuracy.High, Location.Accuracy.Balanced, Location.Accuracy.Low];
          let gotFix = false;
          for (const acc of accuracies) {
            if (gotFix || !mounted) break;
            try {
              const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: acc }), 20000);
              if (mounted) {
                setGpsLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
                gotFix = true;
              }
            } catch (e) { console.log("[loc] Accuracy level failed"); }
          }

          if (!gotFix && !hasIpFix && mounted) setIsLocating(false);

        } catch (e) {
          console.error("[loc] Native Fatal Error:", e);
          if (mounted && !hasIpFix) setIsLocating(false);
        }
      }

      setTimeout(() => {
        if (mounted && !hasIpFix && !hasGpsFix) {
          console.log("[loc] Final Timeout reached");
          setIsLocating(false);
        }
      }, 25000);
    })().catch((e) => console.error("[loc] Top Level Error:", e));

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
