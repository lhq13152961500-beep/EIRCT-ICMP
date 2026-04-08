"use no memo";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useLocation } from "@/contexts/LocationContext";
import Colors from "@/constants/colors";

const { width: SW } = Dimensions.get("window");
const PRIMARY = Colors.light.primary;
const ACCENT = Colors.light.accent;

/* ── 吐峪沟 scenic area bounding box ─────────────────── */
const AREA = {
  name: "吐峪沟麻扎村",
  address: "新疆吐鲁番市鄯善县吐峪沟乡麻扎村",
  hours: "开放时间：08:00 - 19:00",
  centerLat: 42.8603,
  centerLng: 89.5971,
  /* ±0.018° ≈ 2 km radius */
  latMin: 42.842, latMax: 42.879,
  lngMin: 89.578, lngMax: 89.616,
};

function isInsideArea(lat: number, lng: number) {
  return (
    lat >= AREA.latMin && lat <= AREA.latMax &&
    lng >= AREA.lngMin && lng <= AREA.lngMax
  );
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Pulse dot for "in area" icon ────────────────────── */
import { useRef } from "react";
import { Animated, Easing } from "react-native";

function PulseDot() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{
      position: "absolute", width: 100, height: 100, borderRadius: 50,
      backgroundColor: PRIMARY,
      opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }),
      transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] }) }],
    }} pointerEvents="none" />
  );
}

