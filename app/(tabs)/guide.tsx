import React, { useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const HERO_HEIGHT = 240;
const TAB_BAR_HEIGHT = 80;

interface RouteItem {
  id: string;
  title: string;
  buildings: number;
  distance: string;
  color: string;
}

const ROUTES: RouteItem[] = [
  {
    id: "1",
    title: "快速游览推荐",
    buildings: 12,
    distance: "2.3",
    color: "#F5974E",
  },
  {
    id: "2",
    title: "深度游览推荐路线",
    buildings: 17,
    distance: "3.5",
    color: "#3DAA6F",
  },
  {
    id: "3",
    title: "温馨赏花路线",
    buildings: 6,
    distance: "10.2",
    color: "#9B8EC4",
  },
];

interface SoundItem {
  id: string;
  title: string;
  tags: string[];
  listeners: string;
  thumb: ReturnType<typeof require>;
}

const SOUND_ITEMS: SoundItem[] = [
  {
    id: "1",
    title: "听见·黄岭村的清晨",
    tags: ["自然", "方言", "乡村"],
    listeners: "2.4k",
    thumb: require("@/assets/images/sound-thumb-1.png"),
  },
  {
    id: "2",
    title: "非遗乡情·竹编艺人",
    tags: ["地方文化", "身临其境", "非遗"],
    listeners: "1.8k",
    thumb: require("@/assets/images/sound-thumb-2.png"),
  },
];

function SoundArchiveCard({ item }: { item: SoundItem }) {
  const handlePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.soundCard, pressed && styles.soundCardPressed]}
      onPress={handlePress}
    >
      <Image source={item.thumb} style={styles.soundThumb} resizeMode="cover" />
      <View style={styles.soundInfo}>
        <Text style={styles.soundTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.soundTagRow}>
          {item.tags.map((tag) => (
            <View key={tag} style={styles.soundTagPill}>
              <Text style={styles.soundTagText}>{tag}</Text>
            </View>
          ))}
        </View>
        <View style={styles.soundMeta}>
          <Ionicons name="headset-outline" size={12} color={Colors.light.textSecondary} />
          <Text style={styles.soundListeners}>{item.listeners}人听过</Text>
        </View>
      </View>
      <Pressable
        style={styles.soundPlayBtn}
        onPress={handlePress}
        hitSlop={8}
      >
        <Ionicons name="play" size={16} color={Colors.light.primary} />
      </Pressable>
    </Pressable>
  );
}

