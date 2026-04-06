import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import WebView from "react-native-webview";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

const haptic = (style: "light" | "medium" = "light") => {
  Haptics.impactAsync(
    style === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
  ).catch(() => {});
};

const MAP_URL = (() => {
  try {
    return new URL("api/map-tuyugou", getApiUrl()).href;
  } catch {
    return "";
  }
})();

const TIME_OPTIONS = [
  { label: "1小时", value: 1 },
  { label: "1.5小时", value: 1.5 },
  { label: "2小时", value: 2 },
  { label: "3小时以上", value: 3 },
];

function pickRoute(hours: number) {
  if (hours <= 1)   return { ids: ["1","9","8","10","11","7"],         color: "#9B59B6" };
  if (hours <= 2)   return { ids: ["1","2","3","10","13","12","7","11"], color: "#E8873A" };
  return               { ids: ["1","9","7","12","4","8","5","10","2","3","6","11"], color: "#3DAA6F" };
}

export default function AdaptiveRoamScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [phase, setPhase]         = useState<"setup" | "roaming">("setup");
  const [selectedTime, setTime]   = useState<number>(1.5);
  const [people, setPeople]       = useState<number>(2);

  const [mapReady, setMapReady]   = useState(false);
  const webViewRef                = useRef<WebView>(null);

  // Gait simulation state
  const [speed,     setSpeed]     = useState(4.2);
  const [stepLen,   setStepLen]   = useState(0.60);
  const [freq,      setFreq]      = useState(110);
  const [stability, setStability] = useState(98);

  const panelAnim = useRef(new Animated.Value(0)).current;

  // Inject JS into the map WebView
  const injectJs = useCallback((js: string) => {
    webViewRef.current?.injectJavaScript(js + "; true;");
  }, []);

  // When map is ready & roaming started → draw route + set location
  useEffect(() => {
    if (!mapReady || phase !== "roaming") return;
    const route = pickRoute(selectedTime);
    injectJs(`window.setMyLocation && window.setMyLocation(89.5971, 42.8603);`);
    injectJs(
      `window.drawRoute && window.drawRoute(${JSON.stringify(route.ids)}, ${JSON.stringify(route.color)});`
    );
  }, [mapReady, phase, selectedTime, injectJs]);

  // Gait data simulation
  useEffect(() => {
    if (phase !== "roaming") return;
    const id = setInterval(() => {
      setSpeed(p   => +Math.max(2.5, Math.min(6.0, p + (Math.random() - 0.5) * 0.4)).toFixed(1));
      setStepLen(p => +Math.max(0.40, Math.min(0.85, p + (Math.random() - 0.5) * 0.04)).toFixed(2));
      setFreq(p    => Math.round(Math.max(85, Math.min(135, p + (Math.random() - 0.5) * 5))));
      setStability(p => Math.round(Math.max(82, Math.min(100, p + (Math.random() - 0.5) * 2))));
    }, 2500);
    return () => clearInterval(id);
  }, [phase]);

  // Slide-up panel animation when roaming starts
  useEffect(() => {
    if (phase === "roaming") {
      Animated.spring(panelAnim, {
        toValue: 1, useNativeDriver: true, tension: 50, friction: 9,
      }).start();
    } else {
      panelAnim.setValue(0);
    }
  }, [phase, panelAnim]);

  const handleStart = () => {
    haptic("medium");
    setPhase("roaming");
  };

  const handleBack = () => {
    if (phase === "roaming") { setPhase("setup"); setMapReady(false); return; }
    haptic();
    if (router.canGoBack()) router.back(); else router.replace("/");
  };

  const handleWebViewMessage = useCallback((e: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "ready") setMapReady(true);
    } catch {}
  }, []);

  const panelTranslateY = panelAnim.interpolate({
    inputRange: [0, 1], outputRange: [240, 0],
  });

  const loadColor = stability >= 90 ? "#3DAA6F" : stability >= 75 ? "#E8873A" : "#E05252";
  const loadText  = stability >= 90 ? "低" : stability >= 75 ? "中" : "高";

  // ── SETUP PHASE ──────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        {/* Header */}
        <LinearGradient colors={["#fff", "#F8F5F0"]} style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.backBtn} onPress={handleBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>自适应漫游</Text>
            <Text style={styles.headerSub}>智能规划，随心漫步</Text>
          </View>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <ScrollView contentContainerStyle={[styles.setupContent, { paddingBottom: insets.bottom + 32 }]}>

          {/* Illustration banner */}
          <LinearGradient colors={["#E8F5F0", "#D0EEE3"]} style={styles.banner}>
            <MaterialCommunityIcons name="map-marker-path" size={48} color="#3DAA6F" />
            <Text style={styles.bannerTitle}>根据您的时间与人数{"\n"}智能规划最佳游览路线</Text>
          </LinearGradient>

          {/* Time selection */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="clock-outline" size={20} color="#3DAA6F" />
              <Text style={styles.cardTitle}>游玩时长</Text>
            </View>
            <View style={styles.optionRow}>
              {TIME_OPTIONS.map(opt => (
                <Pressable
                  key={opt.value}
                  style={[styles.optionChip, selectedTime === opt.value && styles.optionChipActive]}
                  onPress={() => { haptic(); setTime(opt.value); }}
                >
                  <Text style={[styles.optionChipText, selectedTime === opt.value && styles.optionChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.cardHint}>
              {selectedTime <= 1 ? "🟣 短途精华：6个核心景点" :
               selectedTime <= 2 ? "🟠 中途经典：8个精选景点" :
                                   "🟢 深度全览：12个特色景点"}
            </Text>
          </View>

          {/* People count */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="account-group-outline" size={20} color="#3DAA6F" />
              <Text style={styles.cardTitle}>同行人数</Text>
            </View>
            <View style={styles.counterRow}>
              <Pressable
                style={[styles.counterBtn, people <= 1 && styles.counterBtnDisabled]}
                onPress={() => { if (people > 1) { haptic(); setPeople(p => p - 1); } }}
              >
                <Ionicons name="remove" size={22} color={people <= 1 ? "#CCC" : "#3DAA6F"} />
              </Pressable>
              <View style={styles.counterVal}>
                <Text style={styles.counterNum}>{people}</Text>
                <Text style={styles.counterUnit}>人</Text>
              </View>
              <Pressable
                style={[styles.counterBtn, people >= 20 && styles.counterBtnDisabled]}
                onPress={() => { if (people < 20) { haptic(); setPeople(p => p + 1); } }}
              >
                <Ionicons name="add" size={22} color={people >= 20 ? "#CCC" : "#3DAA6F"} />
              </Pressable>
            </View>
            <View style={styles.peopleTagRow}>
              {["独自游", "情侣/双人", "家庭", "团队"].map((tag, i) => {
                const ranges = [[1,1],[2,2],[3,5],[6,20]];
                const [lo, hi] = ranges[i];
                const active = people >= lo && people <= hi;
                return (
                  <Pressable key={tag} onPress={() => { haptic(); setPeople(lo); }}
                    style={[styles.peopleTag, active && styles.peopleTagActive]}>
                    <Text style={[styles.peopleTagText, active && styles.peopleTagTextActive]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Route preview info */}
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>路线预览</Text>
            <View style={styles.previewRow}>
              <View style={styles.previewItem}>
                <MaterialCommunityIcons name="map-marker-multiple" size={18} color="#3DAA6F" />
                <Text style={styles.previewVal}>{selectedTime <= 1 ? 6 : selectedTime <= 2 ? 8 : 12}</Text>
                <Text style={styles.previewLabel}>景点</Text>
              </View>
              <View style={styles.previewDivider} />
              <View style={styles.previewItem}>
                <MaterialCommunityIcons name="walk" size={18} color="#3DAA6F" />
                <Text style={styles.previewVal}>{selectedTime <= 1 ? "1.8" : selectedTime <= 2 ? "2.5" : "4.2"}</Text>
                <Text style={styles.previewLabel}>公里</Text>
              </View>
              <View style={styles.previewDivider} />
              <View style={styles.previewItem}>
                <MaterialCommunityIcons name="account-multiple" size={18} color="#3DAA6F" />
                <Text style={styles.previewVal}>{people}</Text>
                <Text style={styles.previewLabel}>人同行</Text>
              </View>
            </View>
          </View>

        </ScrollView>

        {/* Start button */}
        <View style={[styles.startBtnWrap, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={styles.startBtn} onPress={handleStart}>
            <LinearGradient colors={["#3DAA6F", "#1E7E4F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.startBtnGradient}>
              <MaterialCommunityIcons name="play-circle-outline" size={24} color="#fff" />
              <Text style={styles.startBtnText}>漫游开始</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── ROAMING PHASE ─────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Compact header */}
      <View style={[styles.roamHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable style={styles.backBtn} onPress={handleBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </Pressable>
        <View style={styles.roamHeaderCenter}>
          <View style={styles.roamStatusDot} />
          <Text style={styles.roamHeaderTitle}>漫游中</Text>
          <Text style={styles.roamHeaderSub}>
            {selectedTime <= 1 ? "精华路线" : selectedTime <= 2 ? "经典路线" : "全览路线"}
            {"  ·  "}{people}人
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Map WebView */}
      <View style={styles.mapArea}>
        {MAP_URL ? (
          <WebView
            ref={webViewRef}
            source={{ uri: MAP_URL }}
            style={StyleSheet.absoluteFill}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            scrollEnabled={false}
            bounces={false}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={{ color: "#999" }}>地图加载中…</Text>
          </View>
        )}
      </View>

      {/* Gait analysis panel */}
      <Animated.View
        style={[
          styles.gaitPanel,
          { paddingBottom: insets.bottom + 8, transform: [{ translateY: panelTranslateY }] },
        ]}
      >
        {/* Panel header */}
        <LinearGradient colors={["#1A3D2B", "#245C3E"]} style={styles.gaitHeader}>
          <View style={styles.gaitHeaderLeft}>
            <View style={styles.gaitIconWrap}>
              <MaterialCommunityIcons name="chart-line" size={20} color="#3DAA6F" />
            </View>
            <View>
              <Text style={styles.gaitTitle}>步态分析</Text>
              <Text style={styles.gaitSubtitle}>实时生物数据</Text>
            </View>
          </View>
          <View style={styles.gaitSpeedWrap}>
            <Text style={styles.gaitSpeedVal}>{speed.toFixed(1)}</Text>
            <Text style={styles.gaitSpeedUnit}>km/h</Text>
            <Text style={styles.gaitSpeedLabel}>当前步速</Text>
          </View>
        </LinearGradient>

        {/* Metric grid */}
        <View style={styles.gaitGrid}>
          <View style={styles.gaitMetricCard}>
            <Text style={styles.gaitMetricLabel}>步长</Text>
            <Text style={styles.gaitMetricVal}>{stepLen.toFixed(2)}</Text>
            <Text style={styles.gaitMetricUnit}>米</Text>
          </View>
          <View style={styles.gaitMetricCard}>
            <Text style={styles.gaitMetricLabel}>步频</Text>
            <Text style={styles.gaitMetricVal}>{freq}</Text>
            <Text style={styles.gaitMetricUnit}>步/分钟</Text>
          </View>
          <View style={styles.gaitMetricCard}>
            <Text style={styles.gaitMetricLabel}>稳定性</Text>
            <Text style={styles.gaitMetricVal}>{stability}</Text>
            <Text style={styles.gaitMetricUnit}>%</Text>
          </View>
          <View style={[styles.gaitMetricCard, { backgroundColor: loadColor + "18" }]}>
            <Text style={styles.gaitMetricLabel}>运动负荷</Text>
            <View style={styles.gaitLoadRow}>
              <Text style={[styles.gaitMetricVal, { color: loadColor }]}>{loadText}</Text>
              <Ionicons name="checkmark-circle" size={16} color={loadColor} style={{ marginTop: 2 }} />
            </View>
            <Text style={[styles.gaitMetricUnit, { color: loadColor }]}>状态良好</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  // Header (setup)
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EEE",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.light.text },
  headerSub: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 1 },

  // Setup content
  setupContent: { padding: 16, gap: 14 },
  banner: {
    borderRadius: 18, padding: 24, alignItems: "center", gap: 12,
  },
  bannerTitle: { fontSize: 15, fontWeight: "600", color: "#1A3D2B", textAlign: "center", lineHeight: 22 },

  card: {
    backgroundColor: "#fff", borderRadius: 18, padding: 18,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
    gap: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: Colors.light.text },
  cardHint: { fontSize: 13, color: Colors.light.textSecondary },

  optionRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  optionChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: "#F5F5F5", borderWidth: 1.5, borderColor: "transparent",
  },
  optionChipActive: { backgroundColor: "#E8F5F0", borderColor: "#3DAA6F" },
  optionChipText: { fontSize: 14, fontWeight: "600", color: Colors.light.textSecondary },
  optionChipTextActive: { color: "#1A3D2B" },

  counterRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  counterBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#E8F5F0", alignItems: "center", justifyContent: "center",
  },
  counterBtnDisabled: { backgroundColor: "#F5F5F5" },
  counterVal: { alignItems: "center", minWidth: 64 },
  counterNum: { fontSize: 36, fontWeight: "800", color: Colors.light.text },
  counterUnit: { fontSize: 14, color: Colors.light.textSecondary, marginTop: -4 },

  peopleTagRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  peopleTag: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
    backgroundColor: "#F5F5F5",
  },
  peopleTagActive: { backgroundColor: "#3DAA6F" },
  peopleTagText: { fontSize: 12, fontWeight: "600", color: Colors.light.textSecondary },
  peopleTagTextActive: { color: "#fff" },

  previewCard: {
    backgroundColor: "#F8FFF9", borderRadius: 18, padding: 18, gap: 14,
    borderWidth: 1, borderColor: "#D0EEE3",
  },
  previewTitle: { fontSize: 14, fontWeight: "700", color: "#1A3D2B" },
  previewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  previewItem: { alignItems: "center", gap: 4 },
  previewVal: { fontSize: 22, fontWeight: "800", color: "#1A3D2B" },
  previewLabel: { fontSize: 12, color: Colors.light.textSecondary },
  previewDivider: { width: 1, height: 40, backgroundColor: "#D0EEE3" },

  startBtnWrap: { paddingHorizontal: 16, paddingTop: 8 },
  startBtn: {
    borderRadius: 28, overflow: "hidden",
    shadowColor: "#1E7E4F", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
  },
  startBtnGradient: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 18,
  },
  startBtnText: { fontSize: 18, fontWeight: "800", color: "#fff" },

  // Roaming phase header
  roamHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EEE",
    zIndex: 10,
  },
  roamHeaderCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  roamStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3DAA6F" },
  roamHeaderTitle: { fontSize: 16, fontWeight: "700", color: Colors.light.text },
  roamHeaderSub: { fontSize: 12, color: Colors.light.textSecondary },

  // Map
  mapArea: { flex: 1, backgroundColor: "#E8E8E8" },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Gait panel
  gaitPanel: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 16,
    overflow: "hidden",
  },
  gaitHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, paddingHorizontal: 20,
  },
  gaitHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  gaitIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(61,170,111,0.2)", alignItems: "center", justifyContent: "center",
  },
  gaitTitle: { fontSize: 16, fontWeight: "800", color: "#fff" },
  gaitSubtitle: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  gaitSpeedWrap: { alignItems: "flex-end" },
  gaitSpeedVal: { fontSize: 28, fontWeight: "900", color: "#fff", lineHeight: 30 },
  gaitSpeedUnit: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "600" },
  gaitSpeedLabel: { fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 },

  gaitGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 12, paddingVertical: 12, gap: 8,
  },
  gaitMetricCard: {
    flex: 1, minWidth: "45%",
    backgroundColor: "#F6F6F8", borderRadius: 14, padding: 14,
    alignItems: "flex-start", gap: 2,
  },
  gaitMetricLabel: { fontSize: 11, color: Colors.light.textSecondary, fontWeight: "600", letterSpacing: 0.3 },
  gaitMetricVal: { fontSize: 26, fontWeight: "800", color: Colors.light.text, lineHeight: 30 },
  gaitMetricUnit: { fontSize: 12, color: Colors.light.textSecondary },
  gaitLoadRow: { flexDirection: "row", alignItems: "center", gap: 4 },
});
