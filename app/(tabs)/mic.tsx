import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Image,
  Alert,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { apiRequest, getApiUrl } from "@/lib/query-client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const haptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Timeout wrapper ──────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ─── Reverse Geocoding ────────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    if (Platform.OS !== "web") {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.district, r.city].filter(Boolean);
        return parts.slice(0, 2).join(" · ") || "当前位置";
      }
    } else {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh`,
        { headers: { "User-Agent": "guanyou-app/1.0" } }
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address ?? {};
        const parts = [
          addr.tourism ?? addr.amenity ?? addr.road,
          addr.suburb ?? addr.district ?? addr.town,
        ].filter(Boolean);
        return parts.join(" · ") || data.display_name?.split(",")[0] || "当前位置";
      }
    }
  } catch { /* ignore */ }
  return "当前位置";
}

// ─── IP Geolocation fallback ─────────────────────────────────────────────────

interface IpGeoResult { lat: number; lng: number; city: string; region: string }

async function getIpGeolocation(): Promise<IpGeoResult | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) throw new Error("ipapi status " + res.status);
    const data = await res.json();
    if (data.latitude && data.longitude) {
      return {
        lat: data.latitude,
        lng: data.longitude,
        city: data.city ?? "",
        region: data.region ?? "",
      };
    }
  } catch { /* ignore */ }
  // Mirror fallback: ip-api.com
  try {
    const res = await fetch("http://ip-api.com/json/?fields=lat,lon,city,regionName&lang=zh-CN");
    if (!res.ok) throw new Error("ip-api status " + res.status);
    const data = await res.json();
    if (data.lat && data.lon) {
      return { lat: data.lat, lng: data.lon, city: data.city ?? "", region: data.regionName ?? "" };
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Audio Presets ────────────────────────────────────────────────────────────

const ENV_PRESET = Audio.RecordingOptionsPresets.HIGH_QUALITY;

const VOICE_ONLY_PRESET: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
  },
  ios: {
    extension: ".m4a",
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: "audio/webm", bitsPerSecond: 32000 },
};

// ─── Data ────────────────────────────────────────────────────────────────────

const MUSIC_LIST = [
  { id: 1, name: "空山新雨", mood: "宁静", thumb: require("@/assets/images/diary-thumb-1.png") },
  { id: 2, name: "晨曦微露", mood: "欢快", thumb: require("@/assets/images/diary-thumb-2.png") },
  { id: 3, name: "古村斜阳", mood: "怀旧", thumb: require("@/assets/images/sound-thumb-1.png") },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordingState = "idle" | "recording" | "paused" | "finished";

type LocationStatus =
  | { state: "none" }
  | { state: "denied" }
  | { state: "located"; lat: number; lng: number; locationName: string }
  | { state: "ip_located"; lat: number; lng: number; locationName: string };

// ─── Waveform ────────────────────────────────────────────────────────────────

const WAVE_HEIGHTS = [5, 9, 14, 8, 18, 11, 6, 15, 10, 7, 16, 9, 13];

function WaveformBars({ active }: { active: boolean }) {
  const anims = useRef(WAVE_HEIGHTS.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (!active) {
      anims.forEach((a) =>
        Animated.timing(a, { toValue: 1, duration: 250, useNativeDriver: false }).start()
      );
      return;
    }
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, { toValue: 0.2 + (i % 3) * 0.25, duration: 220 + i * 35, useNativeDriver: false }),
          Animated.timing(a, { toValue: 0.6 + (i % 4) * 0.1, duration: 200 + i * 28, useNativeDriver: false }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active]);

  return (
    <View style={styles.waveRow}>
      {WAVE_HEIGHTS.map((h, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveBar,
            { height: anims[i].interpolate({ inputRange: [0, 1], outputRange: [3, h] }) },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Control Button ───────────────────────────────────────────────────────────

function CtrlBtn({
  icon,
  label,
  onPress,
  variant = "ghost",
  disabled = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  variant?: "ghost" | "primary" | "danger" | "outline";
  disabled?: boolean;
}) {
  const bg =
    variant === "primary" ? Colors.light.primary
    : variant === "danger"  ? "#FFE8E8"
    : variant === "outline" ? "#fff"
    : "#F0F4F0";

  const fg =
    variant === "primary" ? "#fff"
    : variant === "danger"  ? "#E8524A"
    : Colors.light.text;

  const border = variant === "outline" ? Colors.light.primary : "transparent";

  return (
    <Pressable
      onPress={() => { if (!disabled) { onPress(); haptic(); } }}
      style={({ pressed }) => [
        styles.ctrlBtn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      <Ionicons name={icon as any} size={20} color={variant === "primary" ? "#fff" : variant === "danger" ? "#E8524A" : Colors.light.primary} />
      <Text style={[styles.ctrlBtnLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MicScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [locationStatus, setLocationStatus] = useState<LocationStatus>({ state: "none" });
  const [isLocating, setIsLocating] = useState(true);
  const [watchActive, setWatchActive] = useState(false);
  const [locationTrigger, setLocationTrigger] = useState(0);
  const [recState, setRecState]     = useState<RecordingState>("idle");
  const [elapsed, setElapsed]       = useState(0);
  const [envSound, setEnvSound]     = useState(true);
  const [selectedMusic, setSelectedMusic] = useState<number | null>(1);
  const [isPreviewing, setIsPreviewing]   = useState(false);
  const [finishedUri, setFinishedUri]     = useState<string | null>(null);

  const recordingRef   = useRef<Audio.Recording | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const envSoundRef    = useRef(envSound);
  envSoundRef.current  = envSound;

  // ── Timer helpers ──────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopTimer();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      previewSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // ── Location Tracking ──────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    let gotFix = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let webWatchId: number | null = null;

    setIsLocating(true);
    setWatchActive(false);
    setLocationStatus({ state: "none" });

    const update = ({ latitude, longitude }: { latitude: number; longitude: number }) => {
      if (!mounted) return;
      gotFix = true;
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      setIsLocating(false);
      setWatchActive(false);
      setLocationStatus({ state: "located", lat: latitude, lng: longitude, locationName: "正在解析地址…" });
      reverseGeocode(latitude, longitude).then((name) => {
        if (mounted) {
          setLocationStatus({ state: "located", lat: latitude, lng: longitude, locationName: name });
        }
      });
    };

    // Stop spinner after 15 seconds if nothing resolves
    timeoutId = setTimeout(() => {
      if (mounted) setIsLocating(false);
    }, 15000);

    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => { if (mounted) update(pos.coords); },
          () => { if (mounted) setIsLocating(false); },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
        );
        webWatchId = navigator.geolocation.watchPosition(
          (pos) => { if (mounted) update(pos.coords); },
          () => {},
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
      } else {
        setIsLocating(false);
      }
    } else {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        if (status !== "granted") {
          setIsLocating(false);
          setLocationStatus({ state: "denied" });
          return;
        }

        // 1) Last known position — instant from device cache
        try {
          const last = await withTimeout(
            Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000, requiredAccuracy: 5000 }),
            3000, "lastKnown"
          );
          if (last && mounted) { console.log("[loc] got lastKnown"); update(last.coords); }
        } catch (e) { console.warn("[loc] lastKnown failed:", e); }

        // 2) Start watchPositionAsync — this is the primary driver.
        //    Android: tries all available providers (network + GPS) and fires as soon as one works.
        //    Much more reliable than getCurrentPositionAsync for first-time fixes.
        if (mounted) {
          try {
            locationSubRef.current?.remove();
            const sub = await withTimeout(
              Location.watchPositionAsync(
                { accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: true, distanceInterval: 5 },
                (l) => { console.log("[loc] watch fired", l.coords.latitude, l.coords.longitude); update(l.coords); }
              ),
              6000, "watchSetup"
            );
            if (mounted) { locationSubRef.current = sub; setWatchActive(true); console.log("[loc] watch subscribed"); }
          } catch (e) { console.warn("[loc] watch failed:", e); }
        }

        // 3) One-shot getCurrentPositionAsync in parallel (resolves quicker in some scenarios)
        if (mounted && !gotFix) {
          try {
            const pos = await withTimeout(
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: true }),
              12000, "getCurrent"
            );
            if (mounted) { console.log("[loc] getCurrent succeeded"); update(pos.coords); }
          } catch (e) { console.warn("[loc] getCurrent failed:", e); }
        }

        if (mounted) setIsLocating(false);
      })();
    }

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (webWatchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(webWatchId);
      }
      locationSubRef.current?.remove();
      locationSubRef.current = null;
    };
  }, [locationTrigger]);

  // ── Recording actions ──────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("提示", "录音功能需在手机端使用");
      return;
    }
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("需要麦克风权限", "请在系统设置中允许此应用使用麦克风");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const preset = envSoundRef.current ? ENV_PRESET : VOICE_ONLY_PRESET;
      const { recording } = await Audio.Recording.createAsync(preset);
      recordingRef.current = recording;
      setElapsed(0);
      setRecState("recording");
      startTimer();
      haptic(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      Alert.alert("录音失败", "无法启动录音，请重试");
    }
  }, [startTimer]);

  const stopPreviewSound = useCallback(async () => {
    if (previewSoundRef.current) {
      await previewSoundRef.current.stopAsync().catch(() => {});
      await previewSoundRef.current.unloadAsync().catch(() => {});
      previewSoundRef.current = null;
      setIsPreviewing(false);
    }
  }, []);

  // Pause = finalize the file so playback works; resume starts a fresh segment
  const pauseRecording = useCallback(async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    try {
      stopTimer();
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      setFinishedUri(uri ?? null);
      setRecState("paused");
      haptic(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Alert.alert("暂停失败", "无法暂停录音");
      startTimer(); // roll back timer if failed
    }
  }, [stopTimer, startTimer]);

  const resumeRecording = useCallback(async () => {
    try {
      await stopPreviewSound();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const preset = envSoundRef.current ? ENV_PRESET : VOICE_ONLY_PRESET;
      const { recording } = await Audio.Recording.createAsync(preset);
      recordingRef.current = recording;
      setFinishedUri(null); // clear the paused segment's URI
      setRecState("recording");
      startTimer();
      haptic(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Alert.alert("继续失败", "无法继续录音");
    }
  }, [startTimer, stopPreviewSound]);

  const deleteRecording = useCallback(async () => {
    Alert.alert("删除录音", "确定要删除这段录音吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          stopTimer();
          await stopPreviewSound();
          await recordingRef.current?.stopAndUnloadAsync().catch(() => {});
          recordingRef.current = null;
          setElapsed(0);
          setFinishedUri(null);
          setRecState("idle");
          haptic(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }, [stopTimer, stopPreviewSound]);

  const finishRecording = useCallback(async () => {
    // From paused state: file is already finalized, just switch to finished
    if (recState === "paused") {
      setRecState("finished");
      haptic(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }
    // From recording state: finalize the file first
    const rec = recordingRef.current;
    if (!rec) return;
    stopTimer();
    await stopPreviewSound();
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      setFinishedUri(uri ?? null);
      setRecState("finished");
      haptic(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Alert.alert("完成失败", "无法保存录音");
    }
  }, [recState, stopTimer, stopPreviewSound]);

  // ── Preview Playback ───────────────────────────────────────────────────────

  const togglePreview = useCallback(async () => {
    if (isPreviewing) {
      await stopPreviewSound();
      return;
    }

    // Only use finishedUri — never read from an open recorder (OS file lock)
    const uri = finishedUri;
    if (!uri) { Alert.alert("暂无录音", "还没有可以试听的内容"); return; }

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      previewSoundRef.current = sound;
      setIsPreviewing(true);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          previewSoundRef.current = null;
          setIsPreviewing(false);
        }
      });
    } catch {
      Alert.alert("试听失败", "录音文件无法读取，请重试");
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    }
  }, [isPreviewing, finishedUri]);

  // ── Publish ────────────────────────────────────────────────────────────────

  const handlePublish = useCallback(() => {
    if (locationStatus.state !== "located") {
      Alert.alert("无法发布", "请先开启定位权限并等待 GPS 定位成功后再发布。");
      return;
    }
    const { lat, lng, locationName } = locationStatus;
    Alert.alert(
      "发布声音随记",
      `将在「${locationName}」发布这段录音 (${formatTime(elapsed)})，50 米内的旅人可以听见，是否确认？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "发布",
          onPress: async () => {
            haptic(Haptics.ImpactFeedbackStyle.Medium);
            try {
              await apiRequest("POST", "/api/recordings", {
                locationName,
                lat,
                lng,
                durationSeconds: elapsed,
              });
            } catch { /* non-critical — local state still resets */ }
            setFinishedUri(null);
            setElapsed(0);
            setRecState("idle");
            Alert.alert("发布成功 🌿", `已发布到「${locationName}」，附近 50 米的旅人可以聆听`);
          },
        },
      ]
    );
  }, [locationStatus, elapsed]);

  const handleDiscard = useCallback(() => {
    Alert.alert("丢弃录音", "确认丢弃这段录音？", [
      { text: "取消", style: "cancel" },
      {
        text: "丢弃",
        style: "destructive",
        onPress: async () => {
          if (previewSoundRef.current) {
            await previewSoundRef.current.stopAsync().catch(() => {});
            await previewSoundRef.current.unloadAsync().catch(() => {});
            previewSoundRef.current = null;
          }
          setIsPreviewing(false);
          setFinishedUri(null);
          setElapsed(0);
          setRecState("idle");
          haptic();
        },
      },
    ]);
  }, []);

  const gpsReady = locationStatus.state === "located";

  // ── Location Card ──────────────────────────────────────────────────────────

  const renderLocationCard = () => {
    if (locationStatus.state === "denied") {
      return (
        <View style={[styles.locationCard, styles.locationCardWarn]}>
          <View style={styles.locationDotRow}>
            <View style={[styles.locationDot, { backgroundColor: "#E8524A" }]} />
            <Text style={styles.locationLabel}>无法获取位置信息</Text>
          </View>
          <Text style={styles.locationNameSmall}>请在设置中允许位置权限</Text>
        </View>
      );
    }

    if (locationStatus.state === "located") {
      const resolving = locationStatus.locationName === "正在解析地址…";
      return (
        <View style={styles.locationCard}>
          <View style={styles.locationDotRow}>
            <View style={styles.locationDot} />
            <Text style={styles.locationLabel}>当前位置</Text>
            <View style={styles.locationBadge}>
              <Ionicons name="location" size={10} color="#fff" />
              <Text style={styles.locationBadgeText}>GPS 已定位</Text>
            </View>
          </View>
          <Text style={styles.locationName}>
            {resolving ? "正在解析地址…" : locationStatus.locationName}
          </Text>
          <Text style={styles.locationDistText}>发布后 50 米内的旅人可听见</Text>
        </View>
      );
    }

    // state === "none"
    const stillTrying = isLocating || watchActive;
    return (
      <View style={[styles.locationCard, stillTrying ? {} : styles.locationCardWarn]}>
        <View style={styles.locationDotRow}>
          <View style={[styles.locationDot, { backgroundColor: stillTrying ? "#B0B0B0" : "#F5974E" }]} />
          <Text style={styles.locationLabel}>
            {isLocating ? "正在获取位置…" : watchActive ? "等待 GPS 信号…" : "无法获取位置"}
          </Text>
          {stillTrying
            ? <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginLeft: 6 }} />
            : (
              <Pressable
                onPress={() => { haptic(); setLocationTrigger((n) => n + 1); }}
                style={styles.retryBtn}
              >
                <Ionicons name="refresh" size={13} color={Colors.light.primary} />
                <Text style={styles.retryBtnText}>重试</Text>
              </Pressable>
            )
          }
        </View>
        <Text style={styles.locationNameSmall}>
          {isLocating
            ? "正在联系定位服务…"
            : watchActive
              ? "GPS 正在搜索卫星，请稍候或走到户外开阔处"
              : "请确认已授予位置权限，并走到户外开阔处以获取 GPS 信号"}
        </Text>
      </View>
    );
  };

  // ── Controls ───────────────────────────────────────────────────────────────

  const renderControls = () => {
    switch (recState) {
      case "idle":
        return <Text style={styles.hint}>点击按钮开始采集声音</Text>;

      case "recording":
        return <WaveformBars active={true} />;

      case "paused":
        return (
          <>
            <WaveformBars active={false} />
            <View style={styles.ctrlRow}>
              <CtrlBtn
                icon={isPreviewing ? "stop-circle-outline" : "play-circle-outline"}
                label={isPreviewing ? "停止" : "试听"}
                onPress={togglePreview}
                variant="ghost"
              />
              <CtrlBtn icon="trash-outline" label="删除" onPress={deleteRecording} variant="danger" />
              <CtrlBtn icon="checkmark-circle-outline" label="完成" onPress={finishRecording} variant="primary" />
            </View>
          </>
        );

      case "finished":
        return (
          <View style={styles.finishedRow}>
            <CtrlBtn
              icon={isPreviewing ? "stop-circle-outline" : "play-circle-outline"}
              label={isPreviewing ? "停止" : "试听"}
              onPress={togglePreview}
              variant="ghost"
            />
            <CtrlBtn icon="trash-outline" label="丢弃" onPress={handleDiscard} variant="danger" />
            <CtrlBtn
              icon="cloud-upload-outline"
              label={gpsReady ? "发布" : "需要定位"}
              onPress={handlePublish}
              variant="primary"
              disabled={!gpsReady}
            />
          </View>
        );
    }
  };

  const showMicBtn = recState === "idle" || recState === "recording" || recState === "paused";

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
      >
        <Text style={styles.pageTitle}>声音随记</Text>

        {renderLocationCard()}

        {/* Timer */}
        <Text
          style={[
            styles.timer,
            recState === "recording" && styles.timerRecording,
            recState === "paused" && styles.timerPaused,
            recState === "finished" && styles.timerFinished,
          ]}
        >
          {formatTime(elapsed)}
        </Text>

        {/* Big mic button — only shown in idle / recording states */}
        {showMicBtn && (
          <Pressable
            style={({ pressed }) => [
              styles.micBtn,
              recState === "recording" && styles.micBtnRecording,
              pressed && { opacity: 0.88, transform: [{ scale: 0.96 }] },
            ]}
            onPress={
              recState === "recording"
                ? pauseRecording
                : recState === "paused"
                ? resumeRecording
                : startRecording
            }
          >
            {recState === "recording" ? (
              <Ionicons name="pause" size={38} color="#fff" />
            ) : recState === "paused" ? (
              <Ionicons name="mic" size={40} color="#fff" />
            ) : (
              <Ionicons name="mic" size={44} color="#fff" />
            )}
          </Pressable>
        )}

        {/* Paused / finished indicator */}
        {recState === "paused" && (
          <View style={styles.pausedBadge}>
            <View style={styles.pausedDot} />
            <Text style={styles.pausedText}>已暂停</Text>
          </View>
        )}
        {recState === "finished" && (
          <View style={styles.finishedBadge}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.light.primary} />
            <Text style={styles.finishedText}>录制完成 · {formatTime(elapsed)}</Text>
          </View>
        )}

        {renderControls()}

        {/* Environment Sound Card */}
        <View style={styles.envCard}>
          <View style={[styles.envIconWrap, !envSound && styles.envIconWrapVoice]}>
            <Ionicons
              name={envSound ? "partly-sunny-outline" : "person-outline"}
              size={20}
              color={envSound ? "#6C8FD6" : Colors.light.primary}
            />
          </View>
          <View style={styles.envInfo}>
            <Text style={styles.envTitle}>环境声音采集</Text>
            <Text style={styles.envSub}>
              {envSound ? "开启：同步录入现场鸟鸣、溪流声" : "关闭：过滤环境声，仅保留人声"}
            </Text>
          </View>
          <Switch
            value={envSound}
            onValueChange={(v) => {
              if (recState !== "idle") {
                Alert.alert("提示", "请先完成或删除当前录音再切换模式");
                return;
              }
              setEnvSound(v);
              haptic();
            }}
            trackColor={{ false: "#D9D9D9", true: Colors.light.primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.modeTip}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          <Text style={styles.modeTipText}>
            {envSound
              ? "全音模式：高清立体声录制，保留一切自然声音"
              : "人声模式：单声道优化，过滤环境噪音、突出说话声"}
          </Text>
        </View>

        {/* Background Music */}
        <View style={styles.musicSection}>
          <View style={styles.musicHeader}>
            <Text style={styles.musicTitle}>推荐背景配乐</Text>
            <Pressable onPress={() => haptic()}>
              <Text style={styles.musicSeeAll}>查看全部</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.musicScroll}>
            {MUSIC_LIST.map((m) => {
              const selected = selectedMusic === m.id;
              return (
                <Pressable key={m.id} style={styles.musicCard} onPress={() => { setSelectedMusic(m.id); haptic(); }}>
                  <Image
                    source={m.thumb}
                    style={[styles.musicThumb, selected && { borderColor: Colors.light.primary }]}
                    resizeMode="cover"
                  />
                  {selected && (
                    <View style={styles.musicPlayOverlay}>
                      <Ionicons name="musical-note" size={14} color="#fff" />
                    </View>
                  )}
                  <Text style={styles.musicName} numberOfLines={1}>{m.name}</Text>
                  <Text style={styles.musicMood}>{m.mood}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F5F0" },
  content: { paddingHorizontal: 20, alignItems: "center", gap: 18 },
  pageTitle: { fontSize: 18, fontWeight: "600", color: Colors.light.text, marginTop: 8, alignSelf: "center" },

  // Location
  locationCard: {
    width: "100%", backgroundColor: "#FFFEF8", borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 14, alignItems: "center", gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  locationCardWarn: { backgroundColor: "#FFFBF5" },
  locationDotRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.light.primary },
  locationLabel: { fontSize: 12, color: Colors.light.textSecondary },
  locationBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: Colors.light.primary, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 4,
  },
  locationBadgeText: { fontSize: 10, color: "#fff", fontWeight: "600" },
  locationName: { fontSize: 19, fontWeight: "700", color: Colors.light.text, letterSpacing: 0.3, textAlign: "center" },
  locationNameSmall: { fontSize: 13, color: Colors.light.textSecondary, textAlign: "center" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(61,170,111,0.10)",
  },
  retryBtnText: { fontSize: 12, color: Colors.light.primary, fontWeight: "600" as const },
  locationDistText: { fontSize: 11, color: Colors.light.primary, fontWeight: "500" },
  locationDistRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  locationDistWarn: { fontSize: 11, color: "#F5974E", flexShrink: 1, textAlign: "center" },

  // Timer
  timer: { fontSize: 52, fontWeight: "800", color: Colors.light.text, letterSpacing: 2, fontVariant: ["tabular-nums"] },
  timerRecording: { color: Colors.light.primary },
  timerPaused: { color: "#F5974E" },
  timerFinished: { color: Colors.light.primary },

  // Mic button
  micBtn: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.light.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
  },
  micBtnRecording: { backgroundColor: "#E8524A", shadowColor: "#E8524A" },

  // State badges
  pausedBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFF3E8", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  pausedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#F5974E" },
  pausedText: { fontSize: 13, color: "#F5974E", fontWeight: "600" },
  finishedBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#EAF7F0", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
  },
  finishedText: { fontSize: 13, color: Colors.light.primary, fontWeight: "600" },

  // Controls
  hint: { fontSize: 13, color: Colors.light.textSecondary },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 4, height: 28 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: Colors.light.primary, opacity: 0.8 },

  ctrlRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center" },
  finishedRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "center" },

  ctrlBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
    borderWidth: 1.5,
  },
  ctrlBtnLabel: { fontSize: 14, fontWeight: "600" },

  // Environment
  envCard: {
    width: "100%", backgroundColor: "#fff", borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  envIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EEF1FB", alignItems: "center", justifyContent: "center" },
  envIconWrapVoice: { backgroundColor: "#EAF7F0" },
  envInfo: { flex: 1, gap: 2 },
  envTitle: { fontSize: 14, fontWeight: "600", color: Colors.light.text },
  envSub: { fontSize: 11, color: Colors.light.textSecondary },

  modeTip: { flexDirection: "row", alignItems: "flex-start", gap: 6, width: "100%", paddingHorizontal: 4 },
  modeTipText: { flex: 1, fontSize: 11, color: Colors.light.textSecondary, lineHeight: 16 },

  // Music
  musicSection: { width: "100%", gap: 14 },
  musicHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  musicTitle: { fontSize: 16, fontWeight: "700", color: Colors.light.text },
  musicSeeAll: { fontSize: 13, color: Colors.light.primary, fontWeight: "500" },
  musicScroll: { gap: 12, paddingRight: 4 },
  musicCard: { width: 110, gap: 6, alignItems: "center" },
  musicThumb: { width: 110, height: 110, borderRadius: 14, borderWidth: 2.5, borderColor: "transparent" },
  musicPlayOverlay: {
    position: "absolute", top: 8, right: 8, width: 24, height: 24,
    borderRadius: 12, backgroundColor: Colors.light.primary, alignItems: "center", justifyContent: "center",
  },
  musicName: { fontSize: 13, fontWeight: "600", color: Colors.light.text, textAlign: "center" },
  musicMood: { fontSize: 11, color: Colors.light.textSecondary, textAlign: "center" },
});
