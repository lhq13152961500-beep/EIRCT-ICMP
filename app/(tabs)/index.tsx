"use no memo";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_BAR_HEIGHT = 80;
const CARD_GAP = 12;
const CONTENT_PAD = 16;
const BANNER_HEIGHT = 200;
const BANNER_WIDTH = SCREEN_WIDTH - CONTENT_PAD * 2;
const AUTO_SLIDE_MS = 3000;

const BG = "#F5EFE6";
const CORAL_BG = "#FFE8E2";
const CORAL_ICON = "#E05A3A";
const GREEN_BG = "#D6F0E3";
const BLUE_BG = "#DDE8FF";
const BLUE_ICON = "#4271DD";
const ORANGE_BG = "#FFE4CC";
const ORANGE_ICON = "#E07830";

type BannerItem = {
  image: ReturnType<typeof require>;
  title: string;
  sub: string;
  tags: string[];
  distance: string;
  score: string;
};

const BANNERS: BannerItem[] = [
  {
    image: require("@/assets/images/home_banner1.png"),
    title: "云栖竹径",
    sub: "漫步在竹林间，感受杭州最静谧的一面",
    tags: ["自然风光", "徒步"],
    distance: "3.2 km",
    score: "4.9",
  },
  {
    image: require("@/assets/images/home_banner2.png"),
    title: "梯田风光",
    sub: "层叠的稻田如画卷铺开，绿意盎然",
    tags: ["乡村美景", "摄影"],
    distance: "12 km",
    score: "4.8",
  },
  {
    image: require("@/assets/images/home_banner3.png"),
    title: "古村水乡",
    sub: "千年古村落，石桥流水，灯影婆娑",
    tags: ["历史文化", "古镇"],
    distance: "28 km",
    score: "4.7",
  },
];

