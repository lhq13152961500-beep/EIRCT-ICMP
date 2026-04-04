import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Animated,
  Easing,
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
const PRIMARY = Colors.light.primary;

const SCAN_DURATION = 30000;

type TerminalDevice = {
  id: string;
  name: string;
  type: string;
  location: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
  appearAt: number;
};

const DEVICE_POOL: TerminalDevice[] = [
  {
    id: "1",
    name: "乡村广播站·南村",
    type: "广播终端",
    location: "河马泉街道 南村路 12号",
    icon: "radio-outline",
    bg: GREEN_BG,
    color: PRIMARY,
    appearAt: 4000,
  },
  {
    id: "2",
    name: "民俗文化馆·展示屏",
    type: "展示终端",
    location: "水磨沟区 文化路 88号",
    icon: "tv-outline",
    bg: BLUE_BG,
    color: BLUE_ICON,
    appearAt: 10000,
  },
  {
    id: "3",
    name: "古镇入口·导览亭",
    type: "导览终端",
    location: "沙依巴克区 古镇入口",
    icon: "information-circle-outline",
    bg: ORANGE_BG,
    color: ORANGE_ICON,
    appearAt: 18000,
  },
  {
    id: "4",
    name: "非遗传承中心",
    type: "互动终端",
    location: "天山区 非遗街 3号",
    icon: "musical-notes-outline",
    bg: CORAL_BG,
    color: CORAL_ICON,
    appearAt: 25000,
  },
];

