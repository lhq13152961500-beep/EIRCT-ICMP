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
  Modal,
} from "react-native";
import MapLocationPicker from "@/components/MapLocationPicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useRecordings, type PublishedRecording } from "@/contexts/RecordingsContext";

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
  return new Promise<T>((resolve, reject) => {
    const timerId = setTimeout(() => reject(new Error(`${ms}ms timeout exceeded`)), ms);
    promise.then(
      (v) => { clearTimeout(timerId); resolve(v); },
      (e) => { clearTimeout(timerId); reject(e); }
    );
  });
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

type MusicItem = {
  id: number;
  name: string;
  mood: string;
  desc: string;
  color: string;
  thumb: ReturnType<typeof require>;
};

const MUSIC_LIST: MusicItem[] = [
  { id: 1, name: "空山新雨", mood: "宁静", desc: "山间雨后，万籁俱寂，轻柔钢琴与自然水声交融", color: "#4A9B7F", thumb: require("@/assets/images/diary-thumb-1.png") },
  { id: 2, name: "晨曦微露", mood: "欢快", desc: "清晨第一缕阳光，轻快吉他与鸟鸣相伴，元气满满", color: "#E8A24A", thumb: require("@/assets/images/diary-thumb-2.png") },
  { id: 3, name: "古村斜阳", mood: "怀旧", desc: "夕阳西下，老村炊烟，悠扬二胡诉说岁月故事", color: "#C4783A", thumb: require("@/assets/images/sound-thumb-1.png") },
  { id: 4, name: "溪涧流声", mood: "自然", desc: "山涧潺潺，清风拂叶，纯粹自然声景，不加修饰", color: "#3D8BAA", thumb: require("@/assets/images/sound-thumb-2.png") },
  { id: 5, name: "夜雨敲窗", mood: "沉静", desc: "夜雨淅沥，屋檐滴水，适合深夜记录内心独白", color: "#5C6B8A", thumb: require("@/assets/images/route-thumb-1.png") },
  { id: 6, name: "炉火烟雨", mood: "温暖", desc: "柴火噼啪，烟雨蒙蒙，围炉而坐的温馨时光", color: "#B05A3A", thumb: require("@/assets/images/route-thumb-2.png") },
  { id: 7, name: "远山钟声", mood: "禅意", desc: "晨钟暮鼓，远山空谷，引人沉思，心归平静", color: "#6B7B5A", thumb: require("@/assets/images/hero-landscape.png") },
  { id: 8, name: "竹林幽径", mood: "悠然", desc: "竹叶沙沙，林间小道，慢步其中，忘却烦忧", color: "#3DAA6F", thumb: require("@/assets/images/landscape-hero.png") },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordingState = "idle" | "recording" | "paused" | "finished";

type LocationStatus =
  | { state: "none" }
  | { state: "denied" }
  | { state: "located"; lat: number; lng: number; locationName: string };

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

  const { addMyRecording, setDeviceLocation } = useRecordings();
  const [isPublishing, setIsPublishing] = useState(false);

  const [locationStatus, setLocationStatus] = useState<LocationStatus>({ state: "none" });
  const [isLocating, setIsLocating] = useState(true);
  const [watchActive, setWatchActive] = useState(false);
  const [locationTrigger, setLocationTrigger] = useState(0);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [recState, setRecState]     = useState<RecordingState>("idle");
  const [elapsed, setElapsed]       = useState(0);
  const [envSound, setEnvSound]     = useState(true);
  const [selectedMusic, setSelectedMusic] = useState<number | null>(null);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [previewingMusic, setPreviewingMusic] = useState<number | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewSoundMusicRef = useRef<Audio.Sound | null>(null);
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
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      previewSoundMusicRef.current?.unloadAsync().catch(() => {});
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
      setDeviceLocation({ lat: latitude, lng: longitude });
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

        // 2) watchPositionAsync — registers with OS location provider, fires when a fix arrives
        if (mounted) {
          try {
            locationSubRef.current?.remove();
            const sub = await withTimeout(
              Location.watchPositionAsync(
                { accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: true, distanceInterval: 5 },
                (l) => {
                  console.log("[loc] watch fired", l.coords.latitude, l.coords.longitude);
                  update(l.coords);
                }
              ),
              6000, "watchSetup"
            );
            if (mounted) { locationSubRef.current = sub; setWatchActive(true); console.log("[loc] watch subscribed"); }
          } catch (e) { console.warn("[loc] watch failed:", e); }
        }

        // 3) One-shot getCurrentPositionAsync as extra attempt
        if (mounted && !gotFix) {
          try {
            const pos = await withTimeout(
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: true }),
              12000, "getCurrent"
            );
            if (mounted) {
              console.log("[loc] getCurrent succeeded");
              update(pos.coords);
            }
          } catch (e) { console.warn("[loc] getCurrent failed:", e); }
        }

        // 4) Fallback: GPS unavailable on this device — use a temporary demo location
        if (mounted && !gotFix) {
          console.log("[loc] using fallback demo location");
          const FALLBACK_LAT = 43.8223;
          const FALLBACK_LNG = 87.5987;
          update({ latitude: FALLBACK_LAT, longitude: FALLBACK_LNG });
        }

        if (mounted) setIsLocating(false);
      })().catch(() => {});
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

  // ── Image Picker ──────────────────────────────────────────────────────────

  const pickImage = useCallback(async () => {
    haptic();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("需要相册权限", "请在系统设置中允许访问相册");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets.length > 0) {
      setSelectedImage(result.assets[0].uri);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    haptic();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("需要相机权限", "请在系统设置中允许访问相机");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets.length > 0) {
      setSelectedImage(result.assets[0].uri);
    }
  }, []);

  // ── Publish ────────────────────────────────────────────────────────────────

  const handlePublish = useCallback(() => {
    if (locationStatus.state !== "located") {
      Alert.alert("无法发布", "请先等待 GPS 定位成功后再发布。");
      return;
    }
    const { lat, lng, locationName } = locationStatus;
    const title = `声音随记·${locationName}`;
    Alert.alert(
      "发布声音随记",
      `将在「${locationName}」发布这段录音（${formatTime(elapsed)}），100 米内的旅人可以接收，是否确认？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "确认发布",
          onPress: async () => {
            haptic(Haptics.ImpactFeedbackStyle.Medium);
            setIsPublishing(true);
            try {
              const rec = await apiRequest("POST", "/api/recordings", {
                title,
                locationName,
                lat,
                lng,
                durationSeconds: elapsed,
                author: "附近的旅人",
                quote: null,
                tags: ["#声音随记", "#乡村行旅"],
              }) as PublishedRecording;
              addMyRecording({ ...rec, title, locationName, lat, lng, durationSeconds: elapsed, publishedAt: rec.publishedAt ?? new Date().toISOString(), imageUri: selectedImage ?? undefined, audioUri: finishedUri ?? undefined });
            } catch {
              addMyRecording({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                title,
                locationName,
                lat,
                lng,
                durationSeconds: elapsed,
                publishedAt: new Date().toISOString(),
                imageUri: selectedImage ?? undefined,
                audioUri: finishedUri ?? undefined,
              });
            } finally {
              setIsPublishing(false);
            }
            setFinishedUri(null);
            setElapsed(0);
            setRecState("idle");
            setSelectedImage(null);
            Alert.alert("发布成功 🌿", `已发布到「${locationName}」，100 米内的旅人可以聆听，作品已保存在「我的日记」`);
          },
        },
      ]
    );
  }, [locationStatus, elapsed, addMyRecording, selectedImage, finishedUri]);

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

  const stopMusicPreview = useCallback(async () => {
    if (previewTimerRef.current) { clearTimeout(previewTimerRef.current); previewTimerRef.current = null; }
    if (previewSoundMusicRef.current) {
      await previewSoundMusicRef.current.stopAsync().catch(() => {});
      await previewSoundMusicRef.current.unloadAsync().catch(() => {});
      previewSoundMusicRef.current = null;
    }
    setPreviewingMusic(null);
  }, []);

  const toggleMusicPreview = useCallback(async (id: number) => {
    haptic();
    if (previewingMusic === id) { await stopMusicPreview(); return; }
    await stopMusicPreview();
    setPreviewingMusic(id);
    previewTimerRef.current = setTimeout(() => setPreviewingMusic(null), 4000);
  }, [previewingMusic, stopMusicPreview]);

  const confirmMapLocation = useCallback(async (lat: number, lng: number) => {
    const name = await reverseGeocode(lat, lng);
    setLocationStatus({ state: "located", lat, lng, locationName: name });
    setShowMapPicker(false);
  }, []);

  const gpsReady = locationStatus.state === "located";

  // ── Location Card ──────────────────────────────────────────────────────────

  const renderLocationCard = () => {
    if (locationStatus.state === "denied") {
      return (
        <View style={[styles.locationCard, styles.locationCardWarn]}>
          <View style={styles.locationDotRow}>
            <View style={[styles.locationDot, { backgroundColor: "#E8524A" }]} />
            <Text style={styles.locationLabel}>位置权限已拒绝</Text>
          </View>
          <Text style={styles.locationNameSmall}>请在设置中允许位置权限，或手动在地图上选点</Text>
          {Platform.OS !== "web" && (
            <Pressable
              onPress={() => { haptic(); setShowMapPicker(true); }}
              style={styles.mapPickBtn}
            >
              <Ionicons name="map-outline" size={14} color="#fff" />
              <Text style={styles.mapPickBtnText}>手动选点</Text>
            </Pressable>
          )}
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
          <Text style={styles.locationDistText}>发布后 100 米内的旅人可听见</Text>
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
              : "GPS 信号不可用，可在地图上手动标注你的位置"}
        </Text>
        {!stillTrying && Platform.OS !== "web" && (
          <Pressable
            onPress={() => { haptic(); setShowMapPicker(true); }}
            style={styles.mapPickBtn}
          >
            <Ionicons name="map-outline" size={14} color="#fff" />
            <Text style={styles.mapPickBtnText}>手动选点</Text>
          </Pressable>
        )}
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
          </View>
        );
    }
  };

  const showMicBtn = recState === "idle" || recState === "recording" || recState === "paused";

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* ── Map Location Picker Modal ──────────────────────────────────────── */}
      <MapLocationPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={confirmMapLocation}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + (recState === "finished" ? 160 : 100) }]}
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
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.musicScroll}>
            {/* 不添加 card */}
            <Pressable
              style={styles.musicCard}
              onPress={() => { setSelectedMusic(null); haptic(); stopMusicPreview(); }}
            >
              <View style={[
                styles.musicThumb,
                styles.musicNoThumb,
                selectedMusic === null && { borderColor: Colors.light.primary },
              ]}>
                {/* Music note with diagonal strikethrough */}
                <View style={{ alignItems: "center", justifyContent: "center" }}>
                  <Ionicons
                    name="musical-note-outline"
                    size={30}
                    color={selectedMusic === null ? Colors.light.primary : "#BDB8B3"}
                  />
                  <View style={[
                    styles.musicNoThumbLine,
                    selectedMusic === null && { backgroundColor: Colors.light.primary },
                  ]} />
                </View>
              </View>
              <Text style={[styles.musicName, selectedMusic === null && { color: Colors.light.primary }]}>不添加</Text>
              <Text style={styles.musicMood}>纯净原声</Text>
            </Pressable>

            {/* Recommended: first 4 tracks */}
            {MUSIC_LIST.slice(0, 4).map((m) => {
              const selected = selectedMusic === m.id;
              const playing = previewingMusic === m.id;
              return (
                <Pressable
                  key={m.id}
                  style={styles.musicCard}
                  onPress={() => {
                    setSelectedMusic(m.id);
                    haptic();
                    if (previewingMusic !== null && previewingMusic !== m.id) stopMusicPreview();
                  }}
                >
                  <View style={styles.musicThumbWrap}>
                    <Image
                      source={m.thumb}
                      style={[styles.musicThumb, selected && { borderColor: Colors.light.primary }]}
                      resizeMode="cover"
                    />
                    {/* Preview button — only visible on selected card */}
                    {selected && (
                      <Pressable
                        style={[styles.musicPlayOverlay, playing && styles.musicPlayOverlayActive]}
                        onPress={(e) => { e.stopPropagation?.(); toggleMusicPreview(m.id); }}
                        hitSlop={8}
                      >
                        <Ionicons
                          name={playing ? "stop" : "musical-note"}
                          size={13}
                          color="#fff"
                        />
                      </Pressable>
                    )}
                  </View>
                  <Text style={[styles.musicName, selected && { color: Colors.light.primary }]} numberOfLines={1}>{m.name}</Text>
                  <Text style={[styles.musicMood, playing && { color: Colors.light.primary }]}>
                    {playing ? "试听中…" : m.mood}
                  </Text>
                </Pressable>
              );
            })}

            {/* "更多" card to open modal */}
            <Pressable style={styles.musicCard} onPress={() => { haptic(); setShowMusicModal(true); }}>
              <View style={[styles.musicThumb, styles.musicMoreThumb]}>
                <View style={{ alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="musical-notes-outline" size={28} color={Colors.light.primary} />
                  {/* "+" badge */}
                  <View style={styles.musicMoreBadge}>
                    <Text style={styles.musicMoreBadgeText}>+</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.musicName, { color: Colors.light.primary }]}>更多</Text>
              <Text style={styles.musicMood}>查看全部</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Image Picker Section */}
        <View style={styles.imageSection}>
          <View style={styles.musicHeader}>
            <Text style={styles.musicTitle}>添加风景图片</Text>
            {selectedImage && (
              <Pressable onPress={() => { setSelectedImage(null); haptic(); }} style={styles.imageResetBtn}>
                <Ionicons name="refresh-outline" size={14} color={Colors.light.textSecondary} />
                <Text style={styles.imageResetText}>重新选择</Text>
              </Pressable>
            )}
          </View>
          {selectedImage ? (
            /* Selected: show thumbnail card + full-view card side by side */
            <View style={styles.imageSelectedRow}>
              <Pressable onPress={() => { haptic(); setShowImageViewer(true); }} style={styles.imageSelectedCard}>
                <Image source={{ uri: selectedImage }} style={styles.imageSelectedThumb} resizeMode="cover" />
                <View style={styles.imageSelectedOverlay}>
                  <Ionicons name="expand-outline" size={13} color="#fff" />
                </View>
              </Pressable>
              <View style={styles.imageSelectedInfo}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.light.primary} />
                <Text style={styles.imageSelectedLabel}>已添加</Text>
                <Text style={styles.imageSelectedSub}>裁剪后的图片将显示{"\n"}在日记卡片左侧</Text>
                <Text style={styles.imageSelectedSub}>点击缩略图{"\n"}可全屏查看</Text>
              </View>
            </View>
          ) : (
            /* Not selected: two action cards matching music card style */
            <View style={styles.imageButtonRow}>
              <Pressable style={styles.imageActionCard} onPress={takePhoto}>
                <View style={[styles.musicThumb, styles.imageActionThumb]}>
                  <Ionicons name="camera-outline" size={32} color={Colors.light.primary} />
                </View>
                <Text style={styles.musicName}>当下拍摄</Text>
                <Text style={styles.musicMood}>实时拍照</Text>
              </Pressable>
              <Pressable style={styles.imageActionCard} onPress={pickImage}>
                <View style={[styles.musicThumb, styles.imageActionThumb]}>
                  <Ionicons name="images-outline" size={32} color={Colors.light.primary} />
                </View>
                <Text style={styles.musicName}>相册选择</Text>
                <Text style={styles.musicMood}>从图库选取</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Full-screen Image Viewer */}
        <Modal
          visible={showImageViewer}
          animationType="fade"
          transparent
          statusBarTranslucent
          onRequestClose={() => setShowImageViewer(false)}
        >
          <Pressable style={styles.imageViewerOverlay} onPress={() => setShowImageViewer(false)}>
            {selectedImage && (
              <Image source={{ uri: selectedImage }} style={styles.imageViewerImg} resizeMode="contain" />
            )}
            <Pressable style={styles.imageViewerClose} onPress={() => setShowImageViewer(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </Pressable>
        </Modal>

        {/* Music Modal */}
        <Modal
          visible={showMusicModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowMusicModal(false)}
        >
          <View style={styles.musicModal}>
            <View style={styles.musicModalHeader}>
              <Text style={styles.musicModalTitle}>选择背景配乐</Text>
              <Pressable onPress={() => setShowMusicModal(false)} style={styles.musicModalClose}>
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.musicModalList}>
              {/* 不添加 row */}
              <Pressable
                style={[styles.musicRow, selectedMusic === null && styles.musicRowSelected]}
                onPress={() => { setSelectedMusic(null); haptic(); setShowMusicModal(false); }}
              >
                <View style={[styles.musicRowThumb, styles.musicRowNoThumb, selectedMusic === null && { borderColor: Colors.light.primary }]}>
                  <View style={{ alignItems: "center", justifyContent: "center" }}>
                    <Ionicons
                      name="musical-note-outline"
                      size={22}
                      color={selectedMusic === null ? Colors.light.primary : "#BDB8B3"}
                    />
                    <View style={[
                      styles.musicRowNoThumbLine,
                      selectedMusic === null && { backgroundColor: Colors.light.primary },
                    ]} />
                  </View>
                </View>
                <View style={styles.musicRowInfo}>
                  <Text style={[styles.musicRowName, selectedMusic === null && { color: Colors.light.primary }]}>不添加背景音乐</Text>
                  <Text style={styles.musicRowDesc}>保留录音原声，不叠加任何配乐</Text>
                </View>
                {selectedMusic === null && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.light.primary} />
                )}
              </Pressable>

              <Text style={styles.musicModalSectionLabel}>全部配乐</Text>

              {MUSIC_LIST.map((m) => {
                const selected = selectedMusic === m.id;
                const playing = previewingMusic === m.id;
                return (
                  <View
                    key={m.id}
                    style={[styles.musicRow, selected && styles.musicRowSelected]}
                  >
                    {/* Thumbnail — with selected checkmark overlay */}
                    <View style={styles.musicRowThumbWrap}>
                      <Image source={m.thumb} style={styles.musicRowThumb} resizeMode="cover" />
                      <View style={[styles.musicRowMoodBadge, { backgroundColor: m.color }]}>
                        <Text style={styles.musicRowMoodText}>{m.mood}</Text>
                      </View>
                      {selected && (
                        <View style={styles.musicRowSelectedBadge}>
                          <Ionicons name="checkmark" size={11} color="#fff" />
                        </View>
                      )}
                    </View>

                    {/* Info — tap to select */}
                    <Pressable
                      style={styles.musicRowInfo}
                      onPress={() => { setSelectedMusic(m.id); haptic(); setShowMusicModal(false); stopMusicPreview(); }}
                    >
                      <Text style={[styles.musicRowName, selected && { color: Colors.light.primary }]}>{m.name}</Text>
                      <Text style={styles.musicRowDesc} numberOfLines={2}>{m.desc}</Text>
                    </Pressable>

                    {/* Play/stop button — always for preview */}
                    <Pressable
                      onPress={() => toggleMusicPreview(m.id)}
                      hitSlop={8}
                      style={styles.musicRowPlayBtn}
                    >
                      {playing
                        ? <Ionicons name="stop-circle" size={26} color="#E8524A" />
                        : <Ionicons name="play-circle-outline" size={26} color={Colors.light.primary} />
                      }
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      </ScrollView>

      {/* ── Floating Publish Bar — shown only in finished state ── */}
      {recState === "finished" && (
        <View style={[styles.publishBar, { bottom: Platform.OS === "web" ? 84 : 60 + insets.bottom }]}>
          <View style={styles.publishBarInfo}>
            <Ionicons name="musical-note" size={14} color={Colors.light.primary} />
            <Text style={styles.publishBarDur}>{formatTime(elapsed)}</Text>
            {locationStatus.state === "located" && (
              <>
                <Ionicons name="location-sharp" size={12} color={Colors.light.textSecondary} />
                <Text style={styles.publishBarLoc} numberOfLines={1}>{locationStatus.locationName}</Text>
              </>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.publishBtn,
              !gpsReady && styles.publishBtnDisabled,
              pressed && gpsReady && { opacity: 0.85, transform: [{ scale: 0.97 }] },
            ]}
            onPress={handlePublish}
            disabled={!gpsReady || isPublishing}
          >
            {isPublishing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            }
            <Text style={styles.publishBtnText}>
              {isPublishing ? "发布中…" : gpsReady ? "发布随记" : "等待定位"}
            </Text>
          </Pressable>
        </View>
      )}
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
  locationName: { fontSize: 14, fontWeight: "600", color: Colors.light.text, letterSpacing: 0.2, textAlign: "center", lineHeight: 20 },
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

  publishBar: {
    position: "absolute", left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#ECEAE5",
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
    flexDirection: "row", alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8,
    zIndex: 100,
  },
  publishBarInfo: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 5, overflow: "hidden",
  },
  publishBarDur: { fontSize: 13, fontWeight: "600", color: Colors.light.text },
  publishBarLoc: { fontSize: 12, color: Colors.light.textSecondary, flex: 1 },
  publishBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.light.primary,
    borderRadius: 22, paddingHorizontal: 20, paddingVertical: 11,
    shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  publishBtnDisabled: { backgroundColor: "#B5CFC0", shadowOpacity: 0 },
  publishBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

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

  // Music section
  musicSection: { width: "100%", gap: 14 },
  musicHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  musicTitle: { fontSize: 16, fontWeight: "700", color: Colors.light.text },
  musicSeeAll: { fontSize: 13, color: Colors.light.primary, fontWeight: "500" },
  musicScroll: { gap: 12, paddingRight: 4 },
  musicCard: { width: 100, gap: 6, alignItems: "center" },
  musicThumbWrap: { position: "relative" },
  musicThumb: { width: 100, height: 100, borderRadius: 14, borderWidth: 2.5, borderColor: "transparent" },
  musicNoThumb: {
    backgroundColor: "#F7F5F2", alignItems: "center", justifyContent: "center",
    borderColor: "#E8E4DF",
  },
  musicNoThumbLine: {
    position: "absolute", width: 46, height: 2.5,
    backgroundColor: "#BDB8B3", borderRadius: 2,
    transform: [{ rotate: "45deg" }],
  },
  musicMoreThumb: {
    backgroundColor: "#EDF9F3", alignItems: "center", justifyContent: "center",
    borderColor: "#C6EDD9",
  },
  musicMoreBadge: {
    position: "absolute", top: -8, right: -14,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.light.primary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#fff",
  },
  musicMoreBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" as const, lineHeight: 14 },
  musicPlayOverlay: {
    position: "absolute", top: 6, right: 6, width: 26, height: 26,
    borderRadius: 13, backgroundColor: Colors.light.primary, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3,
  },
  musicPlayOverlayActive: {
    backgroundColor: "#E8524A",
  },
  musicName: { fontSize: 13, fontWeight: "600", color: Colors.light.text, textAlign: "center" },
  musicMood: { fontSize: 11, color: Colors.light.textSecondary, textAlign: "center" },

  // Music modal
  musicModal: { flex: 1, backgroundColor: "#F5F5F0" },
  musicModalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#F0F0EC",
  },
  musicModalTitle: { fontSize: 18, fontWeight: "700", color: Colors.light.text },
  musicModalClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#F0F0EC", alignItems: "center", justifyContent: "center",
  },
  musicModalList: { padding: 16, gap: 10, paddingBottom: 40 },
  musicModalSectionLabel: {
    fontSize: 12, fontWeight: "600", color: Colors.light.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.8, marginTop: 8, marginBottom: 2, marginLeft: 4,
  },
  musicRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#fff", borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  musicRowSelected: { backgroundColor: "#EAF7F0", borderWidth: 1.5, borderColor: Colors.light.primary },
  musicRowThumbWrap: { position: "relative" },
  musicRowThumb: { width: 60, height: 60, borderRadius: 12 },
  musicRowNoThumb: {
    backgroundColor: "#F7F5F2", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#E8E4DF",
  },
  musicRowNoThumbLine: {
    position: "absolute", width: 34, height: 2,
    backgroundColor: "#BDB8B3", borderRadius: 1.5,
    transform: [{ rotate: "45deg" }],
  },
  musicRowMoodBadge: {
    position: "absolute", bottom: -4, right: -4,
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
  },
  musicRowMoodText: { fontSize: 9, color: "#fff", fontWeight: "700" as const },
  musicRowInfo: { flex: 1, gap: 4 },
  musicRowPlayBtn: { padding: 4, alignItems: "center", justifyContent: "center" },
  musicRowSelectedBadge: {
    position: "absolute", top: -4, left: -4, width: 20, height: 20,
    borderRadius: 10, backgroundColor: Colors.light.primary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#fff",
  },
  musicRowName: { fontSize: 15, fontWeight: "600", color: Colors.light.text },
  musicRowDesc: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 17 },

  // Map picker button (on location card)
  mapPickBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 8, backgroundColor: Colors.light.primary,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7,
    alignSelf: "center",
  },
  mapPickBtnText: { fontSize: 13, color: "#fff", fontWeight: "600" as const },

  imageSection: { width: "100%", gap: 14 },
  imageResetBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  imageResetText: { fontSize: 13, color: Colors.light.textSecondary },
  imageButtonRow: { flexDirection: "row", gap: 12 },
  imageActionCard: { width: 100, gap: 6, alignItems: "center" },
  imageActionThumb: {
    backgroundColor: "#EDF9F3", borderColor: "#C6EDD9",
    alignItems: "center", justifyContent: "center",
  },
  imageSelectedRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  imageSelectedCard: {
    width: 100, height: 100, borderRadius: 14, overflow: "hidden",
    position: "relative",
    borderWidth: 2.5, borderColor: Colors.light.primary,
  },
  imageSelectedThumb: { width: "100%", height: "100%" },
  imageSelectedOverlay: {
    position: "absolute", bottom: 5, right: 5,
    backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 8,
    width: 22, height: 22, alignItems: "center", justifyContent: "center",
  },
  imageSelectedInfo: { flex: 1, gap: 5 },
  imageSelectedLabel: { fontSize: 14, fontWeight: "700", color: Colors.light.primary },
  imageSelectedSub: { fontSize: 11, color: Colors.light.textSecondary, lineHeight: 16 },
  imageViewerOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.94)",
    alignItems: "center", justifyContent: "center",
  },
  imageViewerImg: { width: "100%", height: "100%" },
  imageViewerClose: {
    position: "absolute", top: 54, right: 20,
    backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20,
    width: 40, height: 40, alignItems: "center", justifyContent: "center",
  },
});
