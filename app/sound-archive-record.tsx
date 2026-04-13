"use no memo";
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

const BG       = "#F5EFE6";
const CARD_BG  = "#FFFFFF";
const ORANGE   = "#E07030";
const ORANGE_L = "#FFF0E8";
const TEXT1    = "#1A1A2E";
const TEXT2    = "#666880";
const TEXT3    = "#9B9BB0";
const BORDER   = "#F0EBE3";
const RED_L    = "#FFE8E8";
const RED      = "#D04040";

const CATEGORIES = ["方言", "传统工艺", "工具声音", "民歌小调", "故事传说", "自然声景"];

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface MyArchive {
  id: string;
  category: string;
  title: string;
  durationSeconds: number;
  playCount: number;
  isVerified: boolean;
  createdAt: string;
  audioUri?: string;
}

export default function SoundArchiveRecordPage() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { profile, user } = useAuth();
  const displayName = profile?.displayName || user?.username || "游客";

  const [activeTab, setActiveTab] = useState<"record" | "mine">("record");

  // ── Record tab state ──
  const [category, setCategory]     = useState<string>("");
  const [title, setTitle]           = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [recUri, setRecUri]         = useState<string | null>(null);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const playbackRef  = useRef<Audio.Sound | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── My archives state ──
  const [myArchives, setMyArchives] = useState<MyArchive[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [playingId, setPlayingId]   = useState<string | null>(null);
  const mySoundRef = useRef<Audio.Sound | null>(null);

  const haptic = () => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      playbackRef.current?.unloadAsync().catch(() => {});
      mySoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const fetchMyArchives = useCallback(async () => {
    if (!user?.id) return;
    setLoadingMine(true);
    try {
      const res = await apiRequest("GET", `/api/sound-archives?authorId=${user.id}&sort=new&limit=50`);
      const data = await (res as any).json();
      setMyArchives(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoadingMine(false); }
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === "mine") fetchMyArchives();
  }, [activeTab, fetchMyArchives]);

  // ── Recording ──
  const startRecording = async () => {
    haptic();
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert("需要麦克风权限", "请在设置中开启麦克风权限"); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync({
        android: { extension: ".m4a", outputFormat: 2, audioEncoder: 3, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
        ios:     { extension: ".m4a", audioQuality: 127, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web:     {},
      });
      recordingRef.current = recording;
      setIsRecording(true);
      setRecSeconds(0);
      setRecUri(null);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch (e: any) {
      Alert.alert("录音失败", e?.message || "请重试");
    }
  };

  const stopRecording = async () => {
    haptic();
    timerRef.current && clearInterval(timerRef.current);
    const rec = recordingRef.current;
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      setRecUri(uri || null);
    } catch {}
    recordingRef.current = null;
    setIsRecording(false);
  };

  const previewPlayback = async () => {
    haptic();
    if (!recUri) return;
    if (isPlaying) {
      await playbackRef.current?.stopAsync();
      setIsPlaying(false);
      return;
    }
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: recUri }, { shouldPlay: true });
      playbackRef.current = sound;
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((st) => {
        if (st.isLoaded && st.didJustFinish) setIsPlaying(false);
      });
    } catch {}
  };

  const discardRecording = () => {
    haptic();
    setRecUri(null);
    setRecSeconds(0);
  };

  const submitArchive = async () => {
    if (!category) { Alert.alert("请选择声音分类"); return; }
    if (!title.trim()) { Alert.alert("请填写档案标题"); return; }
    if (!recUri)       { Alert.alert("请先录制声音"); return; }
    haptic();
    setSubmitting(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(recUri, { encoding: FileSystem.EncodingType.Base64 });
      await apiRequest("POST", "/api/sound-archives", {
        venue: "吐峪沟",
        category,
        title: title.trim(),
        author: displayName,
        authorId: user?.id,
        durationSeconds: recSeconds,
        audioData: base64,
      });
      Alert.alert("提交成功", "您的声音档案已提交，感谢您的贡献！", [
        { text: "好的", onPress: () => { setTitle(""); setCategory(""); setRecUri(null); setRecSeconds(0); setActiveTab("mine"); } },
      ]);
    } catch (e: any) {
      Alert.alert("提交失败", e?.message || "请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  // ── My archive playback ──
  const stopMySound = async () => {
    if (mySoundRef.current) {
      try { await mySoundRef.current.stopAsync(); await mySoundRef.current.unloadAsync(); } catch {}
      mySoundRef.current = null;
    }
    setPlayingId(null);
  };

  const playMine = async (archive: MyArchive) => {
    haptic();
    if (playingId === archive.id) { await stopMySound(); return; }
    await stopMySound();
    if (!archive.audioUri) return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const apiBase = (global as any).__apiBase || "";
      const { sound } = await Audio.Sound.createAsync({ uri: `${apiBase}${archive.audioUri}` }, { shouldPlay: true });
      mySoundRef.current = sound;
      setPlayingId(archive.id);
      sound.setOnPlaybackStatusUpdate((st) => {
        if (st.isLoaded && st.didJustFinish) { mySoundRef.current = null; setPlayingId(null); }
      });
    } catch {}
  };

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      {/* ── Header ── */}
      <LinearGradient colors={["#FFF4EC", "#F5EFE6"]} style={[styles.header, { paddingTop: topPad + 4 }]}>
        <Pressable style={styles.backBtn} onPress={() => { haptic(); router.back(); }}>
          <Ionicons name="chevron-back" size={24} color={TEXT1} />
        </Pressable>
        <Text style={styles.headerTitle}>声音录制</Text>
        <View style={{ width: 32 }} />
      </LinearGradient>

      {/* ── Tabs ── */}
      <View style={styles.tabBar}>
        {(["record", "mine"] as const).map((tab) => (
          <Pressable key={tab} style={styles.tabItem} onPress={() => { haptic(); setActiveTab(tab); }}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "record" ? "声音录制" : "我的"}
            </Text>
            {activeTab === tab && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      {/* ── Record tab ── */}
      {activeTab === "record" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category selection */}
          <Text style={styles.fieldLabel}>声音分类 <Text style={styles.required}>*</Text></Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => { haptic(); setCategory(cat); }}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
              </Pressable>
            ))}
          </View>

          {/* Title */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>档案标题 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.titleInput}
            placeholder="例如：坎儿井灌溉时的水流声"
            placeholderTextColor={TEXT3}
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />

          {/* Recorder */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>声音录制 <Text style={styles.required}>*</Text></Text>
          <View style={styles.recorderCard}>
            {!recUri ? (
              <>
                <View style={styles.recVisualize}>
                  {isRecording ? (
                    Array.from({ length: 20 }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.recBar,
                          { height: 12 + Math.random() * 24, opacity: 0.6 + Math.random() * 0.4 },
                        ]}
                      />
                    ))
                  ) : (
                    <Ionicons name="mic-circle-outline" size={56} color={TEXT3} />
                  )}
                </View>
                {isRecording && (
                  <Text style={styles.recTimer}>{fmtDuration(recSeconds)}</Text>
                )}
                <Pressable
                  style={[styles.recMainBtn, isRecording && styles.recMainBtnStop]}
                  onPress={isRecording ? stopRecording : startRecording}
                >
                  <Ionicons name={isRecording ? "stop" : "mic"} size={26} color="#fff" />
                  <Text style={styles.recMainBtnText}>{isRecording ? "停止录制" : "开始录制"}</Text>
                </Pressable>
                {!isRecording && (
                  <Text style={styles.recHint}>按下按钮开始录制，支持最长10分钟</Text>
                )}
              </>
            ) : (
              <>
                <View style={styles.recDone}>
                  <Ionicons name="checkmark-circle" size={44} color="#3A9060" />
                  <Text style={styles.recDoneTitle}>录制完成</Text>
                  <Text style={styles.recDoneTime}>{fmtDuration(recSeconds)}</Text>
                </View>
                <View style={styles.recActions}>
                  <Pressable style={styles.recActionBtn} onPress={previewPlayback}>
                    <Ionicons name={isPlaying ? "pause-circle" : "play-circle"} size={22} color={ORANGE} />
                    <Text style={styles.recActionText}>{isPlaying ? "暂停" : "试听"}</Text>
                  </Pressable>
                  <Pressable style={[styles.recActionBtn, { backgroundColor: RED_L }]} onPress={discardRecording}>
                    <Ionicons name="refresh" size={20} color={RED} />
                    <Text style={[styles.recActionText, { color: RED }]}>重录</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>

          {/* Guidelines */}
          <View style={styles.guideCard}>
            <View style={styles.guideRow}>
              <Ionicons name="information-circle" size={16} color="#4060D0" />
              <Text style={styles.guideTitle}>录制建议</Text>
            </View>
            <Text style={styles.guideText}>· 选择安静环境，减少背景噪音</Text>
            <Text style={styles.guideText}>· 录制地道方言时请清晰表达</Text>
            <Text style={styles.guideText}>· 传统工艺类建议配合实际操作过程</Text>
            <Text style={styles.guideText}>· 提交后经审核即可展示在热门档案</Text>
          </View>

          {/* Submit */}
          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={submitArchive}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>提交档案</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      )}

      {/* ── My archives tab ── */}
      {activeTab === "mine" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]}
        >
          {loadingMine ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={ORANGE} />
            </View>
          ) : myArchives.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="albums-outline" size={52} color={TEXT3} />
              <Text style={styles.emptyTitle}>暂无声音档案</Text>
              <Text style={styles.emptyText}>切换到「声音录制」选项卡，录制并提交你的第一份声音档案吧</Text>
              <Pressable style={styles.goRecordBtn} onPress={() => setActiveTab("record")}>
                <Ionicons name="mic" size={16} color="#fff" />
                <Text style={styles.goRecordBtnText}>去录制</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.mineCount}>共 {myArchives.length} 份档案</Text>
              {myArchives.map((archive) => (
                <Pressable
                  key={archive.id}
                  style={styles.mineCard}
                  onPress={() => playMine(archive)}
                >
                  <View style={[styles.minePlayBtn, playingId === archive.id && styles.minePlayBtnActive]}>
                    <Ionicons name={playingId === archive.id ? "pause" : "play"} size={18} color={playingId === archive.id ? "#fff" : ORANGE} />
                  </View>
                  <View style={styles.mineInfo}>
                    <Text style={styles.mineTitle} numberOfLines={2}>{archive.title}</Text>
                    <View style={styles.mineMeta}>
                      <View style={styles.mineTag}>
                        <Text style={styles.mineTagText}>{archive.category}</Text>
                      </View>
                      <Text style={styles.mineMetaText}>{fmtDuration(archive.durationSeconds)}</Text>
                      <Text style={styles.mineMetaText}>·</Text>
                      <Text style={styles.mineMetaText}>{archive.playCount}次播放</Text>
                    </View>
                  </View>
                  <View style={styles.mineStatus}>
                    {archive.isVerified ? (
                      <View style={styles.statusVerified}>
                        <Ionicons name="checkmark-circle" size={13} color="#3A9060" />
                        <Text style={styles.statusVerifiedText}>已审核</Text>
                      </View>
                    ) : (
                      <View style={styles.statusPending}>
                        <Text style={styles.statusPendingText}>审核中</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: TEXT1, textAlign: "center" },

  tabBar:       { flexDirection: "row", backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabItem:      { flex: 1, alignItems: "center", paddingVertical: 14, position: "relative" },
  tabText:      { fontSize: 15, fontWeight: "500", color: TEXT3 },
  tabTextActive: { color: ORANGE, fontWeight: "700" },
  tabUnderline: { position: "absolute", bottom: 0, left: "20%", right: "20%", height: 2.5, backgroundColor: ORANGE, borderRadius: 2 },

  scroll:       { paddingHorizontal: 16, paddingTop: 20 },
  fieldLabel:   { fontSize: 15, fontWeight: "700", color: TEXT1, marginBottom: 10 },
  required:     { color: RED },

  chipRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:         { backgroundColor: "#F0EBE3", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: "transparent" },
  chipActive:   { backgroundColor: ORANGE_L, borderColor: ORANGE },
  chipText:     { fontSize: 13, color: TEXT2, fontWeight: "500" },
  chipTextActive: { color: ORANGE, fontWeight: "700" },

  titleInput:   { backgroundColor: CARD_BG, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: TEXT1, borderWidth: 1.5, borderColor: BORDER },

  recorderCard: { backgroundColor: CARD_BG, borderRadius: 20, padding: 20, alignItems: "center", marginTop: 0, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  recVisualize: { height: 60, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 10, width: "100%" },
  recBar:       { width: 5, backgroundColor: ORANGE, borderRadius: 3 },
  recTimer:     { fontSize: 32, fontWeight: "800", color: TEXT1, fontVariant: ["tabular-nums"], marginBottom: 16 },
  recMainBtn:   { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: ORANGE, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 30, shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  recMainBtnStop: { backgroundColor: RED },
  recMainBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  recHint:       { fontSize: 12, color: TEXT3, marginTop: 12, textAlign: "center" },
  recDone:       { alignItems: "center", paddingVertical: 8, gap: 4 },
  recDoneTitle:  { fontSize: 17, fontWeight: "700", color: TEXT1 },
  recDoneTime:   { fontSize: 28, fontWeight: "800", color: ORANGE, fontVariant: ["tabular-nums"] },
  recActions:    { flexDirection: "row", gap: 12, marginTop: 16 },
  recActionBtn:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ORANGE_L, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22 },
  recActionText: { fontSize: 14, color: ORANGE, fontWeight: "600" },

  guideCard:  { backgroundColor: "#EEF2FF", borderRadius: 16, padding: 14, marginTop: 16, gap: 5 },
  guideRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  guideTitle: { fontSize: 13, fontWeight: "700", color: "#4060D0" },
  guideText:  { fontSize: 12, color: "#4060A0", lineHeight: 18 },

  submitBtn:      { backgroundColor: ORANGE, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, marginTop: 24, shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  submitBtnText:  { color: "#fff", fontSize: 16, fontWeight: "700" },

  loadingBox: { height: 200, alignItems: "center", justifyContent: "center" },
  emptyBox:   { alignItems: "center", paddingVertical: 60, gap: 10, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: TEXT1 },
  emptyText:  { fontSize: 13, color: TEXT2, textAlign: "center", lineHeight: 20 },
  goRecordBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ORANGE, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22, marginTop: 10 },
  goRecordBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  mineCount: { fontSize: 13, color: TEXT3, marginBottom: 12 },
  mineCard:  { backgroundColor: CARD_BG, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  minePlayBtn:      { width: 42, height: 42, borderRadius: 21, backgroundColor: ORANGE_L, alignItems: "center", justifyContent: "center", marginRight: 12, flexShrink: 0 },
  minePlayBtnActive: { backgroundColor: ORANGE },
  mineInfo:  { flex: 1, gap: 4 },
  mineTitle: { fontSize: 14, fontWeight: "700", color: TEXT1 },
  mineMeta:  { flexDirection: "row", alignItems: "center", gap: 6 },
  mineTag:   { backgroundColor: ORANGE_L, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  mineTagText: { fontSize: 10, color: ORANGE, fontWeight: "600" },
  mineMetaText: { fontSize: 11, color: TEXT3 },
  mineStatus:  { marginLeft: 8 },
  statusVerified:     { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#E8F5EE", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  statusVerifiedText: { fontSize: 10, color: "#3A9060", fontWeight: "600" },
  statusPending:      { backgroundColor: "#FFF0C8", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  statusPendingText:  { fontSize: 10, color: "#C08000", fontWeight: "600" },
});
