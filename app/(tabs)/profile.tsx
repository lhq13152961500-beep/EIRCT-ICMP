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

function MenuItem({
  icon,
  label,
  value,
  color = Colors.light.primary,
}: {
  icon: string;
  label: string;
  value?: string;
  color?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.75 }]}
      onPress={() => Platform.OS !== "web" && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
    >
      <View style={[styles.menuIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={styles.menuRight}>
        {value ? <Text style={styles.menuValue}>{value}</Text> : null}
        <Ionicons name="chevron-forward" size={16} color={Colors.light.textLight} />
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
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
          colors={[Colors.light.primary, Colors.light.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: topPad + 16 }]}
        >
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={36} color={Colors.light.primary} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>旅行者</Text>
              <Text style={styles.userSub}>热爱乡村，探索每一寸土地</Text>
            </View>
            <Pressable style={styles.editBtn}>
              <Ionicons name="create-outline" size={20} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.statsBar}>
            {[
              { value: "8", label: "游览地" },
              { value: "24", label: "打卡点" },
              { value: "5", label: "日记" },
              { value: "3", label: "行程" },
            ].map((s) => (
              <View key={s.label} style={styles.statCol}>
                <Text style={styles.statNum}>{s.value}</Text>
                <Text style={styles.statLbl}>{s.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>我的旅游</Text>
            <MenuItem icon="bookmark-outline" label="收藏的景点" value="12个" color={Colors.light.primary} />
            <MenuItem icon="map-outline" label="我的行程" value="3个" color={Colors.light.accent} />
            <MenuItem icon="footsteps-outline" label="游览记录" value="8次" color={Colors.light.lavender} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>工具与设置</Text>
            <MenuItem icon="mic-outline" label="声音日记" color={Colors.light.lavender} />
            <MenuItem icon="download-outline" label="离线地图" color={Colors.light.primary} />
            <MenuItem icon="language-outline" label="语言设置" value="简体中文" color={Colors.light.accent} />
            <MenuItem icon="settings-outline" label="通知设置" color="#666" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>关于</Text>
            <MenuItem icon="information-circle-outline" label="关于逛游指南" color={Colors.light.primary} />
            <MenuItem icon="star-outline" label="为我们评分" color="#FFB800" />
          </View>
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
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 20,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  userSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingVertical: 14,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.2)",
    gap: 2,
  },
  statNum: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  statLbl: {
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.textSecondary,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: Colors.light.text,
  },
  menuRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  menuValue: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
});
