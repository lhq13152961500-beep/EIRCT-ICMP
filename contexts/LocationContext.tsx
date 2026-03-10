import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Platform, Alert, Linking, View, StyleSheet } from "react-native";
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

let WebView: any = null;
if (Platform.OS !== "web") {
  try {
    WebView = require("react-native-webview").default;
  } catch (e) {
    console.log("[loc] react-native-webview not available");
  }
}

async function fetchAmapKey(): Promise<string | null> {
  try {
    const baseUrl = getApiUrl();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(new URL("/api/config/amap-key", baseUrl).href, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      console.log("[loc] Amap key fetched successfully");
      return data.key || null;
    }
    console.log("[loc] Amap key endpoint returned:", res.status);
  } catch (e) {
    console.log("[loc] Failed to fetch Amap key:", e);
  }
  return null;
}

function loadAmapSdk(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return reject(new Error("Not in browser"));
    }
    if ((window as any).AMap) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="webapi.amap.com"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      if ((window as any).AMap) resolve();
      return;
    }
    const callbackName = "_amapInitCallback_" + Date.now();
    (window as any)[callbackName] = () => {
      delete (window as any)[callbackName];
      console.log("[loc] Amap JS SDK loaded");
      resolve();
    };
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Geolocation&callback=${callbackName}`;
    script.onerror = () => {
      delete (window as any)[callbackName];
      reject(new Error("Failed to load Amap JS SDK"));
    };
    document.head.appendChild(script);
  });
}

function amapGeolocate(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    const AMap = (window as any).AMap;
    if (!AMap) return reject(new Error("AMap not loaded"));

    const geolocation = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 15000,
      buttonPosition: "hidden",
      showButton: false,
      showMarker: false,
      showCircle: false,
      panToLocation: false,
      zoomToAccuracy: false,
      GeoLocationFirst: true,
      useNative: true,
      noIpLocate: 0,
      extensions: "base",
    });

    geolocation.getCurrentPosition((status: string, result: any) => {
      if (status === "complete" && result.position) {
        const lng = result.position.lng ?? result.position.getLng?.();
        const lat = result.position.lat ?? result.position.getLat?.();
        const accuracy = result.accuracy ?? 50;
        console.log(`[loc] Amap Geolocation Success: ${lat}, ${lng} (±${accuracy}m)`);
        resolve({ lat, lng, accuracy });
      } else {
        console.warn("[loc] Amap Geolocation Failed:", result?.message || status);
        reject(new Error(result?.message || "Amap geolocation failed"));
      }
    });
  });
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
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const mountedRef = useRef(true);
  const hasGpsFixRef = useRef(false);

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

  const handleWebViewMessage = useCallback(async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "location" && data.lat && data.lng) {
        console.log(`[loc] Amap WebView GPS: ${data.lat}, ${data.lng} (±${data.accuracy}m)`);
        hasGpsFixRef.current = true;
        setIsGpsPrecise(true);
        setIsLocating(false);
        setWatchActive(true);

        setLocationStatus((prev) => {
          if (prev.state === "located" && prev.source === "gps" && (prev.accuracy ?? 9999) < (data.accuracy ?? 9999)) {
            return prev;
          }
          return { state: "located", lat: data.lat, lng: data.lng, locationName: "正在解析地址…", accuracy: data.accuracy, source: "gps" };
        });

        const name = data.address || await reverseGeocode(data.lat, data.lng);
        if (mountedRef.current) {
          setLocationStatus({ state: "located", lat: data.lat, lng: data.lng, locationName: name, accuracy: data.accuracy, source: "gps" });
        }
      } else if (data.type === "error") {
        console.warn("[loc] Amap WebView Error:", data.message);
      }
    } catch (e) {
      console.warn("[loc] WebView message parse error:", e);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let hasIpFix = false;
    let hasGpsFix = false;
    let amapWatchTimer: ReturnType<typeof setInterval> | null = null;

    mountedRef.current = true;
    hasGpsFixRef.current = false;

    console.log("[loc] LocationProvider Started (Trigger:", trigger, ")");

    setIsLocating(true);
    setWatchActive(false);
    setIsGpsPrecise(false);
    setLocationStatus({ state: "none" });
    setWebViewUrl(null);

    const setIpLocation = (lat: number, lng: number, name: string) => {
      if (!mounted) return;
      hasIpFix = true;
      if (!hasGpsFix && !hasGpsFixRef.current) {
        console.log("[loc] Set IP Location:", name);
        setIsLocating(false);
        setLocationStatus({ state: "located", lat, lng, locationName: name, source: "ip" });
      }
    };

    const setGpsLocation = async (lat: number, lng: number, accuracy?: number) => {
      if (!mounted) return;
      hasGpsFix = true;
      hasGpsFixRef.current = true;
      setIsGpsPrecise(true);
      setIsLocating(false);
      console.log(`[loc] Set GPS Location: ${lat}, ${lng} (±${accuracy}m)`);

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
        console.log("[loc] Running in WEB mode - using Amap JS SDK");

        const amapKey = await fetchAmapKey();
        if (!amapKey) {
          console.warn("[loc] No Amap key, falling back to browser geolocation");
          if (typeof navigator !== "undefined" && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
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
          }
          return;
        }

        try {
          await loadAmapSdk(amapKey);
          if (!mounted) return;
          console.log("[loc] Amap SDK ready, requesting position...");
          setWatchActive(true);

          const result = await amapGeolocate();
          if (mounted) {
            await setGpsLocation(result.lat, result.lng, result.accuracy);
          }

          amapWatchTimer = setInterval(async () => {
            if (!mounted) return;
            try {
              const pos = await amapGeolocate();
              if (mounted) setGpsLocation(pos.lat, pos.lng, pos.accuracy);
            } catch {
              // ignore watch errors
            }
          }, 15000);

        } catch (e) {
          console.warn("[loc] Amap SDK geolocation failed:", e);
          if (typeof navigator !== "undefined" && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (mounted) setGpsLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
              },
              () => {
                if (!mounted) return;
                if (!hasIpFix) setIsLocating(false);
              },
              { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
            );
          } else if (!hasIpFix) {
            setIsLocating(false);
          }
        }
      } else {
        console.log("[loc] Running in NATIVE mode - using Amap WebView + expo-location");

        const baseUrl = getApiUrl();
        const amapLocateUrl = new URL("/api/amap-locate", baseUrl).href;
        console.log("[loc] Loading Amap WebView:", amapLocateUrl);
        setWebViewUrl(amapLocateUrl);
        setWatchActive(true);

        const webViewTimeout = setTimeout(() => {
          if (mounted && !hasGpsFixRef.current && !hasGpsFix) {
            console.warn("[loc] Amap WebView did not respond within 20s — relying on IP location");
          }
        }, 20000);

        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (!mounted) return;

          if (status === "granted") {
            try {
              const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 500 });
              if (lastKnown && mounted && !hasGpsFix && !hasGpsFixRef.current) {
                console.log("[loc] Using Cached Position from expo-location");
                setGpsLocation(lastKnown.coords.latitude, lastKnown.coords.longitude, lastKnown.coords.accuracy ?? undefined);
              }
            } catch (e) { /* ignore */ }

            locationSubRef.current?.remove();
            Location.watchPositionAsync(
              { accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 3 },
              (l) => { if (mounted) setGpsLocation(l.coords.latitude, l.coords.longitude, l.coords.accuracy ?? undefined); }
            ).then((sub) => {
              if (mounted) { locationSubRef.current = sub; }
              else sub.remove();
            }).catch((e) => {
              console.log("[loc] expo-location watch failed (expected in China):", e);
            });

            const accuracies = [Location.Accuracy.Balanced, Location.Accuracy.Low];
            for (const acc of accuracies) {
              if (hasGpsFix || hasGpsFixRef.current || !mounted) break;
              try {
                const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: acc }), 10000);
                if (mounted && !hasGpsFixRef.current) {
                  setGpsLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
                  hasGpsFix = true;
                }
              } catch (e) {
                console.log("[loc] expo-location accuracy level failed (expected in China)");
              }
            }
          } else {
            console.log("[loc] Location permission denied, relying on Amap WebView only");
          }
        } catch (e) {
          console.log("[loc] expo-location init failed, relying on Amap WebView:", e);
        }
      }

      setTimeout(() => {
        if (mounted && !hasIpFix && !hasGpsFix && !hasGpsFixRef.current) {
          console.log("[loc] Final Timeout reached");
          setIsLocating(false);
        }
      }, 30000);
    })().catch((e) => console.error("[loc] Top Level Error:", e));

    return () => {
      mounted = false;
      mountedRef.current = false;
      if (amapWatchTimer) clearInterval(amapWatchTimer);
      locationSubRef.current?.remove();
      locationSubRef.current = null;
      setWebViewUrl(null);
    };
  }, [trigger]);

  return (
    <LocationContext.Provider value={{ locationStatus, isLocating, watchActive, isGpsPrecise, retry, overrideLocation }}>
      {children}
      {Platform.OS !== "web" && WebView && webViewUrl && (
        <View style={hiddenStyles.container} pointerEvents="none">
          <WebView
            source={{ uri: webViewUrl }}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            geolocationEnabled
            androidLayerType="hardware"
            allowFileAccess
            mixedContentMode="compatibility"
            onShouldStartLoadWithRequest={() => true}
            style={hiddenStyles.webview}
            onError={(e: any) => console.warn("[loc] WebView error:", e.nativeEvent?.description)}
            onHttpError={(e: any) => console.warn("[loc] WebView HTTP error:", e.nativeEvent?.statusCode)}
          />
        </View>
      )}
    </LocationContext.Provider>
  );
}

const hiddenStyles = StyleSheet.create({
  container: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    overflow: "hidden",
  },
  webview: {
    width: 1,
    height: 1,
  },
});