function SoundArchiveSection() {
  return (
    <View style={styles.soundSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>声音档案推荐</Text>
        <Pressable
          onPress={() => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          style={styles.refreshBtn}
        >
          <Ionicons name="refresh" size={13} color={Colors.light.primary} />
          <Text style={styles.seeAllText}>换一批</Text>
        </Pressable>
      </View>
      {SOUND_ITEMS.map((item) => (
        <SoundArchiveCard key={item.id} item={item} />
      ))}
    </View>
  );
}

function HeroHeader({ insets }: { insets: ReturnType<typeof useSafeAreaInsets> }) {
  const topOffset = Platform.OS === "web" ? 67 : insets.top;
  return (
    <View style={styles.heroContainer}>
      <Image
        source={require("@/assets/images/hero-landscape.png")}
        style={styles.heroImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.15)", "rgba(248,249,250,0.95)", "#F8F9FA"]}
        locations={[0, 0.5, 0.85, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.heroTopBar, { top: topOffset + 8 }]}>
        <View style={styles.locationPill}>
          <Ionicons name="location" size={12} color={Colors.light.primary} />
          <Text style={styles.locationText}>浙江 · 西塘古镇</Text>
        </View>
        <Pressable style={styles.searchButton}>
          <Ionicons name="search" size={18} color={Colors.light.text} />
        </Pressable>
      </View>
    </View>
  );
}

function FeatureCard({
  icon,
  iconBg,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
}) {
  const handlePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  return (
    <Pressable
      style={({ pressed }) => [styles.featureCard, pressed && styles.featureCardPressed]}
      onPress={handlePress}
    >
      <View style={[styles.featureIconWrap, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function QuickButton({
  icon,
  bgColor,
  label,
}: {
  icon: React.ReactNode;
  bgColor: string;
  label: string;
}) {
  const handlePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  return (
    <Pressable style={styles.quickBtn} onPress={handlePress}>
      <View style={[styles.quickBtnCircle, { backgroundColor: bgColor }]}>
        {icon}
      </View>
      <Text style={styles.quickBtnLabel}>{label}</Text>
    </Pressable>
  );
}

function RouteCard({ route }: { route: RouteItem }) {
  const handlePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };
  return (
    <Pressable
      style={({ pressed }) => [styles.routeCard, pressed && styles.routeCardPressed]}
      onPress={handlePress}
    >
      <View style={[styles.routeThumb, { backgroundColor: route.color + "22" }]}>
        <MaterialCommunityIcons name="map-marker-path" size={26} color={route.color} />
      </View>
      <View style={styles.routeInfo}>
        <Text style={styles.routeTitle}>{route.title}</Text>
        <Text style={styles.routeMeta}>
          {route.buildings}座建筑 · 全程{route.distance}公里
        </Text>
      </View>
      <View style={[styles.routeArrow, { backgroundColor: route.color + "18" }]}>
        <Ionicons name="chevron-forward" size={16} color={route.color} />
      </View>
    </Pressable>
  );
}

export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_HEIGHT + bottomPad + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <HeroHeader insets={insets} />

        <View style={styles.content}>
          <View style={styles.featureRow}>
            <FeatureCard
              icon={<Ionicons name="headset" size={28} color="#F5974E" />}
              iconBg={Colors.light.orangeLight}
              title="智能伴游"
              subtitle="方言导游 旅游不孤单"
            />
            <FeatureCard
              icon={<MaterialCommunityIcons name="cube-scan" size={28} color="#E84B8A" />}
              iconBg="#FDEAF3"
              title="AR实景畅游"
              subtitle="AR场景搭建 千年穿越"
            />
          </View>

          <View style={styles.quickRow}>
            <QuickButton
              icon={<Ionicons name="people" size={22} color={Colors.light.primary} />}
              bgColor={Colors.light.greenLight}
              label="村民伴游"
            />
            <QuickButton
              icon={<Ionicons name="gift" size={22} color={Colors.light.accent} />}
              bgColor={Colors.light.orangeLight}
              label="特产礼品"
            />
            <QuickButton
              icon={<Ionicons name="people-circle" size={22} color={Colors.light.lavender} />}
              bgColor={Colors.light.purpleLight}
              label="乡音趣采"
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>游览路线</Text>
          </View>

          <View style={styles.routeContainer}>
            {ROUTES.map((route) => (
              <RouteCard key={route.id} route={route} />
            ))}

            <View style={styles.routeFooter}>
              <Text style={styles.noRouteText}>没有合适的路线？</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.createBtn,
                  pressed && styles.createBtnPressed,
                ]}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
              >
                <Text style={styles.createBtnText}>创建我的行程</Text>
              </Pressable>
            </View>
          </View>

          <SoundArchiveSection />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroContainer: {
    height: HERO_HEIGHT,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroTopBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  locationText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.text,
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  featureRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  featureCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  featureCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  featureIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 4,
  },
  featureSubtitle: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  quickBtn: {
    alignItems: "center",
    gap: 6,
  },
  quickBtnCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBtnLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.light.text,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
  },
  seeAllText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: "500",
  },
  routeContainer: {
    backgroundColor: "#F5F0E8",
    borderRadius: 20,
    padding: 16,
    marginBottom: 28,
    gap: 4,
  },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  routeCardPressed: {
    opacity: 0.8,
  },
  routeThumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  routeInfo: {
    flex: 1,
    gap: 3,
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  routeMeta: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  routeArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  routeFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  noRouteText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  createBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  createBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.text,
  },
  soundSection: {
    marginBottom: 8,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  soundCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  soundCardPressed: {
    opacity: 0.88,
  },
  soundThumb: {
    width: 90,
    height: 80,
  },
  soundInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
  },
  soundTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
  },
  soundTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  soundTagPill: {
    backgroundColor: Colors.light.greenLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  soundTagText: {
    fontSize: 10,
    color: Colors.light.primary,
    fontWeight: "500",
  },
  soundMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  soundListeners: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  soundPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  soundPlayBtnActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
});
