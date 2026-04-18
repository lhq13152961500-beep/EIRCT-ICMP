import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
  LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { roamSession } from "@/lib/roam-session";
import { WebView } from "react-native-webview";
import Colors from "@/constants/colors";
import { useLocation } from "@/contexts/LocationContext";
import { getApiUrl } from "@/lib/query-client";
import { getPendingCustomRoute, clearPendingCustomRoute } from "@/lib/itinerary-store";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_FULL = SCREEN_HEIGHT * 0.74;

const haptic = (style: "light" | "medium" = "light") => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(
      style === "medium"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    );
  }
};

type FilterKey = "全部" | "建筑" | "展览" | "美食" | "特产" | "卫生间";

interface PoiItem {
  id: string;
  name: string;
  emoji: string;
  category: Exclude<FilterKey, "全部">;
  desc?: string;
}

const CATEGORY_COLORS: Record<Exclude<FilterKey, "全部">, { bg: string; dot: string; text: string }> = {
  建筑: { bg: "#FFF4E6", dot: "#E88A2E", text: "#B8681E" },
  展览: { bg: "#EEF2FF", dot: "#6B7FD4", text: "#4A5CB8" },
  美食: { bg: "#FFF0F0", dot: "#E8514A", text: "#C0392B" },
  特产: { bg: "#F0FFF4", dot: "#3DAA6F", text: "#2D8A55" },
  卫生间: { bg: "#F5F5FF", dot: "#8B8EC8", text: "#6B6EAA" },
};

const FILTER_TABS: FilterKey[] = ["全部", "建筑", "展览", "美食", "特产", "卫生间"];

const POI_ITEMS: PoiItem[] = [
  { id: "1",  name: "景区入口大门", emoji: "🚪", category: "建筑",   desc: "吐峪沟大峡谷景区正门，古朴石砌拱门，始建于清代" },
  { id: "2",  name: "麻扎村",       emoji: "🕌", category: "建筑",   desc: "千年维吾尔族古村落，保留完整的生土建筑群" },
  { id: "3",  name: "吐峪沟清真寺", emoji: "⛩️", category: "建筑",   desc: "历史悠久的伊斯兰建筑，精美木雕装饰令人叹为观止" },
  { id: "4",  name: "千年洞窟",     emoji: "⛰️", category: "建筑",   desc: "公元4世纪佛教石窟群，壁画保存完好" },
  { id: "5",  name: "古麻扎遗址",   emoji: "🏛️", category: "建筑",   desc: "伊斯兰圣祠遗址，是新疆最古老的麻扎之一" },
  { id: "6",  name: "非遗文化馆",   emoji: "🎨", category: "展览",   desc: "集中展示维吾尔族非物质文化遗产，含木卡姆、都它尔等项目" },
  { id: "7",  name: "民俗体验馆",   emoji: "🖼️", category: "展览",   desc: "原汁原味的维吾尔族传统手工艺展示与互动体验" },
  { id: "8",  name: "葡萄晾房",     emoji: "🍇", category: "特产",   desc: "传统土坯晾房，秋季满室葡萄干香气" },
  { id: "9",  name: "特产集市",     emoji: "🎁", category: "特产",   desc: "葡萄干、无花果、馕饼等吐峪沟特色农产品" },
  { id: "10", name: "烤馕馆",       emoji: "🫓", category: "美食",   desc: "现烤坑炉馕饼，外脆内软，是当地最具特色的主食" },
  { id: "11", name: "瓜果长廊",     emoji: "🍈", category: "美食",   desc: "种植哈密瓜、白杏等特色瓜果，可现场品尝" },
  { id: "12", name: "游客服务中心", emoji: "ℹ️",  category: "建筑",   desc: "提供景区导览、租赁、急救等综合服务" },
  { id: "13", name: "WC",           emoji: "🚻", category: "卫生间", desc: "公共卫生间" },
  { id: "14", name: "WC",           emoji: "🚻", category: "卫生间", desc: "公共卫生间" },
];

interface RouteItem {
  id: string;
  title: string;
  desc: string;
  buildings: number;
  distance: string;
  duration: string;
  color: string;
  accent: string;
  icon: string;
  tags: string[];
  poiIds: string[];
}