export default function TerminalScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [phase, setPhase] = useState<"scanning" | "timeout" | "done">("scanning");
  const [foundDevices, setFoundDevices] = useState<TerminalDevice[]>([]);
  const [confirmDevice, setConfirmDevice] = useState<TerminalDevice | null>(null);
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const scanRotate = useRef(new Animated.Value(0)).current;

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const startPulseAnimation = useCallback(() => {
    const makePulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    const rotAnim = Animated.loop(
      Animated.timing(scanRotate, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    makePulse(ring1, 0).start();
    makePulse(ring2, 600).start();
    makePulse(ring3, 1200).start();
    rotAnim.start();
  }, [ring1, ring2, ring3, scanRotate]);

  const startScan = useCallback(() => {
    setPhase("scanning");
    setFoundDevices([]);
    setElapsed(0);
    startTimeRef.current = Date.now();

    startPulseAnimation();

    intervalRef.current = setInterval(() => {
      const e = Date.now() - startTimeRef.current;
      setElapsed(e);
      if (e >= SCAN_DURATION) {
        clearInterval(intervalRef.current!);
        setPhase((prev) => (prev === "scanning" ? "timeout" : prev));
      }
    }, 500);

    DEVICE_POOL.forEach((device) => {
      const t = setTimeout(() => {
        setFoundDevices((prev) => {
          if (prev.find((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });
        setPhase("done");
      }, device.appearAt);
      timersRef.current.push(t);
    });
  }, [startPulseAnimation]);

  useEffect(() => {
    startScan();
    return () => {
      clearAllTimers();
      ring1.stopAnimation();
      ring2.stopAnimation();
      ring3.stopAnimation();
      scanRotate.stopAnimation();
    };
  }, []);

  const handleRefresh = () => {
    clearAllTimers();
    ring1.setValue(0);
    ring2.setValue(0);
    ring3.setValue(0);
    scanRotate.setValue(0);
    startScan();
  };

  const handleDevicePress = (device: TerminalDevice) => {
    setConfirmDevice(device);
  };

  const handleConfirmConnect = () => {
    if (!confirmDevice) return;
    setConnectedId(confirmDevice.id);
    setConfirmDevice(null);
  };

  const handleCancelConnect = () => {
    setConfirmDevice(null);
  };

  const remaining = Math.max(0, Math.ceil((SCAN_DURATION - elapsed) / 1000));

  const ringStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
  });

  const rotateDeg = scanRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>终端互联</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Radar scanner */}
        <View style={styles.radarWrap}>
          <Animated.View style={[styles.ring, ringStyle(ring1), { borderColor: PRIMARY }]} />
          <Animated.View style={[styles.ring, ringStyle(ring2), { borderColor: PRIMARY }]} />
          <Animated.View style={[styles.ring, ringStyle(ring3), { borderColor: PRIMARY }]} />
          <View style={styles.radarCircle}>
            <Animated.View style={[styles.radarSweep, { transform: [{ rotate: rotateDeg }] }]}>
              <View style={styles.sweepLine} />
            </Animated.View>
            <Ionicons name="wifi" size={34} color={PRIMARY} />
          </View>
        </View>

        {/* Status text */}
        <View style={styles.statusBlock}>
          {phase === "scanning" && foundDevices.length === 0 && (
            <>
              <Text style={styles.statusTitle}>正在搜索附近终端…</Text>
              <Text style={styles.statusSub}>剩余 {remaining} 秒</Text>
            </>
          )}
          {phase === "done" && (
            <>
              <Text style={[styles.statusTitle, { color: "#3DAA6E" }]}>
                已发现 {foundDevices.length} 个终端设备
              </Text>
              <Text style={styles.statusSub}>点击设备进行关联</Text>
            </>
          )}
          {phase === "timeout" && foundDevices.length === 0 && (
            <>
              <Text style={[styles.statusTitle, { color: "#9E9E9E" }]}>未找到附近终端</Text>
              <Text style={styles.statusSub}>请确认设备已开启，或刷新重试</Text>
            </>
          )}
        </View>

        {/* Timeout refresh button */}
        {phase === "timeout" && foundDevices.length === 0 && (
          <Pressable style={styles.refreshBtn} onPress={handleRefresh}>
            <Ionicons name="refresh-outline" size={18} color="#fff" />
            <Text style={styles.refreshBtnText}>刷新搜索</Text>
          </Pressable>
        )}

        {/* Refresh during scan (after finding some) */}
        {phase !== "timeout" && foundDevices.length > 0 && (
          <Pressable style={styles.rescanBtn} onPress={handleRefresh}>
            <Ionicons name="refresh-outline" size={15} color={PRIMARY} />
            <Text style={styles.rescanBtnText}>重新搜索</Text>
          </Pressable>
        )}

        {/* Found devices list */}
        {foundDevices.length > 0 && (
          <View style={styles.deviceList}>
            {foundDevices.map((device) => {
              const isConnected = connectedId === device.id;
              return (
                <Pressable
                  key={device.id}
                  style={[styles.deviceCard, isConnected && styles.deviceCardConnected]}
                  onPress={() => !isConnected && handleDevicePress(device)}
                >
                  <View style={[styles.deviceIcon, { backgroundColor: device.bg }]}>
                    <Ionicons name={device.icon} size={22} color={device.color} />
                  </View>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <Text style={styles.deviceType}>{device.type}</Text>
                    <View style={styles.deviceMeta}>
                      <Ionicons name="location-outline" size={11} color={Colors.light.textSecondary} />
                      <Text style={styles.deviceLocation}>{device.location}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusDot, isConnected && styles.statusDotConnected]}>
                    {isConnected
                      ? <Ionicons name="checkmark" size={13} color="#fff" />
                      : <Ionicons name="chevron-forward" size={14} color={Colors.light.textSecondary} />
                    }
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Confirm connection modal */}
      <Modal
        visible={!!confirmDevice}
        transparent
        animationType="fade"
        onRequestClose={handleCancelConnect}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleCancelConnect}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={[styles.modalIconWrap, { backgroundColor: confirmDevice?.bg ?? BLUE_BG }]}>
              <Ionicons name={confirmDevice?.icon ?? "wifi-outline"} size={30} color={confirmDevice?.color ?? BLUE_ICON} />
            </View>
            <Text style={styles.modalTitle}>关联设备</Text>
            <Text style={styles.modalDeviceName}>{confirmDevice?.name}</Text>
            <Text style={styles.modalSub}>
              关联后，您的录音将实时同步推送至该终端进行展示与播放。是否确认关联？
            </Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancelBtn} onPress={handleCancelConnect}>
                <Text style={styles.modalCancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={handleConfirmConnect}>
                <Text style={styles.modalConfirmText}>确认关联</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const RADAR_SIZE = 180;

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
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

  content: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 20,
  },

  /* Radar */
  radarWrap: {
    width: RADAR_SIZE * 2.4,
    height: RADAR_SIZE * 2.4,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 2,
  },
  radarCircle: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },
  radarSweep: {
    position: "absolute",
    top: 0,
    left: RADAR_SIZE / 2 - 1,
    width: 2,
    height: RADAR_SIZE / 2,
    transformOrigin: "bottom center",
  },
  sweepLine: {
    flex: 1,
    backgroundColor: PRIMARY,
    opacity: 0.35,
    borderRadius: 1,
  },

  /* Status */
  statusBlock: { alignItems: "center", gap: 6 },
  statusTitle: { fontSize: 17, fontWeight: "700", color: Colors.light.text },
  statusSub: { fontSize: 13, color: Colors.light.textSecondary },

  /* Buttons */
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 13,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  refreshBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  rescanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  rescanBtnText: { fontSize: 13, fontWeight: "600", color: PRIMARY },

  /* Device list */
  deviceList: { width: "100%", gap: 10 },
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
  deviceCardConnected: {
    borderColor: "#3DAA6E",
    backgroundColor: "#F5FBF8",
  },
  deviceIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  deviceInfo: { flex: 1, gap: 2, minWidth: 0 },
  deviceName: { fontSize: 14, fontWeight: "600", color: Colors.light.text },
  deviceType: { fontSize: 11, color: Colors.light.textSecondary },
  deviceMeta: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 1 },
  deviceLocation: { fontSize: 10, color: Colors.light.textSecondary, flex: 1 },
  statusDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#F0F0F0",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  statusDotConnected: { backgroundColor: "#3DAA6E" },

  /* Confirm modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  modalSheet: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  modalIconWrap: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.light.text },
  modalDeviceName: { fontSize: 14, fontWeight: "600", color: PRIMARY },
  modalSub: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 2,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    width: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    alignItems: "center",
  },
  modalCancelText: { fontSize: 15, fontWeight: "600", color: Colors.light.textSecondary },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
  },
  modalConfirmText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