const MINI_ICONS: { label: string; icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }[] = [
  { label: "AR实景畅游", icon: "navigate-circle-outline", bg: CORAL_BG, color: CORAL_ICON },
  { label: "声音邮局",   icon: "mic-outline",             bg: GREEN_BG,  color: Colors.light.primary },
  { label: "乡思AI",     icon: "partly-sunny-outline",    bg: BLUE_BG,   color: BLUE_ICON },
  { label: "声音档案",   icon: "albums-outline",          bg: CORAL_BG,  color: CORAL_ICON },
  { label: "村民伴游",   icon: "people-outline",          bg: CORAL_BG,  color: CORAL_ICON },
  { label: "乡音趣采",   icon: "flower-outline",          bg: CORAL_BG,  color: CORAL_ICON },
  { label: "特产礼品",   icon: "gift-outline",            bg: ORANGE_BG, color: ORANGE_ICON },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { profile } = useAuth();
  const avatarUrl = profile?.avatarUrl || null;

  const [locationText, setLocationText] = useState("定位中...");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS === "web") {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }),
          );
          if (cancelled) return;
          const resp = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (!cancelled && resp[0]) {
            const g = resp[0];
            setLocationText(g.city || g.region || g.district || g.name || "未知位置");
          }
        } catch {
          if (!cancelled) setLocationText("无法定位");
        }
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { if (!cancelled) setLocationText("未授权定位"); return; }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const resp = await Location.reverseGeocodeAsync(loc.coords);
        if (!cancelled && resp[0]) {
          const g = resp[0];
          setLocationText(g.city || g.region || g.district || g.name || "未知位置");
        }
      } catch {
        if (!cancelled) setLocationText("无法定位");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [bannerIndex, setBannerIndex] = useState(0);
  const [infoBanner, setInfoBanner] = useState<BannerItem | null>(null);
  const bannerRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDragging = useRef(false);

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const scrollTo = useCallback((idx: number) => {
    bannerRef.current?.scrollTo({ x: idx * BANNER_WIDTH, animated: true });
    indexRef.current = idx;
    setBannerIndex(idx);
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (isDragging.current) return;
      const next = (indexRef.current + 1) % BANNERS.length;
      scrollTo(next);
    }, AUTO_SLIDE_MS);
  }, [scrollTo]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const onBannerScrollBegin = () => {
    isDragging.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const onBannerScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isDragging.current = false;
    const idx = Math.round(e.nativeEvent.contentOffset.x / BANNER_WIDTH);
    indexRef.current = idx;
    setBannerIndex(idx);
    startTimer();
  };

  const onBannerPress = (banner: BannerItem) => {
    haptic();
    setInfoBanner(banner);
  };

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} resizeMode="cover" />
            ) : (
              <Ionicons name="person" size={20} color="#fff" />
            )}
          </View>
          <View style={styles.locationBlock}>
            <Text style={styles.locationLabel}>当前位置</Text>
            <Text style={styles.locationName} numberOfLines={1}>{locationText}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.iconBtn} onPress={haptic}>
            <Ionicons name="search-outline" size={22} color={Colors.light.text} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={haptic}>
            <Ionicons name="notifications-outline" size={22} color={Colors.light.text} />
            <View style={styles.notifDot} />
          </Pressable>
        </View>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_HEIGHT + bottomPad + 20 },
        ]}
      >
        {/* ── Banner carousel ── */}
        <View style={styles.bannerWrap}>
          <ScrollView
            ref={bannerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={onBannerScrollBegin}
            onMomentumScrollEnd={onBannerScrollEnd}
            scrollEventThrottle={16}
            decelerationRate="fast"
          >
            {BANNERS.map((banner, i) => (
              <Pressable key={i} onPress={() => onBannerPress(banner)}>
                <Image
                  source={banner.image}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
                {/* Gradient + label overlay */}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.55)"]}
                  style={styles.bannerGradient}
                >
                  <View style={styles.bannerLabel}>
                    <Text style={styles.bannerTitle}>{banner.title}</Text>
                    <View style={styles.bannerTagRow}>
                      {banner.tags.map((t) => (
                        <View key={t} style={styles.bannerTag}>
                          <Text style={styles.bannerTagText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.bannerMeta}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.bannerScore}>{banner.score}</Text>
                    <View style={styles.bannerDot2} />
                    <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.bannerDistance}>{banner.distance}</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </ScrollView>

          {/* Dot indicators */}
          <View style={styles.dotsRow}>
            {BANNERS.map((_, i) => (
              <Pressable key={i} onPress={() => { scrollTo(i); startTimer(); }}>
                <View style={[styles.dot, i === bannerIndex && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Two feature cards ── */}
        <View style={styles.featureRow}>
          <Pressable style={[styles.featureCard, { marginRight: CARD_GAP / 2 }]} onPress={haptic}>
            <View style={[styles.featureIconWrap, { backgroundColor: "#FFD9BC" }]}>
              <Ionicons name="camera-outline" size={30} color="#E07020" />
            </View>
            <Text style={styles.featureTitle}>语伴导游</Text>
            <Text style={styles.featureSub}>方言导游 旅游不孤单</Text>
          </Pressable>
          <Pressable style={[styles.featureCard, { marginLeft: CARD_GAP / 2 }]} onPress={haptic}>
            <View style={[styles.featureIconWrap, { backgroundColor: "#C5D8FF" }]}>
              <Ionicons name="map-outline" size={30} color="#3A68D8" />
            </View>
            <Text style={styles.featureTitle}>地图导览</Text>
            <Text style={styles.featureSub}>AI 个性化定制</Text>
          </Pressable>
        </View>

        {/* ── Mini icon grid ── */}
        <View style={styles.gridWrap}>
          <View style={styles.gridRow}>
            {MINI_ICONS.slice(0, 4).map((item) => (
              <Pressable key={item.label} style={styles.gridItem} onPress={haptic}>
                <View style={[styles.gridIconCircle, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={styles.gridLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.gridRow, styles.gridRowBottom]}>
            {MINI_ICONS.slice(4).map((item) => (
              <Pressable key={item.label} style={styles.gridItem} onPress={haptic}>
                <View style={[styles.gridIconCircle, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={styles.gridLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── 为你推荐 ── */}
        <View style={styles.recHeader}>
          <Text style={styles.recTitle}>为你推荐</Text>
          <Pressable onPress={haptic}>
            <Text style={styles.recRefresh}>换一批</Text>
          </Pressable>
        </View>

        <Pressable style={styles.recCard} onPress={haptic}>
          <Image
            source={require("@/assets/images/home_recommend1.png")}
            style={styles.recThumb}
            resizeMode="cover"
          />
          <View style={styles.recInfo}>
            <Text style={styles.recCardTitle}>听见·黄岭村的清</Text>
            <Text style={styles.recCardSub}>根据你的兴趣：自然、方</Text>
            <View style={styles.recStatRow}>
              <Ionicons name="time-outline" size={12} color={Colors.light.textSecondary} />
              <Text style={styles.recStatText}>2.4k 人听过</Text>
            </View>
          </View>
        </Pressable>
      </ScrollView>

      {/* ── Banner info modal ── */}
      <Modal
        visible={!!infoBanner}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoBanner(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoBanner(null)}>
          <View style={[styles.infoSheet, { paddingBottom: bottomPad + 20 }]}>
            {infoBanner && (
              <>
                <Image
                  source={infoBanner.image}
                  style={styles.infoHero}
                  resizeMode="cover"
                />
                <View style={styles.infoBody}>
                  <View style={styles.infoTitleRow}>
                    <Text style={styles.infoTitle}>{infoBanner.title}</Text>
                    <View style={styles.infoScoreRow}>
                      <Ionicons name="star" size={14} color="#FFB800" />
                      <Text style={styles.infoScore}>{infoBanner.score}</Text>
                    </View>
                  </View>
                  <Text style={styles.infoSub}>{infoBanner.sub}</Text>
                  <View style={styles.infoTagRow}>
                    {infoBanner.tags.map((t) => (
                      <View key={t} style={styles.infoTag}>
                        <Text style={styles.infoTagText}>{t}</Text>
                      </View>
                    ))}
                    <View style={styles.infoDistTag}>
                      <Ionicons name="location-outline" size={12} color={Colors.light.primary} />
                      <Text style={styles.infoDistText}>{infoBanner.distance}</Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.goBtn}
                    onPress={() => { haptic(); setInfoBanner(null); }}
                  >
                    <Text style={styles.goBtnText}>开始导览</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* ── Header ── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: CONTENT_PAD,
    paddingBottom: 14,
    backgroundColor: "#fff",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.light.primary,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: 42, height: 42, borderRadius: 21,
  },
  locationBlock: { gap: 1 },
  locationLabel: { fontSize: 11, color: Colors.light.textSecondary },
  locationName: { fontSize: 17, fontWeight: "700", color: Colors.light.text },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
  },
  notifDot: {
    position: "absolute", top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#FF3B30",
    borderWidth: 1.5, borderColor: "#fff",
  },

  /* ── Scroll ── */
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: CONTENT_PAD,
    gap: 16,
  },

  /* ── Banner ── */
  bannerWrap: {
    borderRadius: 18,
    overflow: "hidden",
    height: BANNER_HEIGHT,
    backgroundColor: "#ddd",
  },
  bannerImage: { width: BANNER_WIDTH, height: BANNER_HEIGHT },
  bannerGradient: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: 90,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  bannerLabel: { flex: 1, gap: 4 },
  bannerTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  bannerTagRow: { flexDirection: "row", gap: 6 },
  bannerTag: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  bannerTagText: { fontSize: 10, color: "#fff" },
  bannerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingBottom: 2,
  },
  bannerScore: { fontSize: 12, color: "#fff", fontWeight: "600" },
  bannerDot2: {
    width: 3, height: 3, borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.6)",
    marginHorizontal: 2,
  },
  bannerDistance: { fontSize: 12, color: "rgba(255,255,255,0.85)" },
  dotsRow: {
    position: "absolute",
    bottom: 10, left: 0, right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  dotActive: {
    backgroundColor: "#fff",
    width: 18, borderRadius: 3,
  },

  /* ── Feature cards ── */
  featureRow: { flexDirection: "row" },
  featureCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 20, paddingHorizontal: 16,
    alignItems: "flex-start",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  featureIconWrap: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  featureTitle: { fontSize: 16, fontWeight: "700", color: Colors.light.text },
  featureSub: { fontSize: 11, color: Colors.light.textSecondary, lineHeight: 16 },

  /* ── Grid ── */
  gridWrap: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 16, paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  gridRow: { flexDirection: "row" },
  gridRowBottom: { marginTop: 16 },
  gridItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    maxWidth: "25%",
  },
  gridIconCircle: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: "center", justifyContent: "center",
  },
  gridLabel: {
    fontSize: 11, color: Colors.light.text,
    textAlign: "center", lineHeight: 14,
  },

  /* ── Recommendations ── */
  recHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  recTitle: { fontSize: 20, fontWeight: "700", color: Colors.light.text },
  recRefresh: { fontSize: 14, color: "#E0522A", fontWeight: "500" },
  recCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  recThumb: { width: 90, height: 90 },
  recInfo: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 4,
  },
  recCardTitle: { fontSize: 15, fontWeight: "700", color: Colors.light.text },
  recCardSub: { fontSize: 12, color: Colors.light.textSecondary },
  recStatRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  recStatText: { fontSize: 12, color: Colors.light.textSecondary },

  /* ── Info modal ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  infoSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  infoHero: {
    width: "100%",
    height: 200,
  },
  infoBody: {
    padding: 20,
    gap: 12,
  },
  infoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoTitle: { fontSize: 22, fontWeight: "700", color: Colors.light.text },
  infoScoreRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoScore: { fontSize: 15, fontWeight: "600", color: Colors.light.text },
  infoSub: { fontSize: 14, color: Colors.light.textSecondary, lineHeight: 20 },
  infoTagRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  infoTag: {
    backgroundColor: Colors.light.primary + "18",
    borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  infoTagText: { fontSize: 12, color: Colors.light.primary, fontWeight: "500" },
  infoDistTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.light.primary + "18",
    borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  infoDistText: { fontSize: 12, color: Colors.light.primary, fontWeight: "500" },
  goBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 4,
  },
  goBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
