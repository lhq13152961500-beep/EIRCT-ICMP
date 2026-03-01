import React from "react";
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
const TAB_BAR_HEIGHT = 80;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
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
        <LinearGradient
          colors={[Colors.light.primary, "#5DC88A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: topPad + 16 }]}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>早上好</Text>
              <Text style={styles.headerTitle}>探索乡村之美</Text>
            </View>
            <Pressable style={styles.notifBtn}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={Colors.light.textSecondary} />
            <Text style={styles.searchPlaceholder}>搜索景点、路线、攻略...</Text>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.bannerRow}>
            {[
              { label: "景点", count: "128+", icon: "image-outline", color: Colors.light.primary },
              { label: "路线", count: "24条", icon: "map-outline", color: Colors.light.accent },
              { label: "美食", count: "60+", icon: "restaurant-outline", color: "#E84B8A" },
              { label: "住宿", count: "35+", icon: "bed-outline", color: Colors.light.lavender },
            ].map((item) => (
              <Pressable
                key={item.label}
                style={({ pressed }) => [styles.bannerItem, pressed && { opacity: 0.8 }]}
                onPress={() => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <View style={[styles.bannerIcon, { backgroundColor: item.color + "18" }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={styles.bannerCount}>{item.count}</Text>
                <Text style={styles.bannerLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>热门景点</Text>
            <Pressable>
              <Text style={styles.seeAll}>查看全部</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.spotScroll}
          >
            {[
              { name: "西塘古镇", tag: "水乡古镇", rating: "4.9", visits: "12万+" },
              { name: "乌镇", tag: "历史古镇", rating: "4.8", visits: "9万+" },
              { name: "南浔古镇", tag: "江南水乡", rating: "4.7", visits: "7万+" },
            ].map((spot, i) => (
              <Pressable
                key={spot.name}
                style={({ pressed }) => [styles.spotCard, pressed && { opacity: 0.88 }]}
              >
                <View style={[styles.spotImage, { backgroundColor: [Colors.light.greenLight, Colors.light.orangeLight, Colors.light.purpleLight][i] }]}>
                  <Ionicons name="image" size={40} color={[Colors.light.primary, Colors.light.accent, Colors.light.lavender][i]} />
                </View>
                <View style={styles.spotInfo}>
                  <Text style={styles.spotName}>{spot.name}</Text>
                  <Text style={styles.spotTag}>{spot.tag}</Text>
                  <View style={styles.spotMeta}>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={11} color="#FFB800" />
                      <Text style={styles.ratingText}>{spot.rating}</Text>
                    </View>
                    <Text style={styles.visitsText}>{spot.visits}人游览</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>今日推荐活动</Text>
          </View>

          {[
            { title: "民间手工艺体验", time: "10:00 - 12:00", slots: "剩余8个名额", color: Colors.light.primary },
            { title: "古镇夜游摄影", time: "18:30 - 21:00", slots: "剩余3个名额", color: Colors.light.accent },
          ].map((activity) => (
            <Pressable
              key={activity.title}
              style={({ pressed }) => [styles.activityCard, pressed && { opacity: 0.88 }]}
            >
              <View style={[styles.activityColor, { backgroundColor: activity.color }]} />
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <View style={styles.activityMeta}>
                  <Ionicons name="time-outline" size={12} color={Colors.light.textSecondary} />
                  <Text style={styles.activityTime}>{activity.time}</Text>
                </View>
              </View>
              <View style={[styles.slotsBadge, { backgroundColor: activity.color + "18" }]}>
                <Text style={[styles.slotsText, { color: activity.color }]}>{activity.slots}</Text>
              </View>
            </Pressable>
          ))}
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  greeting: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchPlaceholder: {
    fontSize: 13,
    color: Colors.light.textLight,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  bannerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  bannerItem: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  bannerCount: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.light.text,
  },
  bannerLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
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
  seeAll: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: "500",
  },
  spotScroll: {
    paddingRight: 16,
    gap: 12,
    marginBottom: 24,
  },
  spotCard: {
    width: 160,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  spotImage: {
    width: "100%",
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  spotInfo: {
    padding: 12,
    gap: 3,
  },
  spotName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  spotTag: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  spotMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  visitsText: {
    fontSize: 10,
    color: Colors.light.textLight,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  activityColor: {
    width: 4,
    alignSelf: "stretch",
  },
  activityInfo: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  activityMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  activityTime: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  slotsBadge: {
    marginRight: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  slotsText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
