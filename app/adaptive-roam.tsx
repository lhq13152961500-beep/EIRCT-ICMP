import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
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
import { Accelerometer, Pedometer } from "expo-sensors";
import { getApiUrl } from "@/lib/query-client";
import { roamSession } from "@/lib/roam-session";
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

const ROUTE_LEVELS = [
  { ids: ["1","9","8","10","11","7"],                              color: "#9B59B6", stops: 6,  km: 1.8, label: "精华路线" },
  { ids: ["1","2","3","10","13","12","7","11"],                    color: "#E8873A", stops: 8,  km: 2.5, label: "经典路线" },
  { ids: ["1","9","7","12","4","8","5","10","2","3","6","11"],     color: "#3DAA6F", stops: 12, km: 4.2, label: "全览路线" },
];

const INTEREST_LABELS: Record<string, string> = {
  culture: "文化建筑",
  folk: "民俗体验",
  food: "特色美食",
  nature: "自然景观",
};

function timeToLevel(hours: number) {
  if (hours <= 1) return 0;
  if (hours <= 2) return 1;
  return 2;
}

export default function AdaptiveRoamScreen() {
  const insets = useSafeAreaInsets();
  const savedSession = roamSession.get();

  const [phase, setPhase]       = useState<"setup" | "roaming">(savedSession ? "roaming" : "setup");
  const [selectedTime, setTime] = useState<number>(savedSession?.selectedTime ?? 1.5);
  const [people, setPeople]     = useState<number>(savedSession?.people ?? 2);

  const [mapReady, setMapReady] = useState(false);
  const webViewRef              = useRef<WebView>(null);

  const [arpRouteLevel, setArpRouteLevel] = useState<number>(
    savedSession?.arpRouteLevel ?? timeToLevel(savedSession?.selectedTime ?? 1.5)
  );
  const prevArpStateRef = useRef<string>("活跃");

  // ── Real sensor state ─────────────────────────────────────────
  const [speed,       setSpeed]     = useState(0);
  const [stepLen,     setStepLen]   = useState(0);
  const [freq,        setFreq]      = useState(0);
  const [stability,   setStability] = useState(100);
  const [sensorReady, setSensorReady] = useState(false);

  // Accelerometer rolling buffer for stability
  const accelBuf        = useRef<number[]>([]);
  // Pedometer reference for cadence calculation
  const pedoRef         = useRef<{ count: number; time: number } | null>(null);
  // Fallback to simulation when sensors unavailable
  const useFallback     = useRef(false);

  // ── Interest preference tracking ──────────────────────────────
  // Categories: culture, folk, food, nature
  const interestRef = useRef<Record<string, number>>({ culture: 0, folk: 0, food: 0, nature: 0 });
  const [topInterest, setTopInterest] = useState<string>("culture");
  const interestTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rest frequency: count "rest" events (speed drop below 1.5 km/h)
  const restCountRef  = useRef(0);
  const wasRestingRef = useRef(false);

  const panelAnim = useRef(new Animated.Value(0)).current;

  const injectJs = useCallback((js: string) => {
    webViewRef.current?.injectJavaScript(js + "; true;");
  }, []);

  // ── Draw route when map ready ─────────────────────────────────
  useEffect(() => {
    if (!mapReady || phase !== "roaming") return;
    const route = ROUTE_LEVELS[arpRouteLevel];
    injectJs(`window.setMyLocation && window.setMyLocation(89.5971, 42.8603);`);
    injectJs(`window.drawRoute && window.drawRoute(${JSON.stringify(route.ids)}, ${JSON.stringify(route.color)});`);
  }, [mapReady, phase]); // eslint-disable-line

  // ── Persist arpRouteLevel ─────────────────────────────────────
  useEffect(() => {
    if (phase === "roaming") roamSession.update({ arpRouteLevel });
  }, [arpRouteLevel, phase]);

  // ── ARP state transition ──────────────────────────────────────
  useEffect(() => {
    if (phase !== "roaming" || !mapReady || !sensorReady) return;
    // Don't trigger route changes while user hasn't started walking yet
    if (!useFallback.current && speed === 0) return;

    const arpState = speed >= 3.0 ? "活跃" : speed >= 1.2 ? "适中" : "疲劳预警";
    if (arpState === prevArpStateRef.current) return;
    prevArpStateRef.current = arpState;

    setArpRouteLevel(prev => {
      let next = prev;
      if (arpState === "活跃")        next = Math.min(prev + 1, ROUTE_LEVELS.length - 1);
      else if (arpState === "疲劳预警") next = Math.max(prev - 1, 0);
      if (next !== prev) {
        const route = ROUTE_LEVELS[next];
        injectJs(`window.drawRoute && window.drawRoute(${JSON.stringify(route.ids)}, ${JSON.stringify(route.color)});`);
        setArpAccepted(false);
      }
      return next;
    });
  }, [speed, phase, mapReady, sensorReady, injectJs]);

  // ── Real sensor subscription ──────────────────────────────────
  // Strategy: Accelerometer (no permission) handles BOTH stability AND step detection.
  // Pedometer is tried as an enhancement; if denied/blocked at OS level, accel takes over.
  useEffect(() => {
    if (phase !== "roaming") return;

    let pedometerSub: { remove: () => void } | null = null;
    let accelSub: { remove: () => void } | null = null;

    // Step detection — dual-EMA band-pass approach
    // fastMag (τ≈110ms): smooths noise, preserves step rhythm (~1-2 Hz)
    // slowMag (τ≈1300ms): tracks gravity/orientation drift only
    // dev = fastMag - slowMag isolates the walking signal
    let fastMag = -1;
    let slowMag = -1;
    let prevDev  = 0;
    let lastStepTime = 0;
    const stepTimes: number[] = [];
    let pedoActive = false;

    // Mark sensor ready immediately
    setSensorReady(true);
    useFallback.current = false;

    // 40ms = 25 Hz — good resolution for walking (~1-2 Hz steps)
    Accelerometer.setUpdateInterval(40);
    accelSub = Accelerometer.addListener(({ x, y, z }) => {
      const mag = Math.sqrt(x * x + y * y + z * z);

      // ── Stability (rolling variance, 50 samples ≈ 2 s) ──────────
      accelBuf.current.push(mag);
      if (accelBuf.current.length > 50) accelBuf.current.shift();
      if (accelBuf.current.length >= 15) {
        const mean = accelBuf.current.reduce((a, b) => a + b, 0) / accelBuf.current.length;
        const variance = accelBuf.current.reduce((a, b) => a + (b - mean) ** 2, 0) / accelBuf.current.length;
        setStability(Math.round(Math.max(62, Math.min(100, 100 - variance * 14))));
      }

      // ── Step detection (skipped when pedometer provides data) ────
      if (pedoActive) return;

      if (fastMag < 0) { fastMag = mag; slowMag = mag; return; }

      // Dual EMA: τ_fast≈110ms (α=0.70), τ_slow≈1300ms (α=0.97)
      fastMag = 0.70 * fastMag + 0.30 * mag;
      slowMag = 0.97 * slowMag + 0.03 * mag;
      const dev = fastMag - slowMag;  // band-pass walking signal

      const now = Date.now();
      if (now % 2000 < 40) {
        console.log(`[Accel] mag=${mag.toFixed(3)} fast=${fastMag.toFixed(3)} slow=${slowMag.toFixed(3)} dev=${dev.toFixed(3)} steps=${stepTimes.length}`);
      }

      // Positive zero-crossing with threshold ≥0.08g
      // fast-slow band-pass reliably oscillates ±0.15-0.30g during normal walking
      if (prevDev < 0 && dev >= 0.08 && (now - lastStepTime) > 250) {
        lastStepTime = now;

        // Rolling 8-second window (more stable cadence average)
        stepTimes.push(now);
        const cutoff = now - 8000;
        let i = 0;
        while (i < stepTimes.length && stepTimes[i] < cutoff) i++;
        if (i > 0) stepTimes.splice(0, i);

        if (stepTimes.length >= 3) {
          // cadence derived from average interval between detected steps
          const intervals: number[] = [];
          for (let j = 1; j < stepTimes.length; j++) {
            intervals.push(stepTimes[j] - stepTimes[j - 1]);
          }
          const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const cadence = Math.round(60000 / avgIntervalMs);
          const clamped = Math.max(0, Math.min(200, cadence));
          const sl  = +(Math.min(0.90, Math.max(0.35, 0.35 + clamped * 0.003))).toFixed(2);
          const spd = +Math.min(8, Math.max(0, (clamped * sl / 60) * 3.6)).toFixed(1);

          console.log(`[Accel] cadence=${clamped} sl=${sl} spd=${spd}`);
          setFreq(clamped);
          setStepLen(sl);
          setSpeed(spd);

          if (spd < 1.0) {
            if (!wasRestingRef.current) { restCountRef.current += 1; wasRestingRef.current = true; }
          } else { wasRestingRef.current = false; }
        }
      }
      prevDev = dev;
    });

    // Decay timer: if no step for 5 s, reset speed/cadence to 0
    const decayTimer = setInterval(() => {
      if (!pedoActive && Date.now() - lastStepTime > 5000) {
        setSpeed(0); setFreq(0); setStepLen(0);
      }
    }, 1000);

    // Also try pedometer — if it works, prefer it over accel-based step detection
    (async () => {
      await Pedometer.requestPermissionsAsync().catch(() => {});
      const isAvail = await Pedometer.isAvailableAsync().catch(() => false);

      if (!isAvail) return;
      try {
        pedometerSub = Pedometer.watchStepCount(result => {
          pedoActive = true; // suppress accel step detection
          const now = Date.now();
          const ref = pedoRef.current;
          if (ref) {
            const dtMin = (now - ref.time) / 60000;
            if (dtMin >= 0.08) {
              const stepsInWindow = result.steps - ref.count;
              const cadence = Math.round(stepsInWindow / dtMin);
              const clamped = Math.max(0, Math.min(220, cadence));
              const sl  = +(Math.min(0.90, Math.max(0.35, 0.35 + clamped * 0.003))).toFixed(2);
              const spd = +Math.min(9, Math.max(0, (clamped * sl / 60) * 3.6)).toFixed(1);
              setFreq(clamped); setStepLen(sl); setSpeed(spd);
              if (spd < 1.0) {
                if (!wasRestingRef.current) { restCountRef.current += 1; wasRestingRef.current = true; }
              } else { wasRestingRef.current = false; }
              pedoRef.current = { count: result.steps, time: now };
            }
          } else {
            pedoRef.current = { count: result.steps, time: now };
          }
        });
      } catch { /* pedometer blocked — accelerometer handles it */ }
    })();

    return () => {
      pedometerSub?.remove();
      accelSub?.remove();
      clearInterval(decayTimer);
      accelBuf.current = [];
      pedoRef.current = null;
    };
  }, [phase]);

  // ── Interest preference accumulation ─────────────────────────
  useEffect(() => {
    if (phase !== "roaming") return;
    // Every 30 s of activity, accumulate interest based on speed & route
    interestTimerRef.current = setInterval(() => {
      if (speed < 0.5) return; // not moving
      const routePoiIds = ROUTE_LEVELS[arpRouteLevel].ids;
      // Weight interest by POI types in current route
      const culturePois = ["2","3","4","5","12"];
      const folkPois    = ["6","7"];
      const foodPois    = ["8","9","10","11"];
      const cultureHits = routePoiIds.filter(id => culturePois.includes(id)).length;
      const folkHits    = routePoiIds.filter(id => folkPois.includes(id)).length;
      const foodHits    = routePoiIds.filter(id => foodPois.includes(id)).length;

      interestRef.current.culture += cultureHits * 2;
      interestRef.current.folk    += folkHits    * 2;
      interestRef.current.food    += foodHits    * 2;
      interestRef.current.nature  += 1;

      // Find dominant interest
      const top = Object.entries(interestRef.current).sort((a, b) => b[1] - a[1])[0][0];
      setTopInterest(top);
    }, 30000);

    return () => {
      if (interestTimerRef.current) clearInterval(interestTimerRef.current);
    };
  }, [phase, speed, arpRouteLevel]);

  // ── Panel animation ───────────────────────────────────────────
  useEffect(() => {
    if (phase === "roaming") {
      Animated.spring(panelAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 9 }).start();
    } else {
      panelAnim.setValue(0);
    }
  }, [phase, panelAnim]);

  const handleStart = () => {
    haptic("medium");
    const level = timeToLevel(selectedTime);
    setArpRouteLevel(level);
    prevArpStateRef.current = "活跃";
    setSensorReady(false);
    setArpAccepted(false);
    interestRef.current = { culture: 0, folk: 0, food: 0, nature: 0 };
    restCountRef.current = 0;
    wasRestingRef.current = false;
    roamSession.start({ selectedTime, people, arpRouteLevel: level });
    setPhase("roaming");
  };

  const handleBack = () => {
    haptic();
    if (phase === "roaming") {
      roamSession.update({ arpRouteLevel });
      if (router.canGoBack()) router.back(); else router.replace("/map-guide");
      return;
    }
    if (router.canGoBack()) router.back(); else router.replace("/");
  };

  const handleCancel = () => {
    haptic("medium");
    roamSession.stop();
    if (router.canGoBack()) router.back(); else router.replace("/map-guide");
  };

  const handleWebViewMessage = useCallback((e: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "ready") setMapReady(true);
    } catch {}
  }, []);

  const panelTranslateY = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [240, 0] });

  const [arpModalVisible, setArpModalVisible] = useState(false);
  const [arpAccepted, setArpAccepted]         = useState(false);

  // Derived ARP state
  // "等待步行" when real sensor is active but user not moving yet (speed=0, not fallback)
  const isWaiting = sensorReady && !useFallback.current && speed === 0;
  const arpLevel: string = isWaiting ? "等待步行"
    : speed >= 3.0 ? "活跃" : speed >= 1.2 ? "适中" : "疲劳预警";
  const arpColor = isWaiting ? "#78909C"
    : speed >= 3.0 ? "#3DAA6F" : speed >= 1.2 ? "#2196F3" : "#E8873A";
  const arpIcon: keyof typeof MaterialCommunityIcons.glyphMap = isWaiting ? "walk"
    : speed >= 3.0 ? "lightning-bolt" : speed >= 1.2 ? "chart-line" : "alert-circle-outline";

  const currentRoute = ROUTE_LEVELS[arpRouteLevel];
  const baseLevel    = timeToLevel(selectedTime);
  const baseRoute    = ROUTE_LEVELS[baseLevel];
  const kmDiff       = +(currentRoute.km - baseRoute.km).toFixed(1);
  const stopsDiff    = currentRoute.stops - baseRoute.stops;

  const interestLabel  = INTEREST_LABELS[topInterest] ?? "文化建筑";
  // Show real values (including 0) once sensor is confirmed; "--" only during init
  const speedDisplay   = sensorReady ? speed.toFixed(1) : "--";
  const freqDisplay    = sensorReady ? String(freq) : "--";
  const stepLenDisplay = sensorReady ? stepLen.toFixed(2) : "--";

  // ── SETUP PHASE ───────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <LinearGradient colors={["#fff", "#F8F5F0"]} style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.backBtn} onPress={handleBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>自适应漫游</Text>
            <Text style={styles.headerSub}>ARP智能规划 · 步态感知</Text>
          </View>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <ScrollView contentContainerStyle={[styles.setupContent, { paddingBottom: insets.bottom + 32 }]}>

          {/* ARP description banner */}
          <LinearGradient colors={["#E8F5F0", "#D0EEE3"]} style={styles.banner}>
            <MaterialCommunityIcons name="walk" size={42} color="#3DAA6F" />
            <Text style={styles.bannerTitle}>ARP 自适应路线规划机制</Text>
            <Text style={styles.bannerDesc}>
              融合步态分析算法，实时分析步长、步频、步速与稳定性。当检测到您在某景点停留时间延长，将其标记为更高兴趣偏好，后续优先推荐同类文化景点；若监测到步速放缓、休息频次增加，自动缩减路径或插入休息节点，避免疲劳影响游览体验。
            </Text>
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

          {/* Route preview */}
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

          {/* Sensor hint */}
          <View style={styles.sensorHintCard}>
            <Ionicons name="hardware-chip-outline" size={16} color="#3DAA6F" />
            <Text style={styles.sensorHintText}>
              漫游开始后将读取手机传感器数据，实时分析步态参数
            </Text>
          </View>

        </ScrollView>

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
        <Pressable style={styles.cancelBtn} onPress={handleCancel} hitSlop={12}>
          <Text style={styles.cancelBtnText}>取消</Text>
        </Pressable>
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
              <View style={styles.gaitSensorRow}>
                <View style={[styles.gaitSensorDot, { backgroundColor: sensorReady ? "#3DAA6F" : "#FFA726" }]} />
                <Text style={styles.gaitSubtitle}>
                  {sensorReady ? (useFallback.current ? "仿真模式" : "传感器实时") : "传感器初始化…"}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.gaitSpeedWrap}>
            <Text style={styles.gaitSpeedVal}>{speedDisplay}</Text>
            <Text style={styles.gaitSpeedUnit}>km/h</Text>
            <Text style={styles.gaitSpeedLabel}>当前步速</Text>
          </View>
        </LinearGradient>

        {/* Metric grid */}
        <View style={styles.gaitGrid}>
          <View style={styles.gaitMetricCard}>
            <Text style={styles.gaitMetricLabel}>步长</Text>
            <Text style={styles.gaitMetricVal}>{stepLenDisplay}</Text>
            <Text style={styles.gaitMetricUnit}>米</Text>
          </View>
          <View style={styles.gaitMetricCard}>
            <Text style={styles.gaitMetricLabel}>步频</Text>
            <Text style={styles.gaitMetricVal}>{freqDisplay}</Text>
            <Text style={styles.gaitMetricUnit}>步/分钟</Text>
          </View>
          <View style={styles.gaitMetricCard}>
            <Text style={styles.gaitMetricLabel}>稳定性</Text>
            <Text style={styles.gaitMetricVal}>{stability}</Text>
            <Text style={styles.gaitMetricUnit}>%</Text>
          </View>
          <Pressable
            style={[styles.gaitMetricCard, { backgroundColor: arpColor + "18" }]}
            onPress={() => { haptic("medium"); setArpModalVisible(true); }}
          >
            <View style={styles.gaitArpLabelRow}>
              <Text style={styles.gaitMetricLabel}>ARP规划</Text>
              <MaterialCommunityIcons name={arpIcon} size={13} color={arpColor} />
            </View>
            <Text style={[styles.gaitMetricVal, { color: arpColor }]}>{arpLevel}</Text>
            <Text style={[styles.gaitMetricUnit, { color: arpColor }]}>点击查看详情</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* ARP Modal */}
      <Modal
        visible={arpModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setArpModalVisible(false)}
      >
        <Pressable style={styles.arpOverlay} onPress={() => setArpModalVisible(false)}>
          <View style={styles.arpModal}>

            <View style={styles.arpModalIconWrap}>
              <MaterialCommunityIcons name={arpIcon} size={28} color={arpColor} />
            </View>

            <Text style={styles.arpModalTitle}>
              {arpLevel === "等待步行"
                ? "传感器就绪：等待步行开始"
                : arpLevel === "疲劳预警"
                ? "检测到疲劳：正在优化路线"
                : arpLevel === "适中"
                ? "步态良好：路线持续分析中"
                : "活跃状态：推荐探索更多景点"}
            </Text>
            <Text style={styles.arpModalSub}>
              ARP Bio-Sync 自适应规划 · 已激活
              {restCountRef.current > 0 ? `  ·  休息 ${restCountRef.current} 次` : ""}
            </Text>

            {/* Real-time gait data row */}
            <View style={styles.arpGaitRow}>
              <View style={styles.arpGaitItem}>
                <Text style={styles.arpGaitVal}>{speedDisplay}</Text>
                <Text style={styles.arpGaitLabel}>步速 km/h</Text>
              </View>
              <View style={styles.arpGaitDivider} />
              <View style={styles.arpGaitItem}>
                <Text style={styles.arpGaitVal}>{freqDisplay}</Text>
                <Text style={styles.arpGaitLabel}>步频 步/分</Text>
              </View>
              <View style={styles.arpGaitDivider} />
              <View style={styles.arpGaitItem}>
                <Text style={styles.arpGaitVal}>{stability}</Text>
                <Text style={styles.arpGaitLabel}>稳定性 %</Text>
              </View>
            </View>

            {/* Interest preference */}
            <View style={[styles.arpInterestRow, { borderColor: arpColor + "44" }]}>
              <MaterialCommunityIcons name="heart-pulse" size={15} color={arpColor} />
              <Text style={[styles.arpInterestText, { color: arpColor }]}>
                当前偏好：{interestLabel}
              </Text>
            </View>

            {/* Route comparison */}
            <View style={styles.arpRouteCard}>
              <View style={styles.arpRouteCol}>
                <Text style={styles.arpRouteColLabel}>原始路线</Text>
                <Text style={styles.arpRouteKm}>{baseRoute.km}km</Text>
                <Text style={styles.arpRouteTime}>{baseRoute.stops}个景点</Text>
              </View>
              <View style={styles.arpRouteDivider} />
              <View style={[styles.arpRouteCol, { alignItems: "flex-end" }]}>
                <Text style={[styles.arpRouteColLabel, { color: arpColor }]}>
                  {arpLevel === "活跃" ? "扩展后" : arpLevel === "疲劳预警" ? "优化后" : "当前路线"}
                </Text>
                <View style={styles.arpOptRow}>
                  {kmDiff !== 0 && (
                    <Text style={[styles.arpSavedKm, { color: arpColor }]}>
                      {kmDiff > 0 ? `+${kmDiff}` : `${kmDiff}`}km
                    </Text>
                  )}
                  <Text style={styles.arpRouteKm}>{currentRoute.km}km</Text>
                </View>
                <Text style={[styles.arpRouteTime, { color: arpColor }]}>
                  {currentRoute.stops}个景点
                  {stopsDiff !== 0 ? (stopsDiff > 0 ? ` (+${stopsDiff})` : ` (${stopsDiff})`) : ""}
                </Text>
              </View>
            </View>

            <Text style={styles.arpModalDesc}>
              {arpLevel === "等待步行"
                ? `手机计步器已就绪，正在监听步态数据。请开始行走，系统将实时分析您的步频、步速与稳定性，并自动调整路线方案。`
                : arpLevel === "疲劳预警"
                ? `步速放缓至 ${speedDisplay} km/h，休息频次增加${restCountRef.current > 0 ? `（已记录 ${restCountRef.current} 次）` : ""}，路径已从 ${baseRoute.km}km 缩减至 ${currentRoute.km}km，并插入休息节点，避免疲劳影响游览体验。`
                : arpLevel === "适中"
                ? `步态稳定，稳定性 ${stability}%。系统已识别您对${interestLabel}的偏好，后续将优先推荐同类景点。`
                : `步速活跃（${speedDisplay} km/h），系统已为您扩展路线至 ${currentRoute.stops} 个景点（+${stopsDiff}），推荐探索更多${interestLabel}类景区。`}
            </Text>

            {arpAccepted ? (
              <View style={[styles.arpAcceptedBtn, { backgroundColor: arpColor + "22", borderColor: arpColor }]}>
                <Ionicons name="checkmark-circle" size={18} color={arpColor} />
                <Text style={[styles.arpAcceptedText, { color: arpColor }]}>已应用优化方案</Text>
              </View>
            ) : (
              <Pressable
                style={[styles.arpActionBtn, { backgroundColor: arpColor }]}
                onPress={() => {
                  haptic("medium");
                  setArpAccepted(true);
                  setTimeout(() => setArpModalVisible(false), 800);
                }}
              >
                <Text style={styles.arpActionBtnText}>
                  {arpLevel === "等待步行" ? "知道了，开始行走"
                    : arpLevel === "疲劳预警" ? "接受优化路线"
                    : arpLevel === "适中" ? "应用偏好推荐"
                    : "探索延伸景点"}
                </Text>
                <Ionicons name="navigate" size={16} color="#fff" />
              </Pressable>
            )}

            <Pressable onPress={() => setArpModalVisible(false)} style={styles.arpCloseBtn}>
              <Text style={styles.arpCloseText}>稍后再说</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

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

  setupContent: { padding: 16, gap: 14 },
  banner: { borderRadius: 18, padding: 20, alignItems: "center", gap: 10 },
  bannerTitle: { fontSize: 16, fontWeight: "800", color: "#1A3D2B", textAlign: "center" },
  bannerDesc: {
    fontSize: 13, color: "#2D5E3A", lineHeight: 20, textAlign: "center",
  },

  sensorHintCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#E8F5F0", borderRadius: 14, padding: 14,
  },
  sensorHintText: { flex: 1, fontSize: 13, color: "#2D5E3A", lineHeight: 18 },

  card: {
    backgroundColor: "#fff", borderRadius: 18, padding: 18,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3,
    gap: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: Colors.light.text },

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
  peopleTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: "#F5F5F5" },
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

  // Roaming header
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
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: "#F5F5F5", minWidth: 52, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontWeight: "600", color: "#E53935" },

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
  gaitSensorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  gaitSensorDot: { width: 6, height: 6, borderRadius: 3 },
  gaitSubtitle: { fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: "500" },
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
  gaitArpLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },

  // ARP Modal
  arpOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  arpModal: {
    width: "100%", backgroundColor: "#fff", borderRadius: 28,
    padding: 24, alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 20,
  },
  arpModalIconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "#E8F5F0", alignItems: "center", justifyContent: "center",
  },
  arpModalTitle: { fontSize: 17, fontWeight: "800", color: Colors.light.text, textAlign: "center", lineHeight: 24 },
  arpModalSub: { fontSize: 11, color: Colors.light.textSecondary, textAlign: "center" },

  arpGaitRow: {
    flexDirection: "row", width: "100%", backgroundColor: "#F6F6F8",
    borderRadius: 14, padding: 14, alignItems: "center", justifyContent: "space-around",
  },
  arpGaitItem: { alignItems: "center", gap: 3 },
  arpGaitVal: { fontSize: 20, fontWeight: "800", color: Colors.light.text },
  arpGaitLabel: { fontSize: 10, color: Colors.light.textSecondary, fontWeight: "600" },
  arpGaitDivider: { width: 1, height: 32, backgroundColor: "#E0E0E0" },

  arpInterestRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, alignSelf: "center",
  },
  arpInterestText: { fontSize: 13, fontWeight: "700" },

  arpRouteCard: {
    flexDirection: "row", width: "100%", backgroundColor: "#F6F6F8",
    borderRadius: 18, padding: 18, alignItems: "center",
  },
  arpRouteCol: { flex: 1, gap: 4 },
  arpRouteColLabel: { fontSize: 10, fontWeight: "700", color: Colors.light.textSecondary, letterSpacing: 0.5, textTransform: "uppercase" },
  arpRouteKm: { fontSize: 28, fontWeight: "900", color: Colors.light.text },
  arpRouteTime: { fontSize: 13, color: Colors.light.textSecondary, fontWeight: "600" },
  arpRouteDivider: { width: 1, height: 50, backgroundColor: "#E0E0E0", marginHorizontal: 16 },
  arpOptRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  arpSavedKm: { fontSize: 13, fontWeight: "700" },

  arpModalDesc: { fontSize: 13, color: Colors.light.textSecondary, lineHeight: 20, textAlign: "center" },
  arpActionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, width: "100%", paddingVertical: 16, borderRadius: 20,
  },
  arpActionBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  arpAcceptedBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, width: "100%", paddingVertical: 14, borderRadius: 20, borderWidth: 1.5,
  },
  arpAcceptedText: { fontSize: 15, fontWeight: "700" },
  arpCloseBtn: { paddingVertical: 4 },
  arpCloseText: { fontSize: 13, color: Colors.light.textSecondary },
});
