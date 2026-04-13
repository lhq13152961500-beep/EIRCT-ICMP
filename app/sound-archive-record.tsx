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
const GREEN    = "#3A9060";
const GREEN_L  = "#E8F5EE";
const BLUE     = "#4060D0";

const CATEGORIES = ["方言", "传统工艺", "工具声音", "民歌小调", "故事传说", "自然声景"];
const VENUE      = "吐峪沟";

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtPlays(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000)  return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function calcRevenue(playCount: number): number {
  return Math.round(playCount * 0.12);
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
  const avatarInitial = displayName.charAt(0);

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
  const [showAll, setShowAll]       = useState(false);
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
        venue: VENUE,
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

  // ── Derived stats ──
  const totalRevenue = myArchives.reduce((s, a) => s + calcRevenue(a.playCount), 0);
  const totalPlays   = myArchives.reduce((s, a) => s + a.playCount, 0);
  const displayedArchives = showAll ? myArchives : myArchives.slice(0, 3);

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      {/* ── Header ── */}
      <LinearGradient colors={["#FFF4EC", "#F5EFE6"]} style={[styles.header, { paddingTop: topPad + 4 }]}>
        <Pressable style={styles.backBtn} onPress={() => { haptic(); router.back(); }}>
          <Ionicons name="chevron-back" size={24} color={TEXT1} />
        </Pressable>
        <Text style={styles.headerTitle}>{activeTab === "record" ? "声音录制" : "我的"}</Text>
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

          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>档案标题 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.titleInput}
            placeholder="例如：坎儿井灌溉时的水流声"
            placeholderTextColor={TEXT3}
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />

          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>声音录制 <Text style={styles.required}>*</Text></Text>
          <View style={styles.recorderCard}>
            {!recUri ? (
              <>
                <View style={styles.recVisualize}>
                  {isRecording ? (
                    Array.from({ length: 20 }).map((_, i) => (
                      <View key={i} style={[styles.recBar, { height: 12 + Math.random() * 24, opacity: 0.6 + Math.random() * 0.4 }]} />
                    ))
                  ) : (
                    <Ionicons name="mic-circle-outline" size={56} color={TEXT3} />
                  )}
                </View>
                {isRecording && <Text style={styles.recTimer}>{fmtDuration(recSeconds)}</Text>}
                <Pressable
                  style={[styles.recMainBtn, isRecording && styles.recMainBtnStop]}
                  onPress={isRecording ? stopRecording : startRecording}
                >
                  <Ionicons name={isRecording ? "stop" : "mic"} size={26} color="#fff" />
                  <Text style={styles.recMainBtnText}>{isRecording ? "停止录制" : "开始录制"}</Text>
                </Pressable>
                {!isRecording && <Text style={styles.recHint}>按下按钮开始录制，支持最长10分钟</Text>}
              </>
            ) : (
              <>
                <View style={styles.recDone}>
                  <Ionicons name="checkmark-circle" size={44} color={GREEN} />
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

          <View style={styles.guideCard}>
            <View style={styles.guideRow}>
              <Ionicons name="information-circle" size={16} color={BLUE} />
              <Text style={styles.guideTitle}>录制建议</Text>
            </View>
            <Text style={styles.guideText}>· 选择安静环境，减少背景噪音</Text>
            <Text style={styles.guideText}>· 录制地道方言时请清晰表达</Text>
            <Text style={styles.guideText}>· 传统工艺类建议配合实际操作过程</Text>
            <Text style={styles.guideText}>· 提交后经审核即可展示在热门档案</Text>
          </View>

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

      {/* ── My tab ── */}
      {activeTab === "mine" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 32 }}
        >
          {/* ── User hero ── */}
          <LinearGradient colors={["#FFF4EC", "#F5EFE6"]} style={styles.heroGrad}>
            {/* top-right decorative arc */}
            <View style={styles.heroDeco1} />

            {/* Avatar row */}
            <View style={styles.heroRow}>
              {/* Avatar */}
              <View style={styles.avatarShadow}>
                <LinearGradient colors={["#F07828", "#D05018"]} style={styles.avatarGrad}>
                  <Text style={styles.avatarText}>{avatarInitial}</Text>
                </LinearGradient>
              </View>

              {/* Name + badges */}
              <View style={styles.heroInfo}>
                <Text style={styles.heroName}>{displayName}</Text>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.certBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={ORANGE} />
                    <Text style={styles.certText}>认证村民</Text>
                  </View>
                  <View style={styles.roleBadge}>
                    <Ionicons name="mic" size={10} color="#fff" />
                    <Text style={styles.roleText}>声音传播者</Text>
                  </View>
                </View>
                <View style={styles.heroMetaRow}>
                  <Ionicons name="location-outline" size={12} color={TEXT3} />
                  <Text style={styles.heroMetaText}>{VENUE}</Text>
                  <Text style={styles.heroMetaDivider}>|</Text>
                  <Ionicons name="calendar-outline" size={12} color={TEXT3} />
                  <Text style={styles.heroMetaText}>加入 {myArchives.length > 0 ? Math.min(myArchives.length * 42, 365) : 126} 天</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* ── Stats cards ── */}
          <View style={styles.statsRow}>
            {/* 累计收益 */}
            <View style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: "#E8F5EE" }]}>
                <Ionicons name="cash-outline" size={22} color={GREEN} />
              </View>
              <Text style={[styles.statValue, { color: GREEN }]}>¥{totalRevenue.toLocaleString()}</Text>
              <Text style={styles.statLabel}>累计收益</Text>
              <View style={styles.statTrendRow}>
                <Ionicons name="trending-up" size={11} color={GREEN} />
                <Text style={[styles.statTrend, { color: GREEN }]}>+18%</Text>
              </View>
            </View>

            {/* 录制档案 */}
            <View style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: "#FFF0E8" }]}>
                <Ionicons name="mic-outline" size={22} color={ORANGE} />
              </View>
              <Text style={[styles.statValue, { color: ORANGE }]}>{myArchives.length}</Text>
              <Text style={styles.statLabel}>录制档案</Text>
              <View style={styles.statTrendRow}>
                <Ionicons name="trending-up" size={11} color={ORANGE} />
                <Text style={[styles.statTrend, { color: ORANGE }]}>本月 +{Math.min(myArchives.length, 3)}</Text>
              </View>
            </View>

            {/* 总播放量 */}
            <View style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: "#E8EEFF" }]}>
                <Ionicons name="play-circle-outline" size={22} color={BLUE} />
              </View>
              <Text style={[styles.statValue, { color: BLUE }]}>{fmtPlays(totalPlays)}</Text>
              <Text style={styles.statLabel}>总播放量</Text>
              <View style={styles.statTrendRow}>
                <Ionicons name="trending-up" size={11} color={BLUE} />
                <Text style={[styles.statTrend, { color: BLUE }]}>+{Math.min(totalPlays, 124)}</Text>
              </View>
            </View>
          </View>

          {/* ── My archives section ── */}
          <View style={styles.sectionPad}>
            <View style={styles.sectionHeader}>
              <Ionicons name="sparkles" size={17} color={ORANGE} />
              <Text style={styles.sectionTitle}>我的档案</Text>
            </View>

            {loadingMine ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={ORANGE} />
              </View>
            ) : myArchives.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="albums-outline" size={48} color={TEXT3} />
                <Text style={styles.emptyTitle}>暂无声音档案</Text>
                <Text style={styles.emptyText}>切换到「声音录制」选项卡，录制并提交你的第一份声音档案吧</Text>
                <Pressable style={styles.goRecordBtn} onPress={() => { haptic(); setActiveTab("record"); }}>
                  <Ionicons name="mic" size={15} color="#fff" />
                  <Text style={styles.goRecordBtnText}>去录制</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {displayedArchives.map((archive) => {
                  const rev = calcRevenue(archive.playCount);
                  const dateStr = archive.createdAt ? archive.createdAt.slice(0, 10) : "";
                  return (
                    <View key={archive.id} style={styles.archiveCard}>
                      {/* title + revenue */}
                      <View style={styles.archiveTopRow}>
                        <Text style={styles.archiveTitle} numberOfLines={2}>{archive.title}</Text>
                        <View style={styles.archiveRevWrap}>
                          <Text style={styles.archiveRevVal}>¥{rev}</Text>
                          <Text style={styles.archiveRevLabel}>收益</Text>
                        </View>
                      </View>

                      {/* tags row */}
                      <View style={styles.archiveTagRow}>
                        <View style={styles.archiveCatTag}>
                          <Text style={styles.archiveCatTagText}>{archive.category}</Text>
                        </View>
                        <View style={[
                          styles.archiveStatusTag,
                          archive.isVerified
                            ? styles.archiveStatusPublished
                            : styles.archiveStatusPending,
                        ]}>
                          <Text style={[
                            styles.archiveStatusText,
                            archive.isVerified ? styles.archiveStatusPublishedText : styles.archiveStatusPendingText,
                          ]}>
                            {archive.isVerified ? "已发布" : "审核中"}
                          </Text>
                        </View>
                      </View>

                      {/* meta row */}
                      <View style={styles.archiveMeta}>
                        <View style={styles.archiveMetaItem}>
                          <Ionicons name="trending-up-outline" size={12} color={TEXT3} />
                          <Text style={styles.archiveMetaText}>{archive.playCount.toLocaleString()} 次播放</Text>
                        </View>
                        <View style={styles.archiveMetaItem}>
                          <Ionicons name="calendar-outline" size={12} color={TEXT3} />
                          <Text style={styles.archiveMetaText}>{dateStr}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}

                {/* More button */}
                {myArchives.length > 3 && (
                  <Pressable
                    style={styles.moreBtn}
                    onPress={() => { haptic(); setShowAll((v) => !v); }}
                  >
                    <Text style={styles.moreBtnText}>{showAll ? "收起" : `查看全部 ${myArchives.length} 份档案`}</Text>
                    <Ionicons name={showAll ? "chevron-up" : "chevron-down"} size={14} color={ORANGE} />
                  </Pressable>
                )}
              </>
            )}
          </View>

          {/* ── Revenue explanation ── */}
          <View style={styles.sectionPad}>
            <LinearGradient colors={["#F07828", "#D05018"]} style={styles.revenueCard}>
              <View style={styles.revenueDeco} />
              <View style={styles.revenueHeader}>
                <Ionicons name="cash-outline" size={16} color="#fff" />
                <Text style={styles.revenueTitle}>收益说明</Text>
              </View>
              {[
                "收益根据播放量和内容质量计算",
                "优质内容将获得平台推荐",
                "每月5日结算上月收益",
                "被学术机构收录可获额外奖励",
              ].map((item, i) => (
                <View key={i} style={styles.revenueItem}>
                  <View style={styles.revenueDot} />
                  <Text style={styles.revenueText}>{item}</Text>
                </View>
              ))}
            </LinearGradient>
          </View>
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

  tabBar:        { flexDirection: "row", backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER },
  tabItem:       { flex: 1, alignItems: "center", paddingVertical: 14, position: "relative" },
  tabText:       { fontSize: 15, fontWeight: "500", color: TEXT3 },
  tabTextActive: { color: ORANGE, fontWeight: "700" },
  tabUnderline:  { position: "absolute", bottom: 0, left: "20%", right: "20%", height: 2.5, backgroundColor: ORANGE, borderRadius: 2 },

  /* Record tab */
  scroll:       { paddingHorizontal: 16, paddingTop: 20 },
  fieldLabel:   { fontSize: 15, fontWeight: "700", color: TEXT1, marginBottom: 10 },
  required:     { color: RED },
  chipRow:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:         { backgroundColor: "#F0EBE3", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: "transparent" },
  chipActive:   { backgroundColor: ORANGE_L, borderColor: ORANGE },
  chipText:     { fontSize: 13, color: TEXT2, fontWeight: "500" },
  chipTextActive: { color: ORANGE, fontWeight: "700" },
  titleInput:   { backgroundColor: CARD_BG, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: TEXT1, borderWidth: 1.5, borderColor: BORDER },
  recorderCard: { backgroundColor: CARD_BG, borderRadius: 20, padding: 20, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  recVisualize: { height: 60, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 10, width: "100%" },
  recBar:       { width: 5, backgroundColor: ORANGE, borderRadius: 3 },
  recTimer:     { fontSize: 32, fontWeight: "800", color: TEXT1, marginBottom: 16 },
  recMainBtn:   { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: ORANGE, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 30, shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  recMainBtnStop: { backgroundColor: RED },
  recMainBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  recHint:       { fontSize: 12, color: TEXT3, marginTop: 12, textAlign: "center" },
  recDone:       { alignItems: "center", paddingVertical: 8, gap: 4 },
  recDoneTitle:  { fontSize: 17, fontWeight: "700", color: TEXT1 },
  recDoneTime:   { fontSize: 28, fontWeight: "800", color: ORANGE },
  recActions:    { flexDirection: "row", gap: 12, marginTop: 16 },
  recActionBtn:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ORANGE_L, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22 },
  recActionText: { fontSize: 14, color: ORANGE, fontWeight: "600" },
  guideCard:  { backgroundColor: "#EEF2FF", borderRadius: 16, padding: 14, marginTop: 16, gap: 5 },
  guideRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  guideTitle: { fontSize: 13, fontWeight: "700", color: BLUE },
  guideText:  { fontSize: 12, color: "#4060A0", lineHeight: 18 },
  submitBtn:      { backgroundColor: ORANGE, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, marginTop: 24, shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  submitBtnText:  { color: "#fff", fontSize: 16, fontWeight: "700" },

  /* Mine tab — hero */
  heroGrad:      { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, overflow: "hidden", borderBottomWidth: 1, borderBottomColor: BORDER },
  heroDeco1:     { position: "absolute", top: -50, right: -50, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(224,112,48,0.07)" },
  heroRow:       { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarShadow:  { shadowColor: ORANGE, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  avatarGrad:    { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  avatarText:    { fontSize: 28, fontWeight: "800", color: "#fff" },
  heroInfo:      { flex: 1 },
  heroName:      { fontSize: 20, fontWeight: "800", color: TEXT1, marginBottom: 8 },
  heroBadgeRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  certBadge:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: ORANGE_L, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: "#F5C8A0" },
  certText:      { fontSize: 11, fontWeight: "700", color: ORANGE },
  roleBadge:     { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: ORANGE, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  roleText:      { fontSize: 11, fontWeight: "700", color: "#fff" },
  heroMetaRow:   { flexDirection: "row", alignItems: "center", gap: 5 },
  heroMetaText:  { fontSize: 12, color: TEXT2 },
  heroMetaDivider: { fontSize: 12, color: BORDER, marginHorizontal: 2 },

  /* Stats */
  statsRow:   { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  statCard:   { flex: 1, backgroundColor: CARD_BG, borderRadius: 16, padding: 14, alignItems: "flex-start", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statValue:  { fontSize: 20, fontWeight: "800", marginBottom: 3 },
  statLabel:  { fontSize: 11, color: TEXT2, marginBottom: 5 },
  statTrendRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  statTrend:  { fontSize: 10, fontWeight: "600" },

  /* Section */
  sectionPad:    { paddingHorizontal: 16, paddingTop: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  sectionTitle:  { fontSize: 16, fontWeight: "700", color: TEXT1 },

  /* Archive cards */
  archiveCard:    { backgroundColor: CARD_BG, borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  archiveTopRow:  { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  archiveTitle:   { flex: 1, fontSize: 14, fontWeight: "700", color: TEXT1, lineHeight: 20, marginRight: 10 },
  archiveRevWrap: { alignItems: "flex-end" },
  archiveRevVal:  { fontSize: 18, fontWeight: "800", color: GREEN },
  archiveRevLabel: { fontSize: 10, color: TEXT3 },
  archiveTagRow:  { flexDirection: "row", gap: 8, marginBottom: 12 },
  archiveCatTag:  { backgroundColor: "#F0EBE3", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  archiveCatTagText: { fontSize: 11, color: TEXT2, fontWeight: "600" },
  archiveStatusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  archiveStatusPublished: { backgroundColor: GREEN_L },
  archiveStatusPending:   { backgroundColor: "#FFF5CC" },
  archiveStatusText:       { fontSize: 11, fontWeight: "700" },
  archiveStatusPublishedText: { color: GREEN },
  archiveStatusPendingText:   { color: "#B08000" },
  archiveMeta:    { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER },
  archiveMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  archiveMetaText: { fontSize: 11, color: TEXT3 },

  /* More button */
  moreBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, marginTop: 4 },
  moreBtnText: { fontSize: 13, color: ORANGE, fontWeight: "600" },

  /* Loading / empty */
  loadingBox: { height: 120, alignItems: "center", justifyContent: "center" },
  emptyBox:   { alignItems: "center", paddingVertical: 40, gap: 10, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: TEXT1 },
  emptyText:  { fontSize: 12, color: TEXT2, textAlign: "center", lineHeight: 18 },
  goRecordBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ORANGE, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 8 },
  goRecordBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  /* Revenue card */
  revenueCard:   { borderRadius: 20, padding: 18, overflow: "hidden", marginBottom: 8 },
  revenueDeco:   { position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.1)" },
  revenueHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 14 },
  revenueTitle:  { fontSize: 15, fontWeight: "700", color: "#fff" },
  revenueItem:   { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  revenueDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.7)", marginTop: 6, flexShrink: 0 },
  revenueText:   { fontSize: 13, color: "rgba(255,255,255,0.93)", lineHeight: 20, flex: 1 },
});
