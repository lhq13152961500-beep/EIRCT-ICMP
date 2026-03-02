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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const haptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== "web") Haptics.impactAsync(style).catch(() => {});
};

const MUSIC_LIST = [
  {
    id: 1,
    name: "空山新雨",
    mood: "宁静",
    thumb: require("@/assets/images/diary-thumb-1.png"),
  },
  {
    id: 2,
    name: "晨曦微露",
    mood: "欢快",
    thumb: require("@/assets/images/diary-thumb-2.png"),
  },
  {
    id: 3,
    name: "古村斜阳",
    mood: "怀旧",
    thumb: require("@/assets/images/sound-thumb-1.png"),
  },
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MicScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [envSound, setEnvSound] = useState(true);
  const [selectedMusic, setSelectedMusic] = useState<number | null>(1);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

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
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
      haptic(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      Alert.alert("录音失败", "无法启动录音，请重试");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const rec = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      haptic(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        "录制完成",
        `时长 ${formatTime(elapsed)}，声音随记已保存`,
        [{ text: "好的", style: "default" }]
      );
    } catch {
      // ignore
    }
  }, [elapsed]);

  const handleMicPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
      >
        {/* Title */}
        <Text style={styles.pageTitle}>声音随记</Text>

        {/* Location Card */}
        <View style={styles.locationCard}>
          <View style={styles.locationDotRow}>
            <View style={styles.locationDot} />
            <Text style={styles.locationLabel}>当前关联地标</Text>
          </View>
          <Text style={styles.locationName}>云栖竹径 · 黄岭村</Text>
        </View>

        {/* Timer */}
        <Text style={[styles.timer, isRecording && styles.timerActive]}>
          {formatTime(elapsed)}
        </Text>

        {/* Mic Button */}
        <Pressable
          style={({ pressed }) => [
            styles.micBtn,
            isRecording && styles.micBtnRecording,
            pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
          ]}
          onPress={handleMicPress}
        >
          {isRecording ? (
            <View style={styles.stopIcon} />
          ) : (
            <Ionicons name="mic" size={44} color="#fff" />
          )}
        </Pressable>

        {/* Waveform animation when recording */}
        {isRecording ? (
          <View style={styles.waveRow}>
            {[5, 9, 14, 8, 18, 11, 6, 15, 10, 7, 16, 9, 13].map((h, i) => (
              <View key={i} style={[styles.waveBar, { height: h }]} />
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>点击按钮开始采集声音</Text>
        )}

        {/* Environment Sound Card */}
        <View style={styles.envCard}>
          <View style={styles.envIconWrap}>
            <Ionicons name="partly-sunny-outline" size={20} color="#6C8FD6" />
          </View>
          <View style={styles.envInfo}>
            <Text style={styles.envTitle}>环境声音采集</Text>
            <Text style={styles.envSub}>同步录入现场鸟鸣、溪流声</Text>
          </View>
          <Switch
            value={envSound}
            onValueChange={(v) => {
              setEnvSound(v);
              haptic();
            }}
            trackColor={{ false: "#D9D9D9", true: Colors.light.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* Background Music */}
        <View style={styles.musicSection}>
          <View style={styles.musicHeader}>
            <Text style={styles.musicTitle}>推荐背景配乐</Text>
            <Pressable onPress={() => haptic()}>
              <Text style={styles.musicSeeAll}>查看全部</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.musicScroll}
          >
            {MUSIC_LIST.map((m) => {
              const selected = selectedMusic === m.id;
              return (
                <Pressable
                  key={m.id}
                  style={[styles.musicCard, selected && styles.musicCardSelected]}
                  onPress={() => {
                    setSelectedMusic(m.id);
                    haptic();
                  }}
                >
                  <Image
                    source={m.thumb}
                    style={[styles.musicThumb, selected && { borderColor: Colors.light.primary }]}
                    resizeMode="cover"
                  />
                  {selected && (
                    <View style={styles.musicPlayOverlay}>
                      <Ionicons name="musical-note" size={16} color="#fff" />
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F5F0",
  },
  content: {
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 20,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginTop: 8,
    alignSelf: "center",
  },

  // Location
  locationCard: {
    width: "100%",
    backgroundColor: "#FFFEF8",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  locationDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
  },
  locationLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  locationName: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
    letterSpacing: 0.5,
  },

  // Timer
  timer: {
    fontSize: 52,
    fontWeight: "800",
    color: Colors.light.text,
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  timerActive: {
    color: Colors.light.primary,
  },

  // Mic button
  micBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  micBtnRecording: {
    backgroundColor: "#E8524A",
    shadowColor: "#E8524A",
  },
  stopIcon: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: "#fff",
  },

  // Hint / waveform
  hint: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  waveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.light.primary,
    opacity: 0.75,
  },

  // Environment sound card
  envCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  envIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF1FB",
    alignItems: "center",
    justifyContent: "center",
  },
  envInfo: {
    flex: 1,
    gap: 2,
  },
  envTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  envSub: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },

  // Music section
  musicSection: {
    width: "100%",
    gap: 14,
  },
  musicHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  musicTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
  },
  musicSeeAll: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: "500",
  },
  musicScroll: {
    gap: 12,
    paddingRight: 4,
  },
  musicCard: {
    width: 110,
    gap: 6,
    alignItems: "center",
  },
  musicCardSelected: {},
  musicThumb: {
    width: 110,
    height: 110,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: "transparent",
  },
  musicPlayOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  musicName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.text,
    textAlign: "center",
  },
  musicMood: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
});