const ROUTES: RouteItem[] = [
  {
    id: "1",
    title: "峡谷精华游览路线",
    desc: "穿越千年古村落与峡谷地貌，含核心建筑与美食，适合半日游",
    buildings: 8,
    distance: "1.5",
    duration: "约2小时",
    color: "#E88A2E",
    accent: "#FFF4E6",
    icon: "⚡",
    tags: ["热门", "古建筑", "美食"],
    poiIds: ["1", "2", "3", "10", "13", "12", "7", "11"],
  },
  {
    id: "2",
    title: "深度文化沉浸路线",
    desc: "深入了解维吾尔族非遗文化与千年历史，含洞窟与麻扎，适合全日游",
    buildings: 12,
    distance: "2.8",
    duration: "约4小时",
    color: "#3DAA6F",
    accent: "#F0FFF4",
    icon: "🎯",
    tags: ["精华", "文化", "非遗"],
    poiIds: ["1", "9", "7", "12", "4", "8", "5", "10", "2", "3", "6", "11"],
  },
  {
    id: "3",
    title: "秋收葡萄干体验路线",
    desc: "秋季限定，参观晾房、品尝葡萄干与瓜果，感受丝路农耕文化",
    buildings: 6,
    distance: "1.2",
    duration: "约2.5小时",
    color: "#6B7FD4",
    accent: "#EEF2FF",
    icon: "🍇",
    tags: ["季节限定", "特产", "体验"],
    poiIds: ["1", "9", "8", "10", "11", "7"],
  },
];

const MAP_URL = (() => {
  try {
    const base = getApiUrl();
    return new URL("api/map-tuyugou", base).href;
  } catch {
    return "";
  }
})();

/* Stable object reference — prevents WebView from reloading on parent re-renders */
const MAP_SOURCE = MAP_URL ? { uri: MAP_URL } : undefined;

