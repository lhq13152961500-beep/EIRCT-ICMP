"use no memo";
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Image,
  ScrollView,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";

const { width: SW, height: SH } = Dimensions.get("window");
const PRIMARY = Colors.light.primary;

type Phase = "idle" | "scanning" | "ar" | "model3d";

/* ── Floating ring decoration ── */
function PulseRing({ delay, size }: { delay: number; size: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{
      position: "absolute",
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 1.5, borderColor: PRIMARY,
      opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] }),
      transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.5] }) }],
    }} />
  );
}

/* ── Floating AR marker dot ── */
function ArMarker({ x, y, label, delay }: { x: number; y: number; label: string; delay: number }) {
  const appear = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(appear, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -6, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    setTimeout(() => loop.start(), delay);
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[styles.arMarker, { left: x, top: y, opacity: appear, transform: [{ scale: appear }, { translateY: bob }] }]}>
      <View style={styles.arMarkerDot} />
      <View style={styles.arMarkerLine} />
      <View style={styles.arMarkerLabel}>
        <Text style={styles.arMarkerText}>{label}</Text>
      </View>
    </Animated.View>
  );
}

export default function ArTourScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [phase, setPhase] = useState<Phase>("idle");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"ar" | "3d">("ar");
  const [scanProgress, setScanProgress] = useState(0);

  const btnScale = useRef(new Animated.Value(1)).current;
  const btnY = useRef(new Animated.Value(0)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const scanProgress3d = useRef(new Animated.Value(0)).current;
  const modelRotate = useRef(new Animated.Value(0)).current;

  /* ── Scan line animation ── */
  useEffect(() => {
    if (phase !== "ar" && phase !== "model3d") return;
    const loop = Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);

  /* ── 3D model rotation ── */
  useEffect(() => {
    if (viewMode !== "3d") return;
    const loop = Animated.loop(
      Animated.timing(modelRotate, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [viewMode]);

  const handleStart = async () => {
    /* Button shrink + move animation */
    Animated.parallel([
      Animated.spring(btnScale, { toValue: 0.82, useNativeDriver: true, friction: 6 }),
    ]).start();

    setPhase("scanning");

    /* Progress simulation */
    let p = 0;
    const iv = setInterval(() => {
      p += 4;
      setScanProgress(Math.min(p, 100));
      if (p >= 100) clearInterval(iv);
    }, 40);

    /* Launch camera */
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        setTimeout(() => {
          setPhase("ar");
          setScanProgress(100);
        }, 2000);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.85,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (_) {}
    setTimeout(() => {
      setPhase("ar");
      setScanProgress(100);
    }, 800);
  };

  const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [0, SH * 0.55] });
  const rotateDeg = modelRotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  /* ════════════════ IDLE ════════════════ */
  if (phase === "idle") {
    return (
      <View style={styles.root}>
        <LinearGradient colors={["#0A1628", "#0D2B1A", "#0A1628"]} style={StyleSheet.absoluteFill} />

        {/* Starfield dots */}
        {Array.from({ length: 30 }).map((_, i) => (
          <View key={i} style={[styles.star, {
            left: (i * 137.5) % SW, top: (i * 97.3) % (SH * 0.75),
            width: i % 3 === 0 ? 2 : 1.5, height: i % 3 === 0 ? 2 : 1.5,
            opacity: 0.3 + (i % 5) * 0.1,
          }]} />
        ))}

        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>AR 实景畅游</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Center content */}
        <View style={styles.idleCenter}>
          {/* Pulse rings */}
          <PulseRing size={260} delay={0} />
          <PulseRing size={200} delay={600} />
          <PulseRing size={140} delay={1200} />

          {/* Center icon circle */}
          <View style={styles.idleCircle}>
            <LinearGradient colors={[PRIMARY + "CC", "#1A6A3A"]} style={styles.idleCircleInner}>
              <Ionicons name="camera-outline" size={44} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={styles.idleTitle}>AR 实景畅游</Text>
          <Text style={styles.idleSub}>
            {"将镜头对准周边建筑与景点\n即可触发沉浸式 AR 体验"}
          </Text>

          {/* Feature tags */}
          <View style={styles.idleTags}>
            {["3D 建模识别", "文化讲解", "历史层叠", "实时标注"].map((t) => (
              <View key={t} style={styles.idleTag}>
                <Text style={styles.idleTagText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA Button */}
        <View style={[styles.idleBottom, { paddingBottom: insets.bottom + 40 }]}>
          <Pressable style={styles.startBtn} onPress={handleStart} android_ripple={{ color: PRIMARY + "44" }}>
            <LinearGradient colors={[PRIMARY, "#2D8A55"]} style={styles.startBtnGrad}>
              <Ionicons name="scan-outline" size={22} color="#fff" />
              <Text style={styles.startBtnText}>点击开启 AR 之旅</Text>
              <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </Pressable>
          <Text style={styles.idleHint}>首次使用需授权相机权限</Text>
        </View>
      </View>
    );
  }

  /* ════════════════ SCANNING ════════════════ */
  if (phase === "scanning") {
    return (
      <View style={styles.root}>
        <LinearGradient colors={["#050D10", "#071A12"]} style={StyleSheet.absoluteFill} />
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <Pressable style={styles.backBtn} onPress={() => { setPhase("idle"); setScanProgress(0); }}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>初始化 AR 引擎</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.scanCenter}>
          <View style={styles.scanCorners}>
            {["tl", "tr", "bl", "br"].map((pos) => (
              <View key={pos} style={[styles.corner,
                pos.includes("t") ? { top: 0 } : { bottom: 0 },
                pos.includes("l") ? { left: 0 } : { right: 0 },
                pos.includes("b") ? { borderTopWidth: 0, borderRightWidth: pos === "bl" ? 0 : undefined, borderLeftWidth: pos === "br" ? 0 : undefined } : { borderBottomWidth: 0, borderRightWidth: pos === "tl" ? 0 : undefined, borderLeftWidth: pos === "tr" ? 0 : undefined },
              ]} />
            ))}
            <Text style={styles.scanText}>正在识别建筑结构...</Text>
          </View>
          <View style={styles.scanProgressWrap}>
            <View style={[styles.scanProgressBar, { width: `${scanProgress}%` as any }]} />
          </View>
          <Text style={styles.scanPct}>{scanProgress}%</Text>
          <Text style={styles.scanHint}>请保持相机稳定，对准建筑物</Text>
        </View>

        {/* Bottom shutter */}
        <View style={[styles.shutterWrap, { paddingBottom: insets.bottom + 32 }]}>
          <Animated.View style={[styles.shutterBtn, { transform: [{ scale: btnScale }] }]}>
            <LinearGradient colors={[PRIMARY, "#2D8A55"]} style={styles.shutterGrad}>
              <Ionicons name="camera" size={32} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Text style={styles.shutterHint}>AR 摄像头已激活</Text>
        </View>
      </View>
    );
  }

  /* ════════════════ AR RESULT ════════════════ */
  return (
    <View style={styles.root}>
      {/* Background: photo or dark */}
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <LinearGradient colors={["#0D2010", "#0A1628", "#071A0F"]} style={StyleSheet.absoluteFill} />
      )}

      {/* Dark overlay */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.38)" }]} />

      {/* Scan line */}
      {viewMode === "ar" && (
        <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>AR 实景畅游</Text>
        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeBtn, viewMode === "ar" && styles.modeBtnActive]}
            onPress={() => setViewMode("ar")}
          >
            <Text style={[styles.modeBtnText, viewMode === "ar" && styles.modeBtnTextActive]}>AR</Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, viewMode === "3d" && styles.modeBtnActive]}
            onPress={() => setViewMode("3d")}
          >
            <Text style={[styles.modeBtnText, viewMode === "3d" && styles.modeBtnTextActive]}>3D</Text>
          </Pressable>
        </View>
      </View>

      {/* AR markers */}
      {viewMode === "ar" && (
        <>
          <ArMarker x={SW * 0.12} y={SH * 0.18} label="古建筑群 · 清代" delay={400} />
          <ArMarker x={SW * 0.58} y={SH * 0.24} label="非遗传承地" delay={900} />
          <ArMarker x={SW * 0.3} y={SH * 0.42} label="距您 120m" delay={1400} />
        </>
      )}

      {/* 3D Model view */}
      {viewMode === "3d" && (
        <View style={styles.model3dWrap}>
          <Animated.View style={[styles.model3dBox, { transform: [{ rotateY: rotateDeg }] }]}>
            <LinearGradient colors={[PRIMARY + "99", "#2D8A5599"]} style={styles.model3dFace}>
              <Ionicons name="business-outline" size={36} color="#fff" />
              <Text style={styles.model3dLabel}>3D 建筑模型</Text>
              <Text style={styles.model3dSub}>古风建筑群 · 清代</Text>
            </LinearGradient>
          </Animated.View>
          <Text style={styles.model3dHint}>拖动旋转 · 双指缩放</Text>
        </View>
      )}

      {/* Bottom info panel */}
      <View style={[styles.infoPanel, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.infoPanelHandle} />
        <View style={styles.infoPanelRow}>
          <View style={styles.infoBadge}>
            <Ionicons name="checkmark-circle" size={13} color={PRIMARY} />
            <Text style={styles.infoBadgeText}>已识别</Text>
          </View>
          <Text style={styles.infoPanelTitle}>古风建筑群 · 清代遗址</Text>
        </View>
        <Text style={styles.infoPanelDesc}>
          该建筑始建于清代乾隆年间，保留了典型的徽派建筑风格，是当地重要的文化遗产保护单位。
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.infoTagsScroll}>
          {["历史文化", "清代建筑", "徽派风格", "文保单位", "非遗体验"].map((tag) => (
            <View key={tag} style={styles.infoTag}>
              <Text style={styles.infoTagText}>{tag}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Actions */}
        <View style={styles.infoActions}>
          <Pressable style={styles.infoAction}>
            <Ionicons name="volume-high-outline" size={18} color={PRIMARY} />
            <Text style={styles.infoActionText}>语音讲解</Text>
          </Pressable>
          <Pressable style={styles.infoAction}>
            <Ionicons name="map-outline" size={18} color={PRIMARY} />
            <Text style={styles.infoActionText}>导航前往</Text>
          </Pressable>
          <Pressable style={styles.infoAction}>
            <Ionicons name="bookmark-outline" size={18} color={PRIMARY} />
            <Text style={styles.infoActionText}>收藏</Text>
          </Pressable>
          <Pressable style={styles.infoAction} onPress={handleStart}>
            <Ionicons name="camera-outline" size={18} color={PRIMARY} />
            <Text style={styles.infoActionText}>重新扫描</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#060E18" },
  star: { position: "absolute", backgroundColor: "#fff", borderRadius: 1 },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingBottom: 10,
    zIndex: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#fff" },

  /* ── Idle ── */
  idleCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  idleCircle: {
    width: 120, height: 120, borderRadius: 60,
    overflow: "hidden",
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  idleCircleInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  idleTitle: { fontSize: 24, fontWeight: "800", color: "#fff", marginTop: 8 },
  idleSub: { fontSize: 14, color: "rgba(255,255,255,0.65)", textAlign: "center", lineHeight: 22 },
  idleTags: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4, paddingHorizontal: 32 },
  idleTag: {
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  idleTagText: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  idleBottom: { alignItems: "center", gap: 10, paddingHorizontal: 32 },
  startBtn: { width: "100%", borderRadius: 28, overflow: "hidden" },
  startBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16, paddingHorizontal: 24,
  },
  startBtnText: { fontSize: 17, fontWeight: "800", color: "#fff", flex: 1, textAlign: "center" },
  idleHint: { fontSize: 12, color: "rgba(255,255,255,0.4)" },

  /* ── Scanning ── */
  scanCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24, paddingHorizontal: 40 },
  scanCorners: {
    width: 220, height: 220, position: "relative",
    alignItems: "center", justifyContent: "center",
  },
  corner: {
    position: "absolute", width: 28, height: 28,
    borderColor: PRIMARY, borderWidth: 3,
  },
  scanText: { color: "rgba(255,255,255,0.7)", fontSize: 13, textAlign: "center" },
  scanProgressWrap: {
    width: "100%", height: 4, backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2, overflow: "hidden",
  },
  scanProgressBar: { height: 4, backgroundColor: PRIMARY, borderRadius: 2 },
  scanPct: { fontSize: 28, fontWeight: "800", color: "#fff" },
  scanHint: { fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center" },
  shutterWrap: { alignItems: "center", gap: 10 },
  shutterBtn: {
    width: 76, height: 76, borderRadius: 38,
    overflow: "hidden",
    borderWidth: 3, borderColor: "rgba(255,255,255,0.3)",
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
  },
  shutterGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  shutterHint: { fontSize: 12, color: "rgba(255,255,255,0.5)" },

  /* ── AR Result ── */
  scanLine: {
    position: "absolute", left: 0, right: 0,
    height: 2, backgroundColor: PRIMARY,
    shadowColor: PRIMARY, shadowRadius: 8, shadowOpacity: 0.8,
    opacity: 0.7, zIndex: 5,
  },
  modeToggle: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12, padding: 3, gap: 2,
  },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9 },
  modeBtnActive: { backgroundColor: PRIMARY },
  modeBtnText: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.65)" },
  modeBtnTextActive: { color: "#fff" },

  /* AR markers */
  arMarker: { position: "absolute", alignItems: "flex-start", zIndex: 10 },
  arMarkerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY, borderWidth: 2, borderColor: "#fff" },
  arMarkerLine: { width: 1.5, height: 28, backgroundColor: PRIMARY, marginLeft: 4 },
  arMarkerLabel: {
    backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderLeftWidth: 2, borderLeftColor: PRIMARY,
    marginTop: 2,
  },
  arMarkerText: { fontSize: 11, fontWeight: "600", color: "#fff" },

  /* 3D model */
  model3dWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  model3dBox: {
    width: 200, height: 180, borderRadius: 20, overflow: "hidden",
    shadowColor: PRIMARY, shadowRadius: 20, shadowOpacity: 0.6, elevation: 16,
  },
  model3dFace: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: PRIMARY + "80", borderRadius: 20,
  },
  model3dLabel: { fontSize: 16, fontWeight: "800", color: "#fff" },
  model3dSub: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  model3dHint: { fontSize: 12, color: "rgba(255,255,255,0.45)" },

  /* Bottom info panel */
  infoPanel: {
    backgroundColor: "rgba(12,20,14,0.92)",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingTop: 12, gap: 12,
    backdropFilter: "blur(12px)",
  },
  infoPanelHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)", alignSelf: "center", marginBottom: 4,
  },
  infoPanelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: PRIMARY + "22", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  infoBadgeText: { fontSize: 11, fontWeight: "600", color: PRIMARY },
  infoPanelTitle: { fontSize: 16, fontWeight: "800", color: "#fff", flex: 1 },
  infoPanelDesc: { fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 20 },
  infoTagsScroll: { marginHorizontal: -20 },
  infoTag: {
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 5, marginLeft: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  infoTagText: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
  infoActions: { flexDirection: "row", justifyContent: "space-around" },
  infoAction: { alignItems: "center", gap: 5 },
  infoActionText: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: "600" },
});
