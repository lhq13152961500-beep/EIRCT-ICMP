import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Easing,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const { width: SW } = Dimensions.get("window");
const PRIMARY = Colors.light.primary;
const BG = "#F5EFE6";
const BLUE_BG = "#DDE8FF";
const BLUE_ICON = "#4271DD";
const GREEN_BG = "#D6F0E3";
const CORAL_BG = "#FFE8E2";
const CORAL_ICON = "#E05A3A";
const ORANGE_BG = "#FFE4CC";
const ORANGE_ICON = "#E07830";

const SCAN_DURATION = 30000;
const RADAR_R = 90;
const ORBIT_R = RADAR_R + 72;

type Device = {
  id: string;
  name: string;
  type: string;
  location: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
  appearAt: number;
  angleDeg: number;
};

const DEVICE_POOL: Device[] = [
  {
    id: "1",
    name: "乡村广播站·南村",
    type: "广播终端",
    location: "河马泉街道 南村路 12号",
    icon: "radio-outline",
    bg: GREEN_BG,
    color: PRIMARY,
    appearAt: 4000,
    angleDeg: 45,
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
    angleDeg: 150,
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
    angleDeg: 230,
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
    angleDeg: 320,
  },
];

const ICON_SIZE = 52;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function devicePos(angleDeg: number) {
  const rad = toRad(angleDeg);
  return {
    x: ORBIT_R * Math.cos(rad),
    y: ORBIT_R * Math.sin(rad),
  };
}

type DeviceNodeProps = {
  device: Device;
  connected: boolean;
  onPress: () => void;
};

