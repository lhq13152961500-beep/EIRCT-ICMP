import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const BG = "#F5EFE6";
const BLUE_BG = "#DDE8FF";
const BLUE_ICON = "#4271DD";
const GREEN_BG = "#D6F0E3";
const CORAL_BG = "#FFE8E2";
const CORAL_ICON = "#E05A3A";
const ORANGE_BG = "#FFE4CC";
const ORANGE_ICON = "#E07830";

type TerminalDevice = {
  id: string;
  name: string;
  type: string;
  location: string;
  status: "online" | "busy" | "offline";
  distance: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
};

const DEVICES: TerminalDevice[] = [
  {
    id: "1",
    name: "乡村广播站·南村",
    type: "广播终端",
    location: "河马泉街道 南村路 12号",
    status: "online",
    distance: "0.3 km",
    icon: "radio-outline",
    bg: GREEN_BG,
    color: Colors.light.primary,
  },
  {
    id: "2",
    name: "民俗文化馆·展示屏",
    type: "展示终端",
    location: "水磨沟区 文化路 88号",
    status: "online",
    distance: "1.2 km",
    icon: "tv-outline",
    bg: BLUE_BG,
    color: BLUE_ICON,
  },
  {
    id: "3",
    name: "古镇入口·导览亭",
    type: "导览终端",
    location: "沙依巴克区 古镇入口",
    status: "busy",
    distance: "2.8 km",
    icon: "information-circle-outline",
    bg: ORANGE_BG,
    color: ORANGE_ICON,
  },
  {
    id: "4",
    name: "非遗传承中心",
    type: "互动终端",
    location: "天山区 非遗街 3号",
    status: "online",
    distance: "4.1 km",
    icon: "musical-notes-outline",
    bg: CORAL_BG,
    color: CORAL_ICON,
  },
  {
    id: "5",
    name: "乡音记录站·东区",
    type: "录制终端",
    location: "东山区 东大路 56号",
    status: "offline",
    distance: "6.5 km",
    icon: "mic-outline",
    bg: CORAL_BG,
    color: CORAL_ICON,
  },
];

const STATUS_MAP = {
  online:  { label: "在线", color: "#3DAA6E", bg: "#E6F5ED" },
  busy:    { label: "使用中", color: "#E07830", bg: "#FFF3E8" },
  offline: { label: "离线", color: "#9E9E9E", bg: "#F0F0F0" },
};

export default function TerminalScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [connected, setConnected] = useState<string | null>(null);

  const handleConnect = (device: TerminalDevice) => {
    if (device.status === "offline") return;
    setConnected((prev) => (prev === device.id ? null : device.id));
  };

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>终端互联</Text>
        <View style={styles.headerRight}>
          <Ionicons name="wifi" size={20} color={Colors.light.primary} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconWrap}>
            <Ionicons name="wifi-outline" size={28} color={BLUE_ICON} />
          </View>
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>附近终端设备</Text>
            <Text style={styles.infoSub}>连接周边乡音终端，实时推送您的录音至本地展示屏与广播站</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>
              {DEVICES.filter((d) => d.status === "online").length}
            </Text>
            <Text style={styles.statLabel}>在线设备</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>
              {DEVICES.filter((d) => d.status === "busy").length}
            </Text>
            <Text style={styles.statLabel}>使用中</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{DEVICES.length}</Text>
            <Text style={styles.statLabel}>附近总数</Text>
          </View>
        </View>

        {/* Device list */}
        <Text style={styles.sectionTitle}>附近终端列表</Text>
        {DEVICES.map((device) => {
          const status = STATUS_MAP[device.status];
          const isConnected = connected === device.id;
          const canConnect = device.status !== "offline";
          return (
            <View key={device.id} style={[styles.deviceCard, isConnected && styles.deviceCardActive]}>
              <View style={[styles.deviceIcon, { backgroundColor: device.bg }]}>
                <Ionicons name={device.icon} size={22} color={device.color} />
              </View>
              <View style={styles.deviceInfo}>
                <View style={styles.deviceTopRow}>
                  <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={styles.deviceType}>{device.type}</Text>
                <View style={styles.deviceMeta}>
                  <Ionicons name="location-outline" size={11} color={Colors.light.textSecondary} />
                  <Text style={styles.deviceLocation} numberOfLines={1}>{device.location}</Text>
                  <Text style={styles.deviceDistance}>· {device.distance}</Text>
                </View>
              </View>
              <Pressable
                style={[
                  styles.connectBtn,
                  isConnected && styles.connectBtnActive,
                  !canConnect && styles.connectBtnDisabled,
                ]}
                onPress={() => handleConnect(device)}
                disabled={!canConnect}
              >
                <Text
                  style={[
                    styles.connectBtnText,
                    isConnected && styles.connectBtnTextActive,
                    !canConnect && styles.connectBtnTextDisabled,
                  ]}
                >
                  {isConnected ? "断开" : "连接"}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {/* Connected hint */}
        {connected && (
          <View style={styles.connectedHint}>
            <Ionicons name="checkmark-circle" size={16} color="#3DAA6E" />
            <Text style={styles.connectedHintText}>
              已连接至 {DEVICES.find((d) => d.id === connected)?.name}，录音将实时同步推送
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#F5EFE6",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: Colors.light.text,
  },
  headerRight: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
  },

  content: { paddingHorizontal: 16, gap: 14, paddingTop: 4 },

  infoCard: {
    backgroundColor: BLUE_BG,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  infoIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  infoText: { flex: 1, gap: 4 },
  infoTitle: { fontSize: 15, fontWeight: "700", color: BLUE_ICON },
  infoSub: { fontSize: 12, color: "#4A5570", lineHeight: 17 },

  statsRow: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statBox: { flex: 1, alignItems: "center", gap: 4 },
  statNum: { fontSize: 22, fontWeight: "700", color: Colors.light.text },
  statLabel: { fontSize: 11, color: Colors.light.textSecondary },
  statDivider: { width: 1, height: 32, backgroundColor: "#EBEBEB" },

  sectionTitle: {
    fontSize: 15, fontWeight: "700", color: Colors.light.text,
    marginTop: 4,
  },

  deviceCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  deviceCardActive: {
    borderColor: Colors.light.primary,
  },
  deviceIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  deviceInfo: { flex: 1, gap: 3, minWidth: 0 },
  deviceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deviceName: {
    flex: 1,
    fontSize: 14, fontWeight: "600", color: Colors.light.text,
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
    flexShrink: 0,
  },
  statusText: { fontSize: 10, fontWeight: "600" },
  deviceType: { fontSize: 11, color: Colors.light.textSecondary },
  deviceMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 1,
  },
  deviceLocation: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  deviceDistance: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    flexShrink: 0,
  },

  connectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.light.primary,
    flexShrink: 0,
  },
  connectBtnActive: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
  },
  connectBtnDisabled: {
    backgroundColor: "#F0F0F0",
  },
  connectBtnText: {
    fontSize: 13, fontWeight: "600", color: "#fff",
  },
  connectBtnTextActive: {
    color: Colors.light.primary,
  },
  connectBtnTextDisabled: {
    color: "#BDBDBD",
  },

  connectedHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E6F5ED",
    borderRadius: 12,
    padding: 12,
  },
  connectedHintText: {
    flex: 1,
    fontSize: 12,
    color: "#2E7D52",
    lineHeight: 17,
  },
});
