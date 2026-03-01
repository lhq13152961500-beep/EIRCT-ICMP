import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const TAB_BAR_HEIGHT = 80;

const DIARY_ENTRIES = [
  {
    id: "1",
    title: "西塘的清晨",
    date: "2026年3月1日",
    duration: "2:34",
    location: "西塘古镇",
    mood: "心旷神怡",
    color: Colors.light.primary,
  },
  {
    id: "2",
    title: "石板路上的脚步声",
    date: "2026年2月28日",
    duration: "1:18",
    location: "北栅丝厂",
    mood: "怀旧",
    color: Colors.light.accent,
  },
  {
    id: "3",
    title: "夜游古镇灯影",
    date: "2026年2月27日",
    duration: "3:07",
    location: "烟雨长廊",
    mood: "浪漫",
    color: Colors.light.lavender,
  },
];

function DiaryCard({ entry }: { entry: typeof DIARY_ENTRIES[0] }) {
  const handlePress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.diaryCard, pressed && styles.diaryCardPressed]}
      onPress={handlePress}
    >
      <View style={[styles.diaryPlayBtn, { backgroundColor: entry.color + "18" }]}>
        <Ionicons name="play" size={20} color={entry.color} />
      </View>
      <View style={styles.diaryContent}>
        <Text style={styles.diaryTitle}>{entry.title}</Text>
        <View style={styles.diaryMeta}>
          <Ionicons name="location-outline" size={11} color={Colors.light.textSecondary} />
          <Text style={styles.diaryMetaText}>{entry.location}</Text>
          <Text style={styles.diaryDot}>·</Text>
          <Text style={styles.diaryMetaText}>{entry.date}</Text>
        </View>
      </View>
      <View style={styles.diaryRight}>
        <Text style={styles.diaryDuration}>{entry.duration}</Text>
        <View style={[styles.moodBadge, { backgroundColor: entry.color + "18" }]}>
          <Text style={[styles.moodText, { color: entry.color }]}>{entry.mood}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.light.lavender, "#B8A8DC"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <Text style={styles.headerTitle}>声音日记</Text>
        <Text style={styles.headerSub}>记录旅途中的每个声音故事</Text>

        <Pressable
          style={({ pressed }) => [styles.recordBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
          onPress={() => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
        >
          <Ionicons name="mic" size={24} color={Colors.light.lavender} />
          <Text style={styles.recordBtnText}>开始录制新日记</Text>
        </Pressable>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_HEIGHT + bottomPad + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.statsRow}>
            {[
              { value: "12", label: "条日记" },
              { value: "28:40", label: "总时长" },
              { value: "5", label: "个地点" },
            ].map((stat) => (
              <View key={stat.label} style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>最近录音</Text>
          </View>

          {DIARY_ENTRIES.map((entry) => (
            <DiaryCard key={entry.id} entry={entry} />
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
  },
  headerSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
  },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },
  recordBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.lavender,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
  },
  diaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  diaryCardPressed: {
    opacity: 0.85,
  },
  diaryPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  diaryContent: {
    flex: 1,
    gap: 4,
  },
  diaryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  diaryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  diaryMetaText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  diaryDot: {
    fontSize: 11,
    color: Colors.light.textLight,
  },
  diaryRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  diaryDuration: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.text,
  },
  moodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  moodText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