function DeviceNode({ device, connected, onPress }: DeviceNodeProps) {
  const appear = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(appear, {
      toValue: 1,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const { x, y } = devicePos(device.angleDeg);

  return (
    <Animated.View
      style={[
        styles.deviceNode,
        {
          transform: [
            { translateX: x },
            { translateY: y },
            { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
          ],
          opacity: appear,
        },
      ]}
    >
      <Pressable onPress={onPress} style={styles.deviceNodeInner}>
        <Animated.View
          style={[
            styles.deviceCircle,
            { backgroundColor: connected ? "#E6F9F0" : device.bg },
            connected && { borderWidth: 2, borderColor: "#3DAA6E" },
            { transform: [{ scale: pulse }] },
          ]}
        >
          <Ionicons
            name={device.icon}
            size={22}
            color={connected ? "#3DAA6E" : device.color}
          />
          {connected && (
            <View style={styles.connectedBadge}>
              <Ionicons name="checkmark" size={9} color="#fff" />
            </View>
          )}
        </Animated.View>
        <Text style={styles.deviceLabel} numberOfLines={1}>
          {device.name.split("·")[0]}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function TerminalScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [phase, setPhase] = useState<"scanning" | "timeout" | "found">("scanning");
  const [foundDevices, setFoundDevices] = useState<Device[]>([]);
  const [confirmDevice, setConfirmDevice] = useState<Device | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = useState(0);

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const sweepRot = useRef(new Animated.Value(0)).current;

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sweepLoop = useRef<Animated.CompositeAnimation | null>(null);
  const pulseLoops = useRef<Animated.CompositeAnimation[]>([]);

  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (intervalRef.current) clearInterval(intervalRef.current);
    sweepLoop.current?.stop();
    pulseLoops.current.forEach((l) => l.stop());
    pulseLoops.current = [];
  };

  const startAnimations = useCallback(() => {
    ring1.setValue(0); ring2.setValue(0); ring3.setValue(0);
    sweepRot.setValue(0);

    const makePulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    const p1 = makePulse(ring1, 0);
    const p2 = makePulse(ring2, 700);
    const p3 = makePulse(ring3, 1400);
    p1.start(); p2.start(); p3.start();
    pulseLoops.current = [p1, p2, p3];

    const sweep = Animated.loop(
      Animated.timing(sweepRot, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    );
    sweep.start();
    sweepLoop.current = sweep;
  }, [ring1, ring2, ring3, sweepRot]);

  const startScan = useCallback(() => {
    setPhase("scanning");
    setFoundDevices([]);
    setElapsed(0);
    const startTime = Date.now();
    startAnimations();

    intervalRef.current = setInterval(() => {
      const e = Date.now() - startTime;
      setElapsed(e);
      if (e >= SCAN_DURATION) {
        clearInterval(intervalRef.current!);
        setFoundDevices((prev) => {
          if (prev.length === 0) setPhase("timeout");
          return prev;
        });
      }
    }, 400);

    DEVICE_POOL.forEach((device) => {
      const t = setTimeout(() => {
        setFoundDevices((prev) => {
          if (prev.find((d) => d.id === device.id)) return prev;
          const next = [...prev, device];
          setPhase("found");
          return next;
        });
      }, device.appearAt);
      timersRef.current.push(t);
    });
  }, [startAnimations]);

  useEffect(() => {
    startScan();
    return clearAllTimers;
  }, []);

  const handleRefresh = () => {
    clearAllTimers();
    setConnectedIds(new Set());
    startScan();
  };

  const handleDevicePress = (device: Device) => {
    if (connectedIds.has(device.id)) {
      router.push({ pathname: "/terminal-device", params: { id: device.id, name: device.name, type: device.type, location: device.location } });
    } else {
      setConfirmDevice(device);
    }
  };

  const handleConfirm = () => {
    if (!confirmDevice) return;
    setConnectedIds((prev) => new Set([...prev, confirmDevice.id]));
    setConfirmDevice(null);
  };

  const remaining = Math.max(0, Math.ceil((SCAN_DURATION - elapsed) / 1000));

  const ringStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.45, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
  });

  const sweepDeg = sweepRot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const AREA = RADAR_R * 2 + ORBIT_R * 2 + ICON_SIZE + 16;

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

      {/* Main radar area */}
      <View style={styles.radarArea}>
        <View style={[styles.radarContainer, { width: AREA, height: AREA }]}>
          {/* Pulse rings */}
          <Animated.View style={[styles.ring, { width: RADAR_R * 2, height: RADAR_R * 2, borderRadius: RADAR_R, borderColor: PRIMARY }, ringStyle(ring1)]} />
          <Animated.View style={[styles.ring, { width: RADAR_R * 2, height: RADAR_R * 2, borderRadius: RADAR_R, borderColor: PRIMARY }, ringStyle(ring2)]} />
          <Animated.View style={[styles.ring, { width: RADAR_R * 2, height: RADAR_R * 2, borderRadius: RADAR_R, borderColor: PRIMARY }, ringStyle(ring3)]} />

          {/* Orbit dashed ring */}
          <View style={[styles.orbitRing, { width: ORBIT_R * 2, height: ORBIT_R * 2, borderRadius: ORBIT_R }]} />

          {/* Center circle */}
          <View style={[styles.centerCircle, { width: RADAR_R * 2, height: RADAR_R * 2, borderRadius: RADAR_R }]}>
            <Animated.View style={[styles.sweepWrap, { transform: [{ rotate: sweepDeg }] }]}>
              <View style={[styles.sweepLine, { height: RADAR_R }]} />
            </Animated.View>
            <Ionicons name="scan-outline" size={38} color={PRIMARY} />
          </View>

          {/* Device nodes around radar */}
          {foundDevices.map((device) => (
            <DeviceNode
              key={device.id}
              device={device}
              connected={connectedIds.has(device.id)}
              onPress={() => handleDevicePress(device)}
            />
          ))}
        </View>

        {/* Status text below radar */}
        <View style={styles.statusBlock}>
          {phase === "scanning" && (
            <Text style={styles.statusTitle}>正在搜索附近终端… {remaining}s</Text>
          )}
          {phase === "found" && (
            <Text style={[styles.statusTitle, { color: "#3DAA6E" }]}>
              已发现 {foundDevices.length} 个终端，点击设备进行关联
            </Text>
          )}
          {phase === "timeout" && (
            <Text style={[styles.statusTitle, { color: "#9E9E9E" }]}>未找到附近终端</Text>
          )}
          {phase === "timeout" && (
            <Text style={styles.statusSub}>请确认设备已开启，或点击下方刷新</Text>
          )}
          {phase === "found" && connectedIds.size > 0 && (
            <Text style={styles.statusSub}>已连接设备可再次点击进入设置</Text>
          )}
        </View>

        {/* Refresh button */}
        {(phase === "timeout" || phase === "found") && (
          <Pressable
            style={[styles.refreshBtn, phase === "found" && styles.refreshBtnOutline]}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh-outline" size={16} color={phase === "found" ? PRIMARY : "#fff"} />
            <Text style={[styles.refreshBtnText, phase === "found" && { color: PRIMARY }]}>
              {phase === "timeout" ? "刷新搜索" : "重新搜索"}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Confirm modal */}
      <Modal visible={!!confirmDevice} transparent animationType="fade" onRequestClose={() => setConfirmDevice(null)}>
        <Pressable style={styles.backdrop} onPress={() => setConfirmDevice(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={[styles.modalIcon, { backgroundColor: confirmDevice?.bg ?? BLUE_BG }]}>
              <Ionicons name={confirmDevice?.icon ?? "scan-outline"} size={30} color={confirmDevice?.color ?? BLUE_ICON} />
            </View>
            <Text style={styles.modalTitle}>关联设备</Text>
            <Text style={styles.modalDeviceName}>{confirmDevice?.name}</Text>
            <Text style={styles.modalType}>{confirmDevice?.type}</Text>
            <Text style={styles.modalSub}>
              关联后，您的录音将实时同步推送至该终端进行展示与播放。{"\n"}是否确认关联？
            </Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setConfirmDevice(null)}>
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
                <Text style={styles.confirmText}>确认关联</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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

  radarArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingBottom: 40,
  },

  radarContainer: {
    alignItems: "center",
    justifyContent: "center",
  },

  ring: {
    position: "absolute",
    borderWidth: 2,
  },

  orbitRing: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(66,113,221,0.18)",
    borderStyle: "dashed",
  },

  centerCircle: {
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },

  sweepWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 2,
    marginLeft: -1,
    alignItems: "center",
  },
  sweepLine: {
    width: 2,
    backgroundColor: PRIMARY,
    opacity: 0.3,
    borderRadius: 1,
    position: "absolute",
    bottom: 0,
  },

  /* Device nodes */
  deviceNode: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: ICON_SIZE + 24,
    height: ICON_SIZE + 28,
    marginLeft: -(ICON_SIZE + 24) / 2,
    marginTop: -(ICON_SIZE + 28) / 2,
  },
  deviceNodeInner: { alignItems: "center", gap: 4 },
  deviceCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  connectedBadge: {
    position: "absolute",
    top: 2, right: 2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#3DAA6E",
    alignItems: "center", justifyContent: "center",
  },
  deviceLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.light.text,
    maxWidth: ICON_SIZE + 20,
    textAlign: "center",
  },

  statusBlock: { alignItems: "center", gap: 6 },
  statusTitle: { fontSize: 15, fontWeight: "600", color: Colors.light.text, textAlign: "center" },
  statusSub: { fontSize: 12, color: Colors.light.textSecondary, textAlign: "center" },

  refreshBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 24,
    paddingHorizontal: 28, paddingVertical: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 5,
  },
  refreshBtnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: PRIMARY,
    shadowOpacity: 0,
    elevation: 0,
  },
  refreshBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  /* Modal */
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center",
    paddingHorizontal: 28,
  },
  sheet: {
    width: "100%", backgroundColor: "#fff",
    borderRadius: 24, padding: 28,
    alignItems: "center", gap: 8,
  },
  modalIcon: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: Colors.light.text },
  modalDeviceName: { fontSize: 15, fontWeight: "600", color: PRIMARY },
  modalType: { fontSize: 12, color: Colors.light.textSecondary },
  modalSub: {
    fontSize: 13, color: Colors.light.textSecondary,
    textAlign: "center", lineHeight: 19, marginTop: 4,
  },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: 10, width: "100%" },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14,
    borderWidth: 1.5, borderColor: "#E0E0E0", alignItems: "center",
  },
  cancelText: { fontSize: 15, fontWeight: "600", color: Colors.light.textSecondary },
  confirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 14,
    backgroundColor: PRIMARY, alignItems: "center",
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28, shadowRadius: 8, elevation: 5,
  },
  confirmText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
