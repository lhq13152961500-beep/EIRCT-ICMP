import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { disconnectDevice } from "@/lib/terminal-store";

const PRIMARY = Colors.light.primary;
const BG = "#F5EFE6";
const PURPLE = "#7C4DFF";

export default function TerminalDeviceScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { id, name, type, location } = useLocalSearchParams<{
    id: string;
    name: string;
    type: string;
    location: string;
  }>();

  const [aiDialog, setAiDialog] = useState(true);
  const [routePlanning, setRoutePlanning] = useState(true);
  const [lbsGuide, setLbsGuide] = useState(false);
  const [mobileSync, setMobileSync] = useState(true);
  const [speakerOnly, setSpeakerOnly] = useState(false);

  const [mode, setMode] = useState<"eco" | "performance">("eco");
  const [quality, setQuality] = useState<"standard" | "high">("standard");
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = () => {
    setDisconnecting(true);
    setTimeout(() => {
      disconnectDevice(id ?? "");
      router.back();
    }, 600);
  };

  const featureItems: {
    key: string;
    label: string;
    desc: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    value: boolean;
    onToggle: (v: boolean) => void;
  }[] = [
    {
      key: "ai",
      label: "AI 对话问答",
      desc: "通过语音与小乡进行智能对话",
      icon: "chatbubble-ellipses-outline",
      value: aiDialog,
      onToggle: setAiDialog,
    },
    {
      key: "route",
      label: "路线自适应规划",
      desc: "根据当前位置动态推荐游览路线",
      icon: "map-outline",
      value: routePlanning,
      onToggle: setRoutePlanning,
    },
    {
      key: "lbs",
      label: "LBS 讲解功能",
      desc: "靠近景点自动触发语音讲解",
      icon: "location-outline",
      value: lbsGuide,
      onToggle: setLbsGuide,
    },
    {
      key: "mobile",
      label: "移动端协同",
      desc: "与手机应用实时同步内容与操作",
      icon: "phone-portrait-outline",
      value: mobileSync,
      onToggle: setMobileSync,
    },
    {
      key: "speaker",
      label: "仅扬声器模式",
      desc: "关闭 AI 功能，仅用作音频播放",
      icon: "volume-high-outline",
      value: speakerOnly,
      onToggle: setSpeakerOnly,
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>设备设置</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Device info card */}
        <View style={styles.deviceCard}>
          <View style={[styles.deviceIconWrap, { backgroundColor: "#EDE7F6" }]}>
            <Ionicons name="musical-notes-outline" size={28} color={PURPLE} />
          </View>
          <View style={styles.deviceInfo}>
            <View style={styles.onlineDot} />
            <Text style={styles.deviceName}>{name}</Text>
            <Text style={styles.deviceType}>{type}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={11} color={Colors.light.textSecondary} />
              <Text style={styles.deviceLocation}>{location}</Text>
            </View>
          </View>
          <View style={styles.connectedTag}>
            <Ionicons name="checkmark-circle" size={13} color="#3DAA6E" />
            <Text style={styles.connectedTagText}>已关联</Text>
          </View>
        </View>

        {/* ── 功能选项 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>功能选项</Text>
          <View style={styles.card}>
            {featureItems.map((item, i) => (
              <View key={item.key}>
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: item.value ? PURPLE + "18" : "#F5F5F5" }]}>
                      <Ionicons name={item.icon} size={17} color={item.value ? PURPLE : Colors.light.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingLabel, item.value && { color: PURPLE }]}>{item.label}</Text>
                      <Text style={styles.settingDesc}>{item.desc}</Text>
                    </View>
                  </View>
                  <Switch
                    value={item.value}
                    onValueChange={item.onToggle}
                    trackColor={{ false: "#E0E0E0", true: PURPLE + "55" }}
                    thumbColor={item.value ? PURPLE : "#fff"}
                  />
                </View>
                {i < featureItems.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

        {/* ── 模式选择 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>模式选择</Text>
          <View style={styles.card}>
            <Pressable style={styles.modeRow} onPress={() => setMode("eco")}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconCircle, { backgroundColor: mode === "eco" ? "#E3F2FD" : "#F5F5F5" }]}>
                  <Ionicons
                    name="leaf-outline"
                    size={17}
                    color={mode === "eco" ? "#1976D2" : Colors.light.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, mode === "eco" && { color: "#1976D2" }]}>省电模式</Text>
                  <Text style={styles.settingDesc}>降低功耗，延长待机时间</Text>
                </View>
              </View>
              <View style={[styles.radioOuter, mode === "eco" && { borderColor: "#1976D2" }]}>
                {mode === "eco" && <View style={[styles.radioInner, { backgroundColor: "#1976D2" }]} />}
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.modeRow} onPress={() => setMode("performance")}>
              <View style={styles.settingLeft}>
                <View style={[styles.iconCircle, { backgroundColor: mode === "performance" ? "#FFF3E0" : "#F5F5F5" }]}>
                  <Ionicons
                    name="flash-outline"
                    size={17}
                    color={mode === "performance" ? "#F57C00" : Colors.light.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, mode === "performance" && { color: "#F57C00" }]}>高性能模式</Text>
                  <Text style={styles.settingDesc}>全功能运行，响应更快速</Text>
                </View>
              </View>
              <View style={[styles.radioOuter, mode === "performance" && { borderColor: "#F57C00" }]}>
                {mode === "performance" && <View style={[styles.radioInner, { backgroundColor: "#F57C00" }]} />}
              </View>
            </Pressable>
          </View>
        </View>

        {/* ── 音质设置 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>音质设置</Text>
          <View style={styles.card}>
            <Pressable style={styles.qualityRow} onPress={() => setQuality("standard")}>
              <View style={styles.settingLeft}>
                <Ionicons name="musical-note-outline" size={18} color={PRIMARY} style={styles.settingIcon} />
                <View>
                  <Text style={styles.settingLabel}>标准音质</Text>
                  <Text style={styles.settingDesc}>128kbps · 节省流量</Text>
                </View>
              </View>
              {quality === "standard" && (
                <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
              )}
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.qualityRow} onPress={() => setQuality("high")}>
              <View style={styles.settingLeft}>
                <Ionicons name="musical-notes-outline" size={18} color={PRIMARY} style={styles.settingIcon} />
                <View>
                  <Text style={styles.settingLabel}>高音质</Text>
                  <Text style={styles.settingDesc}>320kbps · 更佳体验</Text>
                </View>
              </View>
              {quality === "high" && (
                <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
              )}
            </Pressable>
          </View>
        </View>

        {/* ── 设备信息 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>设备信息</Text>
          <View style={styles.card}>
            {[
              { label: "设备编号", value: `TRM-${id?.padStart(4, "0") ?? "0001"}` },
              { label: "固件版本", value: "v2.4.1" },
              { label: "信号强度", value: "良好 (-62 dBm)" },
              { label: "延迟", value: "24 ms" },
            ].map((row, i, arr) => (
              <View key={row.label}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

        {/* ── 解除关联 ── */}
        <Pressable
          style={[styles.disconnectBtn, disconnecting && { opacity: 0.6 }]}
          onPress={handleDisconnect}
          disabled={disconnecting}
        >
          <Ionicons name="unlink-outline" size={18} color="#D32F2F" />
          <Text style={styles.disconnectText}>
            {disconnecting ? "正在断开…" : "解除关联"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  headerTitle: {
    flex: 1, textAlign: "center",
    fontSize: 17, fontWeight: "700", color: Colors.light.text,
  },

  content: { paddingHorizontal: 16, gap: 16, paddingTop: 4 },

  deviceCard: {
    backgroundColor: "#fff",
    borderRadius: 18, padding: 16,
    flexDirection: "row", alignItems: "flex-start", gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    borderWidth: 1.5, borderColor: "#3DAA6E" + "40",
  },
  deviceIconWrap: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  deviceInfo: { flex: 1, gap: 3 },
  onlineDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: "#3DAA6E",
    marginBottom: 2,
  },
  deviceName: { fontSize: 15, fontWeight: "700", color: Colors.light.text },
  deviceType: { fontSize: 12, color: Colors.light.textSecondary },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  deviceLocation: { fontSize: 11, color: Colors.light.textSecondary, flex: 1 },
  connectedTag: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#E6F9F0",
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
    flexShrink: 0, alignSelf: "flex-start",
  },
  connectedTagText: { fontSize: 11, fontWeight: "600", color: "#3DAA6E" },

  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: Colors.light.textSecondary, paddingLeft: 4 },
  card: {
    backgroundColor: "#fff", borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 13,
  },
  modeRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 13,
  },
  qualityRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  settingIcon: { width: 22, alignItems: "center" },
  iconCircle: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  settingLabel: { fontSize: 14, fontWeight: "600", color: Colors.light.text },
  settingDesc: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 1 },
  divider: { height: 1, backgroundColor: "#F2F2F2", marginHorizontal: 14 },

  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: "#BDBDBD",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },

  infoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 13,
  },
  infoLabel: { fontSize: 13, color: Colors.light.textSecondary },
  infoValue: { fontSize: 13, fontWeight: "600", color: Colors.light.text },

  disconnectBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 16, paddingVertical: 15,
    borderWidth: 1.5, borderColor: "#FFCDD2",
    marginTop: 4,
  },
  disconnectText: { fontSize: 15, fontWeight: "600", color: "#D32F2F" },
});
