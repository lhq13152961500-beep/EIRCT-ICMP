"use no memo";
import React, { useRef, useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_BAR_HEIGHT = 80;
const CARD_GAP = 12;
const CONTENT_PAD = 16;
const BANNER_HEIGHT = 200;
const BANNER_WIDTH = SCREEN_WIDTH - CONTENT_PAD * 2;

const BG = "#F5EFE6";
const CORAL_BG = "#FFE8E2";
const CORAL_ICON = "#E05A3A";
const GREEN_BG = "#D6F0E3";
const BLUE_BG = "#DDE8FF";
const BLUE_ICON = "#4271DD";
const ORANGE_BG = "#FFE4CC";
const ORANGE_ICON = "#E07830";

const BANNERS = [
  require("@/assets/images/home_banner1.png"),
  require("@/assets/images/home_banner1.png"),
  require("@/assets/images/home_banner1.png"),
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

  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef<ScrollView>(null);

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onBannerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / BANNER_WIDTH);
    setBannerIndex(idx);
  };

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
          <View style={styles.locationBlock}>
            <Text style={styles.locationLabel}>当前位置</Text>
            <Text style={styles.locationName}>云栖竹径 · 杭</Text>
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
        {/* Banner carousel */}
        <View style={styles.bannerWrap}>
          <ScrollView
            ref={bannerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onBannerScroll}
            scrollEventThrottle={16}
          >
            {BANNERS.map((src, i) => (
              <Image
                key={i}
                source={src}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          <View style={styles.dotsRow}>
            {BANNERS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === bannerIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        {/* Two large feature cards */}
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

        {/* Mini icon grid */}
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

        {/* "为你推荐" section */}
        <View style={styles.recHeader}>
          <Text style={styles.recTitle}>为你推荐</Text>
          <Pressable onPress={haptic}>
            <Text style={styles.recRefresh}>换一批</Text>
          </Pressable>
        </View>

        {/* Recommendation card */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: CONTENT_PAD,
    paddingBottom: 14,
    backgroundColor: "#fff",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  locationBlock: {
    gap: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  locationName: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.light.text,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  notifDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: CONTENT_PAD,
    gap: 16,
  },
  bannerWrap: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#ddd",
    height: BANNER_HEIGHT,
  },
  bannerImage: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
  },
  dotsRow: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  dotActive: {
    backgroundColor: "#fff",
    width: 18,
    borderRadius: 3,
  },
  featureRow: {
    flexDirection: "row",
  },
  featureCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "flex-start",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
  },
  featureSub: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  gridWrap: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  gridRow: {
    flexDirection: "row",
  },
  gridRowBottom: {
    marginTop: 16,
  },
  gridItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    maxWidth: "25%",
  },
  gridIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  gridLabel: {
    fontSize: 11,
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 14,
  },
  recHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  recTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
  },
  recRefresh: {
    fontSize: 14,
    color: "#E0522A",
    fontWeight: "500",
  },
  recCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    gap: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  recThumb: {
    width: 90,
    height: 90,
  },
  recInfo: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  recCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.text,
  },
  recCardSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  recStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  recStatText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
});