export default function VoiceGuideEntry() {
  const insets = useSafeAreaInsets();
  const { locationStatus, isLocating } = useLocation();
  const [demoMode, setDemoMode] = useState(false);

  /* Derive status */
  type PageState = "loading" | "in_area" | "out_area" | "denied";
  let pageState: PageState = "loading";
  let distanceKm = 0;
  let userLat = 0, userLng = 0;
  let locationLabel = "";

  if (isLocating && locationStatus.state === "none") {
    pageState = "loading";
  } else if (locationStatus.state === "denied") {
    pageState = "denied";
  } else if (locationStatus.state === "located") {
    userLat = locationStatus.lat;
    userLng = locationStatus.lng;
    locationLabel = locationStatus.locationName;
    if (isInsideArea(userLat, userLng)) {
      pageState = "in_area";
    } else {
      pageState = "out_area";
      distanceKm = Math.round(haversineKm(userLat, userLng, AREA.centerLat, AREA.centerLng));
    }
  } else {
    pageState = "out_area";
    distanceKm = 15;
  }

  const openNavigation = () => {
    const url = Platform.OS === "ios"
      ? `maps:0,0?q=${AREA.address}`
      : `geo:${AREA.centerLat},${AREA.centerLng}?q=${AREA.address}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${AREA.centerLat},${AREA.centerLng}`);
    });
  };

  const enterGuide = (demo = false) => {
    router.push({ pathname: "/voice-guide", params: { demo: demo ? "1" : "0" } });
  };

  return (
    <View style={styles.root}>
      {/* Background gradient */}
      <LinearGradient
        colors={["#F9F4EE", "#FEFCF9", "#F9F4EE"]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </Pressable>
        <View style={styles.headerBadge}>
          <Ionicons name="radio-outline" size={13} color={ACCENT} />
          <Text style={styles.headerBadgeText}>智能语音导览系统</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        {/* Title block */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleMain}>语伴导游</Text>
          <Text style={styles.titleSub}>在乡音缭绕中感受地道的文化韵味</Text>
        </View>

        {/* State card */}
        {pageState === "loading" && (
          <View style={styles.stateCard}>
            <View style={[styles.iconCircle, { backgroundColor: "#F0F0F0" }]}>
              <Ionicons name="location-outline" size={40} color="#AAAAAA" />
            </View>
            <Text style={styles.stateTitle}>正在获取位置…</Text>
            <Text style={styles.stateSub}>请稍候，正在定位您的当前位置</Text>
          </View>
        )}

        {pageState === "in_area" && (
          <View style={styles.stateCard}>
            <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <PulseDot />
              <View style={[styles.iconCircle, { backgroundColor: "#E6F5EE" }]}>
                <Ionicons name="navigate" size={40} color={PRIMARY} />
              </View>
            </View>
            <Text style={styles.stateTitle}>欢迎来到古村</Text>
            <Text style={styles.locationCoord}>
              {locationLabel ? `${locationLabel}` : `东经${userLng.toFixed(2)}° 北纬${userLat.toFixed(2)}°`}
            </Text>
            <Text style={styles.stateSub}>已为您准备好周边景点的双语讲解</Text>
            <Pressable style={styles.startBtn} onPress={() => enterGuide(false)}>
              <LinearGradient colors={[ACCENT, "#D96020"]} style={styles.startBtnGrad}>
                <Text style={styles.startBtnText}>开始导览</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {pageState === "out_area" && (
          <View style={styles.stateCard}>
            <View style={[styles.iconCircle, { backgroundColor: "#FFF3E8" }]}>
              <Ionicons name="location" size={44} color={ACCENT} />
            </View>
            <Text style={styles.stateTitle}>您不在景区范围内</Text>
            <Text style={styles.locationCoord}>您当前位置：距离景区约 {distanceKm} 公里</Text>
            <Text style={styles.stateSub}>
              {"语伴导游需要您在景区附近才能使用，\n到达景区后，系统将自动为您推送景点讲解。"}
            </Text>

            {/* Venue info card */}
            <View style={styles.venueCard}>
              <Text style={styles.venueCardTitle}>景区地址</Text>
              <Text style={styles.venueAddress}>{AREA.address}</Text>
              <Text style={styles.venueHours}>{AREA.hours}</Text>
            </View>

            <Pressable style={styles.navBtn} onPress={openNavigation}>
              <Ionicons name="navigate-outline" size={18} color="#1A1A1A" />
              <Text style={styles.navBtnText}>查看导航路线</Text>
            </Pressable>

            <Pressable onPress={() => enterGuide(true)}>
              <Text style={styles.demoLink}>仍然进入（演示模式）</Text>
            </Pressable>
          </View>
        )}

        {pageState === "denied" && (
          <View style={styles.stateCard}>
            <View style={[styles.iconCircle, { backgroundColor: "#FFEEEE" }]}>
              <Ionicons name="navigate-circle-outline" size={44} color="#E05555" />
            </View>
            <Text style={styles.stateTitle}>需要位置权限</Text>
            <Text style={styles.stateSub}>
              {"语伴导游需要获取您的位置，\n才能自动识别周边景点并推送讲解内容。"}
            </Text>

            <View style={styles.permSteps}>
              <Text style={styles.permStepsTitle}>如何开启位置权限：</Text>
              {Platform.OS === "ios" ? (
                <>
                  <Text style={styles.permStep}>① 打开手机【设置】</Text>
                  <Text style={styles.permStep}>② 向下滚动找到【乡音伴旅】</Text>
                  <Text style={styles.permStep}>③ 点击【位置】→ 选择【使用 App 时】</Text>
                </>
              ) : (
                <>
                  <Text style={styles.permStep}>① 打开手机【设置】→【应用管理】</Text>
                  <Text style={styles.permStep}>② 找到【乡音伴旅】→【权限】</Text>
                  <Text style={styles.permStep}>③ 开启【位置信息】权限</Text>
                </>
              )}
            </View>

            <Pressable style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
              <Text style={styles.settingsBtnText}>前往设置开启权限</Text>
            </Pressable>

            <Pressable onPress={() => enterGuide(true)}>
              <Text style={styles.demoLink}>仍然进入（演示模式）</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F9F4EE" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  headerBadge: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 4,
  },
  headerBadgeText: { fontSize: 12, color: ACCENT, fontWeight: "600" },

  scroll: { paddingHorizontal: 24, paddingTop: 8 },

  titleBlock: { marginBottom: 32 },
  titleMain: { fontSize: 40, fontWeight: "800", color: "#1A1A1A", letterSpacing: -1 },
  titleSub: { fontSize: 14, color: "#888", marginTop: 6, lineHeight: 20 },

  stateCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  iconCircle: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
  },
  stateTitle: { fontSize: 22, fontWeight: "700", color: "#1A1A1A", marginBottom: 8, textAlign: "center" },
  locationCoord: { fontSize: 13, color: "#888", marginBottom: 8, textAlign: "center" },
  stateSub: { fontSize: 13, color: "#888", textAlign: "center", lineHeight: 20, marginBottom: 20 },

  startBtn: { width: SW - 96, borderRadius: 16, overflow: "hidden", marginTop: 8 },
  startBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16,
  },
  startBtnText: { fontSize: 17, fontWeight: "700", color: "#fff" },

  venueCard: {
    width: "100%", backgroundColor: "#FAFAFA", borderRadius: 12,
    padding: 16, marginBottom: 16, alignItems: "center",
  },
  venueCardTitle: { fontSize: 13, fontWeight: "700", color: "#1A1A1A", marginBottom: 6 },
  venueAddress: { fontSize: 13, color: "#555", textAlign: "center", lineHeight: 20 },
  venueHours: { fontSize: 12, color: "#999", marginTop: 4 },

  navBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1.5, borderColor: "#E0E0E0", borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 24, marginBottom: 16,
  },
  navBtnText: { fontSize: 14, fontWeight: "600", color: "#1A1A1A" },
  demoLink: { fontSize: 13, color: ACCENT, fontWeight: "600", paddingVertical: 8 },

  permSteps: {
    width: "100%", backgroundColor: "#FFF8F5", borderRadius: 12,
    padding: 16, marginBottom: 20,
  },
  permStepsTitle: { fontSize: 13, fontWeight: "700", color: "#1A1A1A", marginBottom: 10 },
  permStep: { fontSize: 13, color: "#555", lineHeight: 24 },

  settingsBtn: {
    backgroundColor: "#E05555", borderRadius: 12,
    paddingVertical: 13, paddingHorizontal: 32, marginBottom: 12,
  },
  settingsBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