export default function MapGuideScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom;
  const { locationStatus, isLocating } = useLocation();

  const locationName =
    locationStatus.state === "located" ? locationStatus.locationName : null;
  const locationAccuracy =
    locationStatus.state === "located" && locationStatus.accuracy != null
      ? `±${Math.round(locationStatus.accuracy)}m`
      : null;

  const [isRoaming, setIsRoaming] = useState(() => !!roamSession.get());

  // Subscribe to roam session changes (start / stop from adaptive-roam)
  useEffect(() => {
    return roamSession.subscribe(() => setIsRoaming(!!roamSession.get()));
  }, []);

  const [activeFilter, setActiveFilter] = useState<FilterKey>("全部");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<PoiItem | null>(null);
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [mapAreaHeight, setMapAreaHeight] = useState(SCREEN_HEIGHT * 0.62);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const sheetAnim = useRef(new Animated.Value(0)).current;
  const webViewRef = useRef<WebView>(null);
  const pendingCustomRouteRef = useRef<string[] | null>(null);

  const mapW = SCREEN_WIDTH;
  const mapH = mapAreaHeight;

  const routeBtnH = 56 + bottomPad + 12;

  const injectJs = useCallback((js: string) => {
    webViewRef.current?.injectJavaScript(`(function(){${js}})(); true;`);
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    injectJs(`window.filterPoi && window.filterPoi(${JSON.stringify(activeFilter)});`);
  }, [activeFilter, mapReady, injectJs]);

  useEffect(() => {
    if (!mapReady) return;
    if (selectedPoi === null) {
      injectJs(`window.selectPoi && window.selectPoi(null);`);
    }
  }, [selectedPoi, mapReady, injectJs]);

  useEffect(() => {
    if (!mapReady) return;
    // 以景区入口大门 (GCJ-02) 为游览起始位置
    const START_LNG = 89.5971;
    const START_LAT = 42.8603;
    injectJs(`window.setMyLocation && window.setMyLocation(${START_LNG}, ${START_LAT});`);
  }, [mapReady, injectJs]);

  // When map becomes ready, draw any pending custom route
  useEffect(() => {
    if (!mapReady) return;
    const ids = pendingCustomRouteRef.current;
    if (ids && ids.length > 0) {
      pendingCustomRouteRef.current = null;
      setActiveRouteId("custom");
      setSheetOpen(false);
      injectJs(`window.drawRoute && window.drawRoute(${JSON.stringify(ids)}, "#E88A2E");`);
    }
  }, [mapReady, injectJs]);

  // Pick up custom route from store when screen is focused (returning from create-itinerary)
  useFocusEffect(
    useCallback(() => {
      const ids = getPendingCustomRoute();
      if (!ids || ids.length === 0) return;
      clearPendingCustomRoute();
      if (mapReady) {
        setActiveRouteId("custom");
        setSheetOpen(false);
        injectJs(`window.drawRoute && window.drawRoute(${JSON.stringify(ids)}, "#E88A2E");`);
      } else {
        pendingCustomRouteRef.current = ids;
      }
    }, [mapReady, injectJs])
  );

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "ready") {
        setMapReady(true);
      } else if (msg.type === "poiClick") {
        haptic();
        const found = POI_ITEMS.find(p => p.id === msg.id);
        if (found) {
          setSelectedPoi(found);
        } else {
          setSelectedPoi({ id: msg.id, name: msg.name, emoji: msg.emoji, category: msg.category, desc: msg.desc });
        }
      } else if (msg.type === "mapClick") {
        setSelectedPoi(null);
      }
    } catch {}
  }, []);

  const openSheet = useCallback(() => {
    haptic("medium");
    setSelectedPoi(null);
    setSheetOpen(true);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: false,
      tension: 52,
      friction: 9,
    }).start();
  }, [sheetAnim]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 240,
      useNativeDriver: false,
    }).start(() => setSheetOpen(false));
  }, [sheetAnim]);

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_FULL + 40, 0],
  });

  const activeRoute = activeRouteId ? ROUTES.find(r => r.id === activeRouteId) ?? null : null;

  const startRoute = useCallback((route: RouteItem) => {
    haptic("medium");
    setActiveRouteId(route.id);
    injectJs(
      `window.drawRoute && window.drawRoute(${JSON.stringify(route.poiIds)}, ${JSON.stringify(route.color)});`
    );
    closeSheet();
  }, [injectJs, closeSheet]);

  const cancelRoute = useCallback(() => {
    haptic();
    setActiveRouteId(null);
    injectJs(`window.clearRoute && window.clearRoute();`);
  }, [injectJs]);

  const onMapAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 100) setMapAreaHeight(h);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar barStyle="light-content" />

      {/* ── Header (teal, no white) ── */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => { haptic(); if (router.canGoBack()) { router.back(); } else { router.replace("/"); } }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>地图导览</Text>
          <View style={styles.locationPill}>
            {isLocating && !locationName ? (
              <ActivityIndicator size="small" color="#fff" style={{ width: 12, height: 12 }} />
            ) : (
              <Ionicons name="location" size={12} color="#FF8C42" />
            )}
            <Text style={styles.locationPillText} numberOfLines={1}>
              {locationName ?? "定位中…"}
            </Text>
            {locationAccuracy && (
              <Text style={styles.locationAccuracy}>{locationAccuracy}</Text>
            )}
          </View>
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* ── Filter row (transparent on teal) ── */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_TABS.map((key) => {
            const isActive = activeFilter === key;
            const catColor = key !== "全部" ? CATEGORY_COLORS[key as Exclude<FilterKey, "全部">].dot : "#FF8C42";
            return (
              <Pressable
                key={key}
                style={[
                  styles.filterChip,
                  isActive
                    ? { backgroundColor: catColor, borderColor: catColor }
                    : { backgroundColor: "rgba(255,255,255,0.2)", borderColor: "rgba(255,255,255,0.35)" },
                ]}
                onPress={() => { haptic(); setActiveFilter(key); setSelectedPoi(null); }}
              >
                {key !== "全部" && (
                  <Text style={styles.filterEmoji}>
                    {key === "建筑" ? "🏛️" : key === "展览" ? "🖼️" : key === "美食" ? "🍽️" : key === "特产" ? "🎁" : "🚻"}
                  </Text>
                )}
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{key}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Map area (flex:1 — takes all remaining space) ── */}
      <View style={styles.mapOuter} onLayout={onMapAreaLayout}>
        {MAP_URL && !mapError ? (
          <WebView
            ref={webViewRef}
            source={MAP_SOURCE}
            style={StyleSheet.absoluteFill}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled
            cacheMode="LOAD_CACHE_ELSE_NETWORK"
            mixedContentMode="always"
            originWhitelist={["*"]}
            onError={() => setMapError(true)}
            onHttpError={(e) => { if (e.nativeEvent.statusCode >= 400) setMapError(true); }}
            renderLoading={() => (
              <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: "#e8dcc8" }]}>
                <ActivityIndicator size="large" color="#8B5E3C" />
                <Text style={{ marginTop: 10, color: "#8B5E3C", fontSize: 13 }}>地图加载中…</Text>
              </View>
            )}
            startInLoadingState
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: "#e8dcc8", gap: 12 }]}>
            <Text style={{ fontSize: 32 }}>🗺️</Text>
            <Text style={{ color: "#8B5E3C", fontSize: 14, fontWeight: "600" }}>地图加载失败</Text>
            <Pressable
              style={{ backgroundColor: "#8B5E3C", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
              onPress={() => { setMapError(false); setMapReady(false); webViewRef.current?.reload(); }}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>重新加载</Text>
            </Pressable>
          </View>
        )}

        {/* Bottom gradient overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.18)"]}
          style={[styles.mapBottomGradient, { height: routeBtnH + 40 }]}
          pointerEvents="none"
        />

        {/* Zoom buttons — move up when POI popup is visible */}
        <View style={[styles.zoomBox, { bottom: selectedPoi ? routeBtnH + 108 : routeBtnH + 12 }]}>
          <Pressable style={styles.zoomBtn} onPress={() => { haptic(); injectJs("map && map.zoomIn();"); }}>
            <Ionicons name="add" size={20} color={Colors.light.text} />
          </Pressable>
          <View style={styles.zoomLine} />
          <Pressable style={styles.zoomBtn} onPress={() => { haptic(); injectJs("map && map.zoomOut();"); }}>
            <Ionicons name="remove" size={20} color={Colors.light.text} />
          </Pressable>
        </View>

        {/* POI popup — positioned above route button */}
        {selectedPoi && (
          <Pressable
            style={[styles.poiPopupOuter, { bottom: routeBtnH + 12 }]}
            onPress={() => setSelectedPoi(null)}
          >
            <View style={styles.poiPopup} onStartShouldSetResponder={() => true}>
              <View style={[styles.poiPopupIcon, { backgroundColor: CATEGORY_COLORS[selectedPoi.category].bg }]}>
                <Text style={{ fontSize: 22 }}>{selectedPoi.emoji}</Text>
              </View>
              <View style={styles.poiPopupBody}>
                <Text style={styles.poiPopupName}>{selectedPoi.name}</Text>
                <Text style={styles.poiPopupDesc}>{selectedPoi.desc}</Text>
                <View style={[styles.poiPopupTag, { backgroundColor: CATEGORY_COLORS[selectedPoi.category].bg }]}>
                  <Text style={[styles.poiPopupTagText, { color: CATEGORY_COLORS[selectedPoi.category].text }]}>
                    {selectedPoi.category}
                  </Text>
                </View>
              </View>
              <Pressable
                style={[styles.poiPopupNav, { backgroundColor: CATEGORY_COLORS[selectedPoi.category].dot }]}
                onPress={() => { haptic(); setSelectedPoi(null); }}
              >
                <Ionicons name="navigate" size={16} color="#fff" />
              </Pressable>
            </View>
          </Pressable>
        )}

        {/* Bottom buttons — floating above bottom inset */}
        <View style={[styles.routeBtnArea, { paddingBottom: bottomPad + 12 }]}>
          <View style={styles.bottomBtnRow}>
            {/* 游览路线 button */}
            <View style={styles.bottomBtnFlex}>
              {activeRoute ? (
                <View style={[styles.activeRouteBtn, { shadowColor: activeRoute.color }]}>
                  <View style={[styles.activeRouteBtnMain, { backgroundColor: activeRoute.color }]}>
                    <Text style={styles.activeRouteBtnIcon}>{activeRoute.icon}</Text>
                    <Text style={styles.activeRouteBtnText} numberOfLines={1}>{activeRoute.title}</Text>
                  </View>
                  <Pressable
                    style={[styles.activeRouteCancelBtn, { backgroundColor: activeRoute.color }]}
                    onPress={cancelRoute}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.routeBtn} onPress={openSheet}>
                  <LinearGradient
                    colors={["#8B5E3C", "#6B4228"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.routeBtnGradient}
                  >
                    <MaterialCommunityIcons name="map-marker-path" size={20} color="#fff" />
                    <Text style={styles.routeBtnText}>游览路线</Text>
                    <View style={styles.routeBtnBadge}>
                      <Text style={styles.routeBtnBadgeText}>{ROUTES.length}</Text>
                    </View>
                  </LinearGradient>
                </Pressable>
              )}
            </View>

            {/* 自适应漫游 / 正在漫游 button */}
            <Pressable
              style={styles.adaptiveBtn}
              onPress={() => { haptic("medium"); router.push("/adaptive-roam"); }}
            >
              {isRoaming ? (
                <LinearGradient
                  colors={["#1565C0", "#0D47A1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.adaptiveBtnGradient}
                >
                  <MaterialCommunityIcons name="map-marker-path" size={20} color="#fff" />
                  <Text style={styles.routeBtnText}>正在漫游</Text>
                  <View style={styles.roamingDot} />
                </LinearGradient>
              ) : (
                <LinearGradient
                  colors={["#3DAA6F", "#1E7E4F"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.adaptiveBtnGradient}
                >
                  <MaterialCommunityIcons name="walk" size={20} color="#fff" />
                  <Text style={styles.routeBtnText}>自适应漫游</Text>
                </LinearGradient>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Route Bottom Sheet ── */}
      {sheetOpen && (
        <>
          <Pressable style={styles.sheetOverlay} onPress={closeSheet} />
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}
          >
            <LinearGradient
              colors={["#8B5E3C", "#6B4228"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sheetHeaderGrad}
            >
              <View style={styles.sheetHandleWrap}>
                <View style={styles.sheetHandleLight} />
              </View>
              <View style={styles.sheetHeaderRow}>
                <View>
                  <Text style={styles.sheetTitleWhite}>游览路线</Text>
                  <Text style={styles.sheetSubWhite}>为你推荐 {ROUTES.length} 条游览路线</Text>
                </View>
                <Pressable style={styles.sheetCloseBtn} onPress={closeSheet}>
                  <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
                </Pressable>
              </View>
            </LinearGradient>

            <ScrollView
              style={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: bottomPad + 100, paddingTop: 12 }}
            >
              {ROUTES.map((route) => (
                <Pressable
                  key={route.id}
                  style={({ pressed }) => [styles.routeCard, pressed && styles.routeCardPressed]}
                  onPress={() => { haptic("medium"); closeSheet(); }}
                >
                  <View style={[styles.routeCardTop, { backgroundColor: route.accent }]}>
                    <View style={styles.routeCardTopLeft}>
                      <Text style={styles.routeCardIcon}>{route.icon}</Text>
                      <View style={styles.routeCardTitleWrap}>
                        <Text style={styles.routeCardTitle}>{route.title}</Text>
                        <Text style={styles.routeCardDesc}>{route.desc}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.routeCardBottom}>
                    <View style={styles.routeCardStats}>
                      <View style={styles.routeStat}>
                        <Ionicons name="business-outline" size={13} color={Colors.light.textSecondary} />
                        <Text style={styles.routeStatText}>{route.buildings}个景点</Text>
                      </View>
                      <View style={styles.routeStatDivider} />
                      <View style={styles.routeStat}>
                        <Ionicons name="footsteps-outline" size={13} color={Colors.light.textSecondary} />
                        <Text style={styles.routeStatText}>{route.distance}公里</Text>
                      </View>
                      <View style={styles.routeStatDivider} />
                      <View style={styles.routeStat}>
                        <Ionicons name="time-outline" size={13} color={Colors.light.textSecondary} />
                        <Text style={styles.routeStatText}>{route.duration}</Text>
                      </View>
                    </View>
                    <View style={styles.routeCardTagRow}>
                      {route.tags.map((t) => (
                        <View key={t} style={[styles.routeTag, { backgroundColor: route.color + "18" }]}>
                          <Text style={[styles.routeTagText, { color: route.color }]}>{t}</Text>
                        </View>
                      ))}
                    </View>
                    <Pressable
                      style={[styles.startBtn, { backgroundColor: route.color }]}
                      onPress={() => startRoute(route)}
                    >
                      <Ionicons name="play" size={14} color="#fff" />
                      <Text style={styles.startBtnText}>开始游览</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <View style={[styles.sheetFooter, { paddingBottom: bottomPad + 16 }]}>
              <Text style={styles.sheetFooterLabel}>没有合适的路线？</Text>
              <Pressable
                style={styles.createBtn}
                onPress={() => {
                  haptic("medium");
                  closeSheet();
                  router.push("/create-itinerary");
                }}
              >
                <Ionicons name="add-circle-outline" size={16} color={Colors.light.text} />
                <Text style={styles.createBtnText}>创建我的行程</Text>
              </Pressable>
            </View>
          </Animated.View>
        </>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A9688" },

  // Header — teal, no white
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: "#1A9688",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center", gap: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },
  locationPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  locationPillText: { fontSize: 11, fontWeight: "600", color: "#fff" },
  locationAccuracy: { fontSize: 10, color: "rgba(255,255,255,0.7)" },

  // Filter — transparent on teal
  filterWrap: { backgroundColor: "#1A9688", paddingBottom: 10 },
  filterRow: { paddingHorizontal: 12, paddingTop: 4, gap: 7 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1.5,
  },
  filterEmoji: { fontSize: 12 },
  filterText: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.9)" },
  filterTextActive: { color: "#fff", fontWeight: "700" },

  // Map outer: fills remaining space
  mapOuter: { flex: 1, overflow: "hidden", position: "relative" },

  // Map bottom gradient
  mapBottomGradient: {
    position: "absolute", bottom: 0, left: 0, right: 0,
  },

  // Map elements
  islandBlob: {
    position: "absolute", backgroundColor: "#58C4B8", borderRadius: 999,
  },
  islandInner: {
    position: "absolute", backgroundColor: "#66CBB8",
    borderRadius: 999, opacity: 0.8,
  },
  road: {
    position: "absolute", backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8, zIndex: 1,
  },
  roadBorder: {
    position: "absolute", backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 10, zIndex: 0,
  },
  treeEmoji: { position: "absolute", fontSize: 16, zIndex: 2 },
  pond: {
    position: "absolute", backgroundColor: "#2BA0C8",
    borderRadius: 999, opacity: 0.6, zIndex: 2,
  },

  // POI markers
  poiWrap: { position: "absolute", alignItems: "center", zIndex: 10 },
  poiBubble: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
  poiEmoji: { fontSize: 20 },
  poiTag: {
    maxWidth: 68, paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 6, marginTop: 2, alignItems: "center",
  },
  poiTagText: { fontSize: 9.5, fontWeight: "600" },
  poiPin: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },

  // My location — orange pin
  myLocWrap: { position: "absolute", zIndex: 12, alignItems: "center" },
  myLocPinPulse: {
    position: "absolute", top: -6, width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(255,140,66,0.2)", borderWidth: 1.5, borderColor: "rgba(255,140,66,0.4)",
  },
  myLocPin: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#FF8C42",
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#fff",
    shadowColor: "#FF6B00", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 10,
  },
  myLocPinDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff",
  },
  myLocPinTail: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10,
    borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "#FF8C42",
    marginTop: -1,
  },

  // Zoom
  zoomBox: {
    position: "absolute", right: 14,
    backgroundColor: "#fff", borderRadius: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5,
    overflow: "hidden",
  },
  zoomBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  zoomLine: { height: StyleSheet.hairlineWidth, backgroundColor: "#E0E0E0", marginHorizontal: 8 },

  // POI popup
  poiPopupOuter: { position: "absolute", left: 14, right: 14 },
  poiPopup: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 20, padding: 14, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 12,
  },
  poiPopupIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  poiPopupBody: { flex: 1 },
  poiPopupName: { fontSize: 15, fontWeight: "700", color: Colors.light.text, marginBottom: 2 },
  poiPopupDesc: { fontSize: 12, color: Colors.light.textSecondary, marginBottom: 6 },
  poiPopupTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: "flex-start" },
  poiPopupTagText: { fontSize: 11, fontWeight: "600" },
  poiPopupNav: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },

  // Route button (inside mapOuter, absolute bottom)
  routeBtnArea: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 8,
  },
  bottomBtnRow: { flexDirection: "row", gap: 10 },
  bottomBtnFlex: { flex: 1 },
  adaptiveBtn: {
    borderRadius: 28, overflow: "hidden",
    shadowColor: "#1E7E4F", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
  },
  adaptiveBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, paddingHorizontal: 14 },
  roamingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#64B5F6", marginLeft: 2 },
  routeBtn: {
    borderRadius: 28, overflow: "hidden",
    shadowColor: "#5C3D1E", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
  },
  routeBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  routeBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  routeBtnBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.28)", alignItems: "center", justifyContent: "center",
  },
  routeBtnBadgeText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  // Active route button
  activeRouteBtn: {
    flexDirection: "row", alignItems: "stretch", borderRadius: 28, overflow: "hidden",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  activeRouteBtnMain: {
    flex: 1, flexDirection: "row", alignItems: "center",
    gap: 8, paddingVertical: 16, paddingHorizontal: 20,
  },
  activeRouteBtnIcon: { fontSize: 18 },
  activeRouteBtnText: { flex: 1, fontSize: 15, fontWeight: "700", color: "#fff" },
  activeRouteCancelBtn: {
    paddingHorizontal: 18, alignItems: "center", justifyContent: "center",
    borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.3)",
  },

  // Sheet
  sheetOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SHEET_FULL,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20,
    overflow: "hidden",
  },
  sheetHeaderGrad: { paddingHorizontal: 20, paddingBottom: 18, paddingTop: 6 },
  sheetHandleWrap: { alignItems: "center", paddingVertical: 8 },
  sheetHandleLight: { width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.4)" },
  sheetHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  sheetTitleWhite: { fontSize: 20, fontWeight: "800", color: "#fff" },
  sheetSubWhite: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  sheetCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  sheetScroll: { flex: 1 },

  // Route card
  routeCard: {
    marginHorizontal: 16, marginVertical: 6,
    borderRadius: 18, backgroundColor: "#fff", overflow: "hidden",
    borderWidth: 1, borderColor: "#F0F0EC",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  routeCardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  routeCardTop: { padding: 16, flexDirection: "row", alignItems: "flex-start" },
  routeCardTopLeft: { flexDirection: "row", gap: 12, flex: 1 },
  routeCardIcon: { fontSize: 28, marginTop: 2 },
  routeCardTitleWrap: { flex: 1 },
  routeCardTitle: { fontSize: 15, fontWeight: "700", color: Colors.light.text, marginBottom: 4 },
  routeCardDesc: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 17 },
  routeCardBottom: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  routeCardStats: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeStatText: { fontSize: 12, color: Colors.light.textSecondary },
  routeStatDivider: { width: 1, height: 12, backgroundColor: "#E0E0E0" },
  routeCardTagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  routeTag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  routeTagText: { fontSize: 11, fontWeight: "600" },
  startBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 14,
  },
  startBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Sheet footer
  sheetFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#F0F0F0",
    backgroundColor: "#fff",
  },
  sheetFooterLabel: { fontSize: 13, color: Colors.light.textSecondary },
  createBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: "#F2F2F5",
  },
  createBtnText: { fontSize: 13, fontWeight: "600", color: Colors.light.text },
});
