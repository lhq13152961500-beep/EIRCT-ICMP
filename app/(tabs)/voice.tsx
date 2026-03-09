import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  Modal,
  Platform,
  Dimensions,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import Colors from "@/constants/colors";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { useRecordings, type PublishedRecording, type RecordingComment } from "@/contexts/RecordingsContext";
import { useAuth } from "@/contexts/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_BAR_HEIGHT = 80;

function haptic(style = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style);
}

// ─── Audio Manager ────────────────────────────────────────────────────────────
const DEMO_AUDIO_URLS = [
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
];
function getDemoAudio(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h += seed.charCodeAt(i);
  return DEMO_AUDIO_URLS[h % DEMO_AUDIO_URLS.length];
}

let _gSound: Audio.Sound | null = null;
let _gStop: (() => void) | null = null;
async function stopGlobalAudio() {
  if (_gSound) {
    try { await _gSound.stopAsync(); await _gSound.unloadAsync(); } catch {}
    _gSound = null;
  }
  if (_gStop) { _gStop(); _gStop = null; }
}
let _audioModeSet = false;
async function ensureAudioMode() {
  if (_audioModeSet) return;
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
    _audioModeSet = true;
  } catch {}
}

// ─── Recording Manager ────────────────────────────────────────────────────────
let _gRecording: Audio.Recording | null = null;
let _gRecordingStart = 0;

async function startRecording(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (_gRecording) return true;
  try {
    await stopGlobalAudio();
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("需要麦克风权限", "请在系统设置中允许此应用使用麦克风");
      return false;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    _gRecording = recording;
    _gRecordingStart = Date.now();
    _audioModeSet = false;
    return true;
  } catch {
    return false;
  }
}

async function stopRecording(): Promise<{ uri: string | null; duration: string; recorded: boolean }> {
  const start = _gRecordingStart;
  _gRecordingStart = 0;
  if (!_gRecording || start === 0) {
    _gRecording = null;
    return { uri: null, duration: "00:00", recorded: false };
  }
  const elapsed = Math.max(1, Math.floor((Date.now() - start) / 1000));
  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");
  const duration = `${mins}:${secs}`;
  try {
    await _gRecording.stopAndUnloadAsync();
    const uri = _gRecording.getURI() ?? null;
    _gRecording = null;
    return { uri, duration, recorded: true };
  } catch {
    _gRecording = null;
    return { uri: null, duration, recorded: true };
  }
}

// ─── Voice+Text Reply Helper ─────────────────────────────────────────────────

function parseVoiceText(text: string): { body: string; voice: string | null } {
  const sep = "\n🎤 语音 ";
  const idx = text.indexOf(sep);
  if (idx !== -1) return { body: text.slice(0, idx).trim(), voice: text.slice(idx + sep.length).trim() };
  const pureSep = "🎤 语音 ";
  if (text.startsWith(pureSep)) return { body: "", voice: text.slice(pureSep.length).trim() };
  return { body: text, voice: null };
}

function SubReplyContent({ text, style, uri }: { text: string; style?: object; uri?: string | null }) {
  const { body, voice } = parseVoiceText(text);
  return (
    <View style={{ gap: 4 }}>
      {body.length > 0 && <Text style={style}>{body}</Text>}
      {voice && (
        <View style={styles.voiceMixedPill}>
          {uri ? (
            <PlayButton size={20} audioUrl={uri} />
          ) : (
            <Ionicons name="mic" size={11} color={Colors.light.primary} />
          )}
          <View style={styles.voiceMixedWave}>
            {[3, 6, 4, 7, 5, 3, 6].map((h, i) => (
              <View key={i} style={[styles.voiceMixedBar, { height: h * 1.5 }]} />
            ))}
          </View>
          <Text style={styles.voiceMixedDuration}>{voice}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const MY_DIARY_GROUPS = [
  {
    id: "d1",
    title: "听见·黄岭村的清晨",
    date: "2026-02-15 16:05",
    duration: "02:14",
    location: "黄岭村 · 皖南山区",
    thumb: require("@/assets/images/diary-thumb-1.png"),
    listenCount: 66,
    likeCount: 999,
    replies: [
      { id: "r1", title: "故乡·回忆往事", duration: "02:14", date: "2026-02-15 16:05", phone: "18845679515" },
      { id: "r2", title: "故乡·回忆往事", duration: "02:14", date: "2026-02-15 16:05", phone: "18845679515" },
      { id: "r3", title: "故乡·回忆往事", duration: "02:14", date: "2026-02-15 16:05", phone: "18845679515" },
    ],
  },
  {
    id: "d2",
    title: "云边书屋的午后蝉鸣",
    date: "2026-02-14",
    duration: "01:45",
    location: "云边书屋 · 莫干山",
    thumb: require("@/assets/images/diary-thumb-2.png"),
    listenCount: 44,
    likeCount: 96,
    replies: [
      { id: "r4", title: "故乡·回忆往事", duration: "02:14", date: "2026-02-15 16:05", phone: "18845679515" },
      { id: "r5", title: "故乡·回忆往事", duration: "02:14", date: "2026-02-15 16:05", phone: "18845679515" },
    ],
  },
];

const SOUND_POSTCARDS = [
  {
    id: "p1",
    type: "voice",
    typeColor: "#F5974E",
    typeBg: "#FFF0E8",
    title: "乡音速递：来自黄岭村",
    datetime: "2026-02-15 11:30",
    sender: "王大伯（老村民）",
    quote: '"孩子，这是今天早上的鸟叫声，祝你在村里玩得开心..."',
    duration: "01:45",
    progress: 0,
    tags: ["#清晨", "#自然原声"],
    listenCount: 66,
    likeCount: 999,
    comments: [
      { id: "cm1", type: "voice" as const, title: "来自黄岭村的清晨", duration: "00:48", date: "02-15 12:10", phone: "138****6789" },
      { id: "cm2", type: "text" as const, username: "山野行者", time: "02-15 14:30", text: "这段录音太治愈了，谢谢王大伯！" },
    ],
  },
  {
    id: "p2",
    type: "location",
    typeColor: "#6B9FFF",
    typeBg: "#EEF3FF",
    title: "打卡记忆：云边书屋",
    datetime: "2026-02-14 16:20",
    sender: "驴友 莉莉",
    quote: null,
    duration: "02:14",
    progress: 0.25,
    tags: ["#文艺", "#午后蝉鸣"],
    listenCount: 66,
    likeCount: 999,
    comments: [
      { id: "cm3", type: "voice" as const, title: "书屋午后即兴录音", duration: "01:12", date: "02-14 17:05", phone: "155****2233" },
      { id: "cm4", type: "text" as const, username: "绿野探客", time: "02-14 19:20", text: "这个地方我去过，氛围超好的。" },
      { id: "cm5", type: "text" as const, username: "静默山人", time: "02-15 08:00", text: "下次去一定要带录音设备。" },
    ],
  },
];

const CONVERSATION_CHAIN = [
  {
    id: "c1",
    avatar: require("@/assets/images/avatar-1.png"),
    username: "读论文的silan学长",
    isHost: false,
    action: "回应了你的日记《秋收稻浪》",
    text: "你说的对，我非常感佩你描述的那片田野，听了三遍了。",
    progress: 0.25,
    total: "02:14",
    date: "2025年12月1日",
  },
  {
    id: "c2",
    avatar: require("@/assets/images/avatar-2.png"),
    username: "聪明的一休",
    isHost: true,
    action: "作为原作者，回复了你在《云雾山谷》下的留言",
    text: "对，这种山间的清晨真的很难用语言形容，你录下来了。",
    progress: 0.62,
    total: "05:06",
    date: "2025年6月15日",
  },
  {
    id: "c3",
    avatar: require("@/assets/images/avatar-3.png"),
    username: "可爱的常常的Smooth",
    isHost: false,
    action: "回应了你的日记《晨雾中的炊烟》",
    text: "你的想法宣传了我的观念。",
    progress: 0.62,
    total: "05:06",
    date: "2025年6月5日",
  },
  {
    id: "c4",
    avatar: require("@/assets/images/avatar-4.png"),
    username: "倔强的小二哥",
    isHost: false,
    action: "回应了你的日记《村口的老樟树》",
    text: "这段声音真的很触动人心。",
    progress: 0.4,
    total: "03:22",
    date: "2025年5月20日",
  },
];

// ─── Like Notification System ─────────────────────────────────────────────────
type LikeNotif = { id: string; label: string; date: string };
const _likeNotifs: LikeNotif[] = [
  { id: "ln_pre1", label: "聪明的一休 点赞了你的日记《秋收稻浪》", date: "02-28 09:15" },
  { id: "ln_pre2", label: "读论文的silan学长 点赞了你的声音明信片", date: "02-27 16:42" },
];
const _likeSubscribers = new Set<() => void>();
function pushLikeNotif(label: string) {
  const now = new Date();
  const date = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  _likeNotifs.unshift({ id: Date.now().toString() + Math.random().toString(36).slice(2, 6), label, date });
  _likeSubscribers.forEach((fn) => fn());
}

// ─── Small shared components ──────────────────────────────────────────────────

function PlayButton({ size = 36, color = Colors.light.primary, audioUrl }: { size?: number; color?: string; audioUrl?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  const toggle = async () => {
    haptic();
    if (!audioUrl) return;
    if (isPlaying) {
      try {
        await soundRef.current?.stopAsync();
        await soundRef.current?.unloadAsync();
        soundRef.current = null;
      } catch {}
      setIsPlaying(false);
      return;
    }
    await stopGlobalAudio();
    await ensureAudioMode();
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
      soundRef.current = sound;
      _gSound = sound;
      _gStop = () => setIsPlaying(false);
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          setIsPlaying(false);
          if (_gSound === sound) _gSound = null;
        }
      });
    } catch (e) { console.warn("PlayButton audio error:", e); }
  };

  return (
    <Pressable
      style={[styles.playBtn, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}
      onPress={toggle}
    >
      <Ionicons name={isPlaying ? "pause" : "play"} size={size * 0.45} color={color} />
    </Pressable>
  );
}

function ProgressBar({ progress: initProgress, total, color = Colors.light.primary, audioUrl }: { progress: number; total: string; color?: string; audioUrl?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [liveProgress, setLiveProgress] = useState(initProgress);
  const soundRef = useRef<Audio.Sound | null>(null);

  const totalSec = useMemo(() => {
    const parts = total.split(":").map(Number);
    return parts[0] * 60 + (parts[1] || 0);
  }, [total]);

  const elapsed = useMemo(() => {
    const sec = Math.floor(totalSec * liveProgress);
    return `${Math.floor(sec / 60).toString().padStart(2, "0")}:${(sec % 60).toString().padStart(2, "0")}`;
  }, [totalSec, liveProgress]);

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  const toggle = async () => {
    haptic();
    if (!audioUrl) return;
    if (isPlaying) {
      try {
        await soundRef.current?.stopAsync();
        await soundRef.current?.unloadAsync();
        soundRef.current = null;
      } catch {}
      setIsPlaying(false);
      setLiveProgress(0);
      return;
    }
    await stopGlobalAudio();
    await ensureAudioMode();
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
      soundRef.current = sound;
      _gSound = sound;
      _gStop = () => { setIsPlaying(false); setLiveProgress(0); };
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (!s.isLoaded) return;
        if (s.didJustFinish) {
          setIsPlaying(false);
          setLiveProgress(0);
          if (_gSound === sound) _gSound = null;
        } else if (s.durationMillis && s.durationMillis > 0) {
          setLiveProgress(s.positionMillis / s.durationMillis);
        }
      });
    } catch (e) { console.warn("ProgressBar audio error:", e); }
  };

  return (
    <View style={styles.progressRow}>
      <Pressable
        style={[styles.playBtn, { width: 28, height: 28, borderRadius: 14, borderColor: color }]}
        onPress={toggle}
      >
        <Ionicons name={isPlaying ? "pause" : "play"} size={13} color={color} />
      </Pressable>
      <View style={styles.progressTrackWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(liveProgress * 100)}%` as any, backgroundColor: color }]} />
        </View>
        <Text style={styles.progressTime}>{elapsed} / {total}</Text>
      </View>
    </View>
  );
}

// ─── My Diary Tab ─────────────────────────────────────────────────────────────

function DiaryReplyItem({
  item,
  subReplies,
  isReplying,
  replyText,
  onReplyTextChange,
  onToggleReply,
  onSubmitReply,
  replyMode,
  onReplyModeChange,
  isRecording,
  onRecordStart,
  onRecordEnd,
  mixedVoiceDur,
  onClearMixedVoice,
  audioUrl,
}: {
  item: typeof MY_DIARY_GROUPS[0]["replies"][0];
  subReplies: SubReply[];
  isReplying: boolean;
  replyText: string;
  onReplyTextChange: (t: string) => void;
  onToggleReply: () => void;
  onSubmitReply: () => void;
  replyMode: "text" | "mixed" | "voice";
  onReplyModeChange: (m: "text" | "mixed" | "voice") => void;
  isRecording: boolean;
  onRecordStart: () => void;
  onRecordEnd: () => void;
  mixedVoiceDur?: string | null;
  onClearMixedVoice?: () => void;
  audioUrl?: string;
}) {
  const [isLiked, setIsLiked] = useState(false);
  const handleLike = () => {
    setIsLiked((v) => !v);
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };
  return (
    <View>
      <View style={styles.replyItem}>
        <View style={styles.replyLeft}>
          <Text style={styles.replyTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.replyMeta}>
            <Ionicons name="time-outline" size={10} color={Colors.light.textSecondary} />
            <Text style={styles.replyMetaText}>{item.duration}</Text>
            <Ionicons name="calendar-outline" size={10} color={Colors.light.textSecondary} />
            <Text style={styles.replyMetaText}>{item.date}</Text>
          </View>
          <View style={styles.replyPhoneRow}>
            <Ionicons name="person-circle-outline" size={12} color="#6B9FFF" />
            <Text style={styles.replyPhoneText} numberOfLines={1}>{item.phone}</Text>
          </View>
        </View>
        <View style={styles.replyBtnRow}>
          <PlayButton size={28} audioUrl={audioUrl} />
          <Pressable
            onPress={() => { onToggleReply(); haptic(Haptics.ImpactFeedbackStyle.Medium); }}
            style={[styles.replyCommentBtn, isReplying && styles.replyCommentBtnActive]}
          >
            <Ionicons
              name={isReplying ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
              size={16}
              color={isReplying ? "#fff" : Colors.light.primary}
            />
          </Pressable>
          <Pressable onPress={handleLike} style={styles.replyLikeBtn}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={16} color={isLiked ? "#FF4D6A" : Colors.light.textSecondary} />
          </Pressable>
        </View>
      </View>

      {subReplies.length > 0 && (
        <View style={styles.diarySubReplies}>
          {subReplies.map((sr) => (
            <View key={sr.id} style={styles.diarySubReplyBubble}>
              <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
                <Text style={styles.diarySubReplyAt}>@{sr.replyTo}</Text>
                <SubReplyContent text={sr.text} style={styles.diarySubReplyText} uri={sr.uri} />
              </View>
              <Text style={styles.diarySubReplyTime}>{sr.time}</Text>
            </View>
          ))}
        </View>
      )}

      {isReplying && (
        <View style={[styles.commentReplyCard, { marginLeft: 14, marginRight: 14 }]}>
          <View style={styles.commentReplySegment}>
            <Pressable
              style={[styles.commentReplySegBtn, replyMode === "text" && styles.commentReplySegBtnActive]}
              onPress={() => { onReplyModeChange("text"); haptic(); }}
            >
              <Ionicons name="chatbubble-outline" size={16} color={replyMode === "text" ? Colors.light.primary : Colors.light.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.commentReplySegBtn, replyMode === "mixed" && styles.commentReplySegBtnActive]}
              onPress={() => { onReplyModeChange("mixed"); haptic(); }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                <Ionicons name="chatbubble-outline" size={12} color={replyMode === "mixed" ? Colors.light.primary : Colors.light.textSecondary} />
                <Text style={{ fontSize: 9, color: replyMode === "mixed" ? Colors.light.primary : Colors.light.textSecondary, fontWeight: "700" }}>+</Text>
                <Ionicons name="mic-outline" size={12} color={replyMode === "mixed" ? Colors.light.primary : Colors.light.textSecondary} />
              </View>
            </Pressable>
            <Pressable
              style={[styles.commentReplySegBtn, replyMode === "voice" && styles.commentReplySegBtnActive]}
              onPress={() => { onReplyModeChange("voice"); haptic(); }}
            >
              <Ionicons name="mic-outline" size={16} color={replyMode === "voice" ? Colors.light.primary : Colors.light.textSecondary} />
            </Pressable>
          </View>

          {replyMode === "voice" ? (
            <Pressable
              style={[styles.commentReplyMicArea, isRecording && styles.commentReplyMicAreaActive]}
              onPressIn={() => { onRecordStart(); haptic(Haptics.ImpactFeedbackStyle.Heavy); }}
              onPressOut={onRecordEnd}
            >
              <View style={[styles.commentReplyMicRing, isRecording && styles.commentReplyMicRingActive]}>
                <Ionicons name="mic" size={22} color={isRecording ? "#fff" : Colors.light.primary} />
              </View>
              <Text style={[styles.commentReplyMicLabel, isRecording && { color: "#fff" }]}>
                {isRecording ? "录音中 · 松开发送" : "按住开始录音"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.commentReplyInputArea}>
              <TextInput
                style={styles.commentReplyTextInput}
                placeholder={`回复 @${item.phone}...`}
                placeholderTextColor={Colors.light.textSecondary}
                value={replyText}
                onChangeText={onReplyTextChange}
                autoFocus={replyMode === "text"}
                multiline
              />
              <View style={styles.commentReplyActions}>
                {replyMode === "mixed" && (
                  mixedVoiceDur ? (
                    <View style={styles.mixedVoiceChip}>
                      <Ionicons name="mic" size={11} color="#fff" />
                      <Text style={styles.mixedVoiceChipText}>{mixedVoiceDur}</Text>
                      <Pressable onPress={onClearMixedVoice} hitSlop={6}>
                        <Ionicons name="close" size={11} color="#fff" />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.commentReplyMicSmall, isRecording && styles.commentReplyMicSmallActive]}
                      onPressIn={() => { onRecordStart(); haptic(Haptics.ImpactFeedbackStyle.Heavy); }}
                      onPressOut={onRecordEnd}
                    >
                      <Ionicons name="mic" size={14} color={isRecording ? "#fff" : Colors.light.primary} />
                    </Pressable>
                  )
                )}
                <Pressable
                  style={[styles.commentReplySendBtn, (!replyText.trim() && !mixedVoiceDur) && { opacity: 0.38 }]}
                  onPress={onSubmitReply}
                  disabled={!replyText.trim() && !mixedVoiceDur}
                >
                  <Ionicons name="arrow-up" size={15} color="#fff" />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function DiaryGroup({
  group,
  isExpanded,
  onToggleExpand,
}: {
  group: typeof MY_DIARY_GROUPS[0];
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyMode, setReplyMode] = useState<"text" | "mixed" | "voice">("text");
  const [isRecording, setIsRecording] = useState(false);
  const [mixedVoiceDur, setMixedVoiceDur] = useState<string | null>(null);
  const [mixedVoiceUri, setMixedVoiceUri] = useState<string | null>(null);
  const [subRepliesByItem, setSubRepliesByItem] = useState<Record<string, SubReply[]>>({});

  const nowStr = () => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const toggleReply = (itemId: string) => {
    if (replyingToId === itemId) {
      setReplyingToId(null);
      setReplyText("");
      setReplyMode("text");
      setIsRecording(false);
      setMixedVoiceDur(null);
      setMixedVoiceUri(null);
    } else {
      setReplyingToId(itemId);
      setReplyText("");
      setReplyMode("text");
      setIsRecording(false);
      setMixedVoiceDur(null);
      setMixedVoiceUri(null);
    }
  };

  const submitReply = (itemId: string, phone: string) => {
    const text = replyText.trim();
    if (!text && !mixedVoiceDur) return;
    const voicePart = mixedVoiceDur ? `🎤 语音 ${mixedVoiceDur}` : null;
    const combinedText = voicePart
      ? (text ? `${text}\n${voicePart}` : voicePart)
      : text;
    const newReply: SubReply = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      username: "我",
      time: nowStr(),
      text: combinedText,
      replyTo: phone,
      uri: mixedVoiceUri,
    };
    setSubRepliesByItem((prev) => ({ ...prev, [itemId]: [...(prev[itemId] ?? []), newReply] }));
    setReplyingToId(null);
    setReplyText("");
    setMixedVoiceDur(null);
    setMixedVoiceUri(null);
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleMixedRecordEnd = async () => {
    const { uri, duration, recorded } = await stopRecording();
    setIsRecording(false);
    if (recorded) {
      setMixedVoiceDur(duration);
      setMixedVoiceUri(uri);
    }
  };

  const submitVoiceReply = async (itemId: string, phone: string) => {
    const { uri, duration, recorded } = await stopRecording();
    setIsRecording(false);
    if (!recorded) return;
    const capturedNowStr = nowStr();
    const capturedUri = uri;
    Alert.alert("录制完成", `时长 ${duration}，是否上传？`, [
      { text: "取消", style: "cancel" },
      {
        text: "上传",
        onPress: () => {
          const newReply: SubReply = {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
            username: "我",
            time: capturedNowStr,
            text: `🎤 语音 ${duration}`,
            replyTo: phone,
            uri: capturedUri,
          };
          setSubRepliesByItem((prev) => ({ ...prev, [itemId]: [...(prev[itemId] ?? []), newReply] }));
          setReplyingToId(null);
          setReplyText("");
          haptic(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  return (
    <View style={styles.diaryGroup}>
      <View style={styles.diaryMainCard}>
        <Image source={group.thumb} style={styles.diaryMainThumb} resizeMode="cover" />
        <View style={styles.diaryMainInfo}>
          <Text style={styles.diaryMainTitle} numberOfLines={1}>{group.title}</Text>
          <View style={styles.diaryMainMeta}>
            <Ionicons name="calendar-outline" size={11} color={Colors.light.textSecondary} />
            <Text style={styles.diaryMainMetaText}>{group.date}</Text>
            <Ionicons name="time-outline" size={11} color={Colors.light.textSecondary} />
            <Text style={styles.diaryMainMetaText}>{group.duration}</Text>
          </View>
          {group.location && (
            <View style={styles.diaryMainMeta}>
              <Ionicons name="location-outline" size={11} color={Colors.light.textSecondary} />
              <Text style={styles.diaryMainMetaText} numberOfLines={1}>{group.location}</Text>
            </View>
          )}
        </View>
        <PlayButton size={32} audioUrl={getDemoAudio(group.id)} />
      </View>

      <View style={styles.diaryStatsRow}>
        <Pressable
          style={[styles.diaryStatItem, styles.diaryStatBtn, isExpanded && styles.diaryStatBtnActive]}
          onPress={() => { onToggleExpand(); haptic(); }}
        >
          <Image
            source={require("@/assets/images/audio-comment-icon.png")}
            style={{ width: 26, height: 26 }}
            tintColor={isExpanded ? Colors.light.primary : "#555"}
          />
          <Text style={[styles.diaryStatCount, { color: isExpanded ? Colors.light.primary : "#888" }]}>
            {group.listenCount}
          </Text>
        </Pressable>

        <View style={styles.diaryStatItem}>
          <Ionicons name="heart" size={16} color="#FF4D6A" />
          <Text style={[styles.diaryStatCount, { color: "#FF4D6A" }]}>{group.likeCount}</Text>
        </View>
      </View>

      {isExpanded && (
        <View style={styles.replyList}>
          {group.replies.map((r) => (
            <DiaryReplyItem
              key={r.id}
              item={r}
              subReplies={subRepliesByItem[r.id] ?? []}
              isReplying={replyingToId === r.id}
              replyText={replyingToId === r.id ? replyText : ""}
              onReplyTextChange={setReplyText}
              onToggleReply={() => toggleReply(r.id)}
              onSubmitReply={() => submitReply(r.id, r.phone)}
              replyMode={replyMode}
              onReplyModeChange={setReplyMode}
              isRecording={replyingToId === r.id && isRecording}
              onRecordStart={async () => {
                const ok = await startRecording();
                if (ok) setIsRecording(true);
              }}
              onRecordEnd={replyMode === "mixed"
                ? handleMixedRecordEnd
                : () => submitVoiceReply(r.id, r.phone)
              }
              mixedVoiceDur={replyingToId === r.id ? mixedVoiceDur : null}
              onClearMixedVoice={() => { setMixedVoiceDur(null); setMixedVoiceUri(null); }}
              audioUrl={getDemoAudio(r.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function MyPublishedCard({
  rec, onViewImage, isHighlighted, highlightHeart, highlightComment, likeCount, comments,
}: {
  rec: PublishedRecording;
  onViewImage: (uri: string) => void;
  isHighlighted?: boolean;
  highlightHeart?: boolean;
  highlightComment?: boolean;
  likeCount?: number;
  comments?: RecordingComment[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [likedCommentIds, setLikedCommentIds] = useState<string[]>([]);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyTextByComment, setReplyTextByComment] = useState<Record<string, string>>({});
  const [replyModeByComment, setReplyModeByComment] = useState<Record<string, "text" | "mixed" | "voice">>({});
  const [subRepliesByComment, setSubRepliesByComment] = useState<Record<string, SubReply[]>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [mixedVoiceDurByComment, setMixedVoiceDurByComment] = useState<Record<string, string | null>>({});
  const [mixedVoiceUriByComment, setMixedVoiceUriByComment] = useState<Record<string, string | null>>({});

  const nowStr = () => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const toggleCommentLike = (id: string) => {
    setLikedCommentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const toggleCommentReply = (commentId: string) => {
    if (replyingToCommentId === commentId) {
      setReplyingToCommentId(null);
      setReplyTextByComment((prev) => ({ ...prev, [commentId]: "" }));
      setReplyModeByComment((prev) => ({ ...prev, [commentId]: "text" }));
      setMixedVoiceDurByComment((prev) => ({ ...prev, [commentId]: null }));
      setMixedVoiceUriByComment((prev) => ({ ...prev, [commentId]: null }));
    } else {
      setReplyingToCommentId(commentId);
      setReplyTextByComment((prev) => ({ ...prev, [commentId]: "" }));
      setReplyModeByComment((prev) => ({ ...prev, [commentId]: "text" }));
      setMixedVoiceDurByComment((prev) => ({ ...prev, [commentId]: null }));
      setMixedVoiceUriByComment((prev) => ({ ...prev, [commentId]: null }));
    }
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleRecordStart = async (commentId: string) => {
    const ok = await startRecording();
    if (ok) setIsRecording(true);
  };

  const handleMixedRecordEnd = async (commentId: string) => {
    const { uri, duration, recorded } = await stopRecording();
    setIsRecording(false);
    if (recorded) {
      setMixedVoiceDurByComment((prev) => ({ ...prev, [commentId]: duration }));
      setMixedVoiceUriByComment((prev) => ({ ...prev, [commentId]: uri }));
    }
  };

  const handleVoiceRecordEnd = async (comment: RecordingComment) => {
    const { uri, duration, recorded } = await stopRecording();
    setIsRecording(false);
    if (!recorded) return;
    const capturedNow = nowStr();
    const capturedUri = uri;
    Alert.alert("录制完成", `时长 ${duration}，是否发送？`, [
      { text: "取消", style: "cancel" },
      {
        text: "发送",
        onPress: () => {
          const newReply: SubReply = {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
            username: "我",
            time: capturedNow,
            text: `🎤 语音 ${duration}`,
            replyTo: comment.username,
            uri: capturedUri,
          };
          setSubRepliesByComment((prev) => ({
            ...prev,
            [comment.id]: [...(prev[comment.id] ?? []), newReply],
          }));
          setReplyingToCommentId(null);
          haptic(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  const submitCommentReply = (comment: RecordingComment) => {
    const text = (replyTextByComment[comment.id] ?? "").trim();
    const mixedDur = mixedVoiceDurByComment[comment.id];
    const mixedUri = mixedVoiceUriByComment[comment.id];
    if (!text && !mixedDur) return;
    const voicePart = mixedDur ? `🎤 语音 ${mixedDur}` : null;
    const combinedText = voicePart
      ? (text ? `${text}\n${voicePart}` : voicePart)
      : text;
    const newReply: SubReply = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      username: "我",
      time: nowStr(),
      text: combinedText,
      replyTo: comment.username,
      uri: mixedUri,
    };
    setSubRepliesByComment((prev) => ({
      ...prev,
      [comment.id]: [...(prev[comment.id] ?? []), newReply],
    }));
    setReplyTextByComment((prev) => ({ ...prev, [comment.id]: "" }));
    setMixedVoiceDurByComment((prev) => ({ ...prev, [comment.id]: null }));
    setMixedVoiceUriByComment((prev) => ({ ...prev, [comment.id]: null }));
    setReplyingToCommentId(null);
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };
  const d = new Date(rec.publishedAt);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const mins = Math.floor(rec.durationSeconds / 60).toString().padStart(2, "0");
  const secs = (rec.durationSeconds % 60).toString().padStart(2, "0");
  const dur = `${mins}:${secs}`;
  return (
    <View style={isHighlighted ? styles.myPublishedCardHighlightWrapper : undefined}>
    <View style={[styles.diaryGroup, isHighlighted && { marginBottom: 0 }]}>
      {/* Header row — identical layout to DiaryGroup */}
      <View style={styles.diaryMainCard}>
        {rec.imageUri ? (
          <Pressable onPress={() => onViewImage(rec.imageUri!)} style={styles.myPubImgBtn}>
            <Image source={{ uri: rec.imageUri }} style={styles.diaryMainThumb} resizeMode="cover" />
          </Pressable>
        ) : (
          <View style={[styles.diaryMainThumb, { backgroundColor: "#EAF7F0", alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="mic" size={26} color={Colors.light.primary} />
          </View>
        )}
        <View style={styles.diaryMainInfo}>
          <Text style={styles.diaryMainTitle} numberOfLines={1}>{rec.title}</Text>
          <View style={styles.diaryMainMeta}>
            <Ionicons name="calendar-outline" size={11} color={Colors.light.textSecondary} />
            <Text style={styles.diaryMainMetaText}>{dateStr}</Text>
            <Ionicons name="time-outline" size={11} color={Colors.light.textSecondary} />
            <Text style={styles.diaryMainMetaText}>{dur}</Text>
          </View>
          <View style={styles.diaryMainMeta}>
            <Ionicons name="location-outline" size={11} color={Colors.light.textSecondary} />
            <Text style={styles.diaryMainMetaText} numberOfLines={1}>{rec.locationName}</Text>
          </View>
        </View>
        <PlayButton size={32} audioUrl={rec.audioUri} />
      </View>

      {/* Stats row — identical to DiaryGroup */}
      <View style={styles.diaryStatsRow}>
        <Pressable
          style={[
            styles.diaryStatItem, styles.diaryStatBtn,
            isExpanded && styles.diaryStatBtnActive,
            highlightComment && styles.statHighlightGreen,
          ]}
          onPress={() => { setIsExpanded((v) => !v); haptic(); }}
        >
          <Image
            source={require("@/assets/images/audio-comment-icon.png")}
            style={{ width: 26, height: 26 }}
            tintColor={isExpanded || highlightComment ? Colors.light.primary : "#555"}
          />
          <Text style={[styles.diaryStatCount, { color: isExpanded || highlightComment ? Colors.light.primary : "#888" }]}>
            {(comments ?? []).length}
          </Text>
        </Pressable>
        <View style={[styles.diaryStatItem, highlightHeart && styles.statHighlightHeart]}>
          <Ionicons name="heart" size={16} color="#FF4D6A" />
          <Text style={[styles.diaryStatCount, { color: "#FF4D6A" }]}>{likeCount ?? 0}</Text>
        </View>
      </View>

      {isExpanded && (
        <View style={styles.replyList}>
          {(comments ?? []).length === 0 ? (
            <Text style={{ color: Colors.light.textSecondary, fontSize: 13, textAlign: "center", paddingVertical: 8 }}>
              暂无留言
            </Text>
          ) : (
            (comments ?? []).map((c) => {
              const isReplying = replyingToCommentId === c.id;
              const isLiked = likedCommentIds.includes(c.id);
              const subs = subRepliesByComment[c.id] ?? [];
              const replyText = replyTextByComment[c.id] ?? "";
              const replyMode = replyModeByComment[c.id] ?? "text";
              return (
                <View key={c.id}>
                  <View style={styles.replyItem}>
                    <View style={styles.replyLeft}>
                      <Text style={styles.replyTitle} numberOfLines={1}>{c.text}</Text>
                      <View style={styles.replyMeta}>
                        <Ionicons name="calendar-outline" size={10} color={Colors.light.textSecondary} />
                        <Text style={styles.replyMetaText}>{c.time}</Text>
                      </View>
                      <View style={styles.replyPhoneRow}>
                        <Ionicons name="person-circle-outline" size={12} color="#6B9FFF" />
                        <Text style={styles.replyPhoneText} numberOfLines={1}>{c.username}</Text>
                      </View>
                    </View>
                    <View style={styles.replyBtnRow}>
                      <Pressable
                        style={[styles.replyCommentBtn, isReplying && styles.replyCommentBtnActive]}
                        onPress={() => toggleCommentReply(c.id)}
                      >
                        <Ionicons
                          name={isReplying ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
                          size={16}
                          color={isReplying ? "#fff" : Colors.light.primary}
                        />
                      </Pressable>
                      <Pressable
                        style={styles.replyLikeBtn}
                        onPress={() => toggleCommentLike(c.id)}
                      >
                        <Ionicons
                          name={isLiked ? "heart" : "heart-outline"}
                          size={16}
                          color={isLiked ? "#FF4D6A" : Colors.light.textSecondary}
                        />
                      </Pressable>
                    </View>
                  </View>

                  {subs.length > 0 && (
                    <View style={styles.diarySubReplies}>
                      {subs.map((sr) => (
                        <View key={sr.id} style={styles.diarySubReplyBubble}>
                          <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
                            <Text style={styles.diarySubReplyAt}>@{sr.replyTo}</Text>
                            <SubReplyContent text={sr.text} style={styles.diarySubReplyText} uri={sr.uri} />
                          </View>
                          <Text style={styles.diarySubReplyTime}>{sr.time}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {isReplying && (
                    <View style={[styles.commentReplyCard, { marginHorizontal: 14 }]}>
                      <View style={styles.commentReplySegment}>
                        <Pressable
                          style={[styles.commentReplySegBtn, replyMode === "text" && styles.commentReplySegBtnActive]}
                          onPress={() => { setReplyModeByComment((p) => ({ ...p, [c.id]: "text" })); haptic(); }}
                        >
                          <Ionicons name="chatbubble-outline" size={16} color={replyMode === "text" ? Colors.light.primary : Colors.light.textSecondary} />
                        </Pressable>
                        <Pressable
                          style={[styles.commentReplySegBtn, replyMode === "mixed" && styles.commentReplySegBtnActive]}
                          onPress={() => { setReplyModeByComment((p) => ({ ...p, [c.id]: "mixed" })); haptic(); }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                            <Ionicons name="chatbubble-outline" size={12} color={replyMode === "mixed" ? Colors.light.primary : Colors.light.textSecondary} />
                            <Text style={{ fontSize: 9, color: replyMode === "mixed" ? Colors.light.primary : Colors.light.textSecondary, fontWeight: "700" }}>+</Text>
                            <Ionicons name="mic-outline" size={12} color={replyMode === "mixed" ? Colors.light.primary : Colors.light.textSecondary} />
                          </View>
                        </Pressable>
                        <Pressable
                          style={[styles.commentReplySegBtn, replyMode === "voice" && styles.commentReplySegBtnActive]}
                          onPress={() => { setReplyModeByComment((p) => ({ ...p, [c.id]: "voice" })); haptic(); }}
                        >
                          <Ionicons name="mic-outline" size={16} color={replyMode === "voice" ? Colors.light.primary : Colors.light.textSecondary} />
                        </Pressable>
                      </View>

                      {replyMode === "voice" ? (
                        <Pressable
                          style={[styles.commentReplyMicArea, isRecording && styles.commentReplyMicAreaActive]}
                          onPressIn={() => handleRecordStart(c.id)}
                          onPressOut={() => handleVoiceRecordEnd(c)}
                        >
                          <View style={[styles.commentReplyMicRing, isRecording && styles.commentReplyMicRingActive]}>
                            <Ionicons name="mic" size={22} color={isRecording ? "#fff" : Colors.light.primary} />
                          </View>
                          <Text style={[styles.commentReplyMicLabel, isRecording && { color: "#fff" }]}>
                            {isRecording ? "录音中 · 松开发送" : "按住开始录音"}
                          </Text>
                        </Pressable>
                      ) : (
                        <View style={styles.commentReplyInputArea}>
                          <TextInput
                            style={styles.commentReplyTextInput}
                            placeholder={`回复 @${c.username}...`}
                            placeholderTextColor={Colors.light.textSecondary}
                            value={replyText}
                            onChangeText={(t) => setReplyTextByComment((prev) => ({ ...prev, [c.id]: t }))}
                            autoFocus={replyMode === "text"}
                            multiline
                          />
                          <View style={styles.commentReplyActions}>
                            {replyMode === "mixed" && (
                              mixedVoiceDurByComment[c.id] ? (
                                <View style={styles.mixedVoiceChip}>
                                  <Ionicons name="mic" size={11} color="#fff" />
                                  <Text style={styles.mixedVoiceChipText}>{mixedVoiceDurByComment[c.id]}</Text>
                                  <Pressable onPress={() => setMixedVoiceDurByComment((p) => ({ ...p, [c.id]: null }))} hitSlop={6}>
                                    <Ionicons name="close" size={11} color="#fff" />
                                  </Pressable>
                                </View>
                              ) : (
                                <Pressable
                                  style={[styles.commentReplyMicSmall, isRecording && styles.commentReplyMicSmallActive]}
                                  onPressIn={() => handleRecordStart(c.id)}
                                  onPressOut={() => handleMixedRecordEnd(c.id)}
                                >
                                  <Ionicons name="mic" size={14} color={isRecording ? "#fff" : Colors.light.primary} />
                                </Pressable>
                              )
                            )}
                            <Pressable
                              style={[styles.commentReplySendBtn, (!replyText.trim() && !mixedVoiceDurByComment[c.id]) && { opacity: 0.38 }]}
                              onPress={() => submitCommentReply(c)}
                              disabled={!replyText.trim() && !mixedVoiceDurByComment[c.id]}
                            >
                              <Ionicons name="arrow-up" size={15} color="#fff" />
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
    </View>
  );
}

type SortOrder = "time" | "comments" | "likes";

type DiaryListItem =
  | { kind: "recording"; rec: PublishedRecording }
  | { kind: "group"; group: typeof MY_DIARY_GROUPS[0] };

function SortPicker({ sortBy, onChange }: { sortBy: SortOrder | null; onChange: (v: SortOrder | null) => void }) {
  const options: { key: SortOrder; label: string }[] = [
    { key: "time", label: "时间" },
    { key: "comments", label: "评论数" },
    { key: "likes", label: "点赞数" },
  ];
  return (
    <View style={styles.sortPicker}>
      {options.map((opt) => (
        <Pressable
          key={opt.key}
          style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
          onPress={() => { onChange(opt.key); haptic(); }}
        >
          <Text style={[styles.sortChipText, sortBy === opt.key && styles.sortChipTextActive]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
      <Pressable
        style={[styles.sortChip, !sortBy && styles.sortChipActive]}
        onPress={() => { onChange(null); haptic(); }}
      >
        <Text style={[styles.sortChipText, !sortBy && styles.sortChipTextActive]}>重置</Text>
      </Pressable>
    </View>
  );
}

function MyDiaryTab() {
  "use no memo";
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [highlightedHearts, setHighlightedHearts] = useState<string[]>([]);
  const [highlightedComments, setHighlightedComments] = useState<string[]>([]);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sortBy, setSortBy] = useState<SortOrder | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const { myRecordings, newIds, acknowledgeNew, notifications, acknowledgeNotifications, likeCounts, commentsByRecording } = useRecordings();

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNewDotPress = () => {
    const total = newIds.length + notifications.length;
    if (total === 0) return;
    haptic(Haptics.ImpactFeedbackStyle.Light);
    setHighlightedIds([...newIds]);
    setHighlightedHearts(notifications.filter((n) => n.type === "like").map((n) => n.recordingId));
    setHighlightedComments(notifications.filter((n) => n.type === "comment").map((n) => n.recordingId));
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => {
      setHighlightedIds([]);
      setHighlightedHearts([]);
      setHighlightedComments([]);
      acknowledgeNew();
      acknowledgeNotifications();
      highlightTimer.current = null;
    }, 2000);
  };

  const totalCount = MY_DIARY_GROUPS.length + myRecordings.length;
  const pendingCount = newIds.length + notifications.length;
  const hasNew = pendingCount > 0;

  const allDiaryItems: DiaryListItem[] = [
    ...myRecordings.map((rec) => ({ kind: "recording" as const, rec })),
    ...MY_DIARY_GROUPS.map((group) => ({ kind: "group" as const, group })),
  ];

  const sortedItems: DiaryListItem[] = sortBy
    ? [...allDiaryItems].sort((a, b) => {
        if (sortBy === "time") {
          const aT = a.kind === "recording"
            ? new Date(a.rec.publishedAt).getTime()
            : new Date(a.group.date.replace(" ", "T")).getTime();
          const bT = b.kind === "recording"
            ? new Date(b.rec.publishedAt).getTime()
            : new Date(b.group.date.replace(" ", "T")).getTime();
          return bT - aT;
        }
        if (sortBy === "comments") {
          const aC = a.kind === "recording"
            ? (commentsByRecording[a.rec.id]?.length ?? 0)
            : a.group.replies.length;
          const bC = b.kind === "recording"
            ? (commentsByRecording[b.rec.id]?.length ?? 0)
            : b.group.replies.length;
          return bC - aC;
        }
        const aL = a.kind === "recording" ? (likeCounts[a.rec.id] ?? 0) : a.group.likeCount;
        const bL = b.kind === "recording" ? (likeCounts[b.rec.id] ?? 0) : b.group.likeCount;
        return bL - aL;
      })
    : allDiaryItems;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.tabContent}
      >
        <View style={styles.diaryHeader}>
          <Text style={styles.diaryHeaderText}>共 {totalCount} 份记忆</Text>
          <Pressable onPress={() => { setSortOpen((v) => !v); haptic(); }} style={[styles.filterBtn, sortOpen && styles.filterBtnActive]}>
            <Ionicons name="options-outline" size={20} color={sortOpen ? Colors.light.primary : Colors.light.text} />
          </Pressable>
        </View>
        {sortOpen && <SortPicker sortBy={sortBy} onChange={setSortBy} />}

        {hasNew && (
          <Pressable onPress={handleNewDotPress} style={styles.myPublishedNewCountDot} hitSlop={12}>
            <Text style={styles.myPublishedNewCountText}>{pendingCount}</Text>
          </Pressable>
        )}

        {sortedItems.map((item) => {
          if (item.kind === "recording") {
            const rec = item.rec;
            return (
              <MyPublishedCard
                key={rec.id}
                rec={rec}
                onViewImage={setViewerImage}
                isHighlighted={highlightedIds.includes(rec.id)}
                highlightHeart={highlightedHearts.includes(rec.id)}
                highlightComment={highlightedComments.includes(rec.id)}
                likeCount={likeCounts[rec.id] ?? 0}
                comments={commentsByRecording[rec.id] ?? []}
              />
            );
          }
          const g = item.group;
          return (
            <DiaryGroup
              key={g.id}
              group={g}
              isExpanded={!!expandedIds[g.id]}
              onToggleExpand={() => toggleExpand(g.id)}
            />
          );
        })}
      </ScrollView>

      {/* Full-screen image viewer — rendered at tab level so it always appears above everything */}
      <Modal
        visible={!!viewerImage}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setViewerImage(null)}
      >
        <Pressable style={styles.myPublishedViewer} onPress={() => setViewerImage(null)}>
          {viewerImage && (
            <Image source={{ uri: viewerImage }} style={styles.myPublishedViewerImg} resizeMode="contain" />
          )}
          <Pressable style={styles.myPublishedViewerClose} onPress={() => setViewerImage(null)}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Comment Types ────────────────────────────────────────────────────────────

type VoiceComment = { id: string; type: "voice"; title: string; duration: string; date: string; phone: string; uri?: string | null };
type TextComment  = { id: string; type: "text";  username: string; time: string; text: string; uri?: string | null };
type CommentItem  = VoiceComment | TextComment;
type SubReply       = { id: string; username: string; time: string; text: string; replyTo: string; uri?: string | null };

// ─── Sound Postcard Card ──────────────────────────────────────────────────────

function PostcardComment({
  item,
  subReplies,
  isReplying,
  replyText,
  onReplyTextChange,
  onPress,
  onSubmitReply,
  commentReplyMode,
  onCommentReplyModeChange,
  isCommentRecording,
  onCommentRecordStart,
  onCommentRecordEnd,
  onCommentMixedRecordEnd,
  commentMixedVoiceDur,
  onClearCommentMixedVoice,
}: {
  item: CommentItem;
  subReplies: SubReply[];
  isReplying: boolean;
  replyText: string;
  onReplyTextChange: (t: string) => void;
  onPress: () => void;
  onSubmitReply: () => void;
  commentReplyMode: "text" | "mixed" | "voice";
  onCommentReplyModeChange: (m: "text" | "mixed" | "voice") => void;
  isCommentRecording: boolean;
  onCommentRecordStart: () => void;
  onCommentRecordEnd: () => void;
  onCommentMixedRecordEnd?: () => void;
  commentMixedVoiceDur?: string | null;
  onClearCommentMixedVoice?: () => void;
}) {
  const isVoice = item.type === "voice";
  const name = isVoice ? item.phone : item.username;
  const time = isVoice ? item.date : item.time;
  const [isLiked, setIsLiked] = useState(false);
  const handleLike = () => {
    setIsLiked((v) => !v);
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <View style={[styles.uniComment, isReplying && styles.uniCommentActive]}>
      <Pressable
        style={styles.uniCommentPressable}
        onPress={() => { onPress(); haptic(); }}
      >
        <View style={[styles.uniCommentAvatar, isVoice && styles.uniCommentAvatarVoice]}>
          <Ionicons name={isVoice ? "mic" : "person"} size={12} color="#fff" />
        </View>
        <View style={styles.uniCommentBody}>
          <View style={styles.uniCommentHeader}>
            <Text style={styles.uniCommentName}>{name}</Text>
            <Text style={styles.uniCommentTime}>{time}</Text>
          </View>
          {isVoice ? (
            <View style={styles.uniCommentVoiceRow}>
              <Ionicons name="musical-note" size={11} color={Colors.light.primary} />
              <Text style={styles.uniCommentVoiceTitle} numberOfLines={1}>{item.title}</Text>
              <View style={styles.uniCommentVoiceDuration}>
                <Text style={styles.uniCommentVoiceDurationText}>{item.duration}</Text>
              </View>
              <Pressable onPress={() => haptic()} style={styles.uniCommentPlayBtn}>
                <Ionicons name="play" size={11} color={Colors.light.primary} />
              </Pressable>
            </View>
          ) : (
            <SubReplyContent text={item.text} style={styles.uniCommentText} uri={item.uri} />
          )}
        </View>
      </Pressable>

      <View style={styles.commentLikeRow}>
        <Pressable onPress={handleLike} style={styles.commentLikeBtn}>
          <Ionicons name={isLiked ? "heart" : "heart-outline"} size={13} color={isLiked ? "#FF4D6A" : Colors.light.textSecondary} />
        </Pressable>
      </View>

      {subReplies.length > 0 && (
        <View style={styles.subReplyList}>
          {subReplies.map((r) => (
            <View key={r.id} style={styles.subReplyItem}>
              <View style={styles.subReplyAvatar}>
                <Ionicons name="person" size={9} color="#fff" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.subReplyMeta}>{r.username} · {r.time}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 3 }}>
                  <Text style={styles.subReplyAt}>@{r.replyTo}</Text>
                  <SubReplyContent text={r.text} style={styles.subReplyText} uri={r.uri} />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {isReplying && (
        <View style={styles.commentReplyCard}>
          <View style={styles.commentReplySegment}>
            <Pressable
              style={[styles.commentReplySegBtn, commentReplyMode === "text" && styles.commentReplySegBtnActive]}
              onPress={() => { onCommentReplyModeChange("text"); haptic(); }}
            >
              <Ionicons name="chatbubble-outline" size={16} color={commentReplyMode === "text" ? Colors.light.primary : Colors.light.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.commentReplySegBtn, commentReplyMode === "mixed" && styles.commentReplySegBtnActive]}
              onPress={() => { onCommentReplyModeChange("mixed"); haptic(); }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                <Ionicons name="chatbubble-outline" size={12} color={commentReplyMode === "mixed" ? Colors.light.primary : Colors.light.textSecondary} />
                <Text style={{ fontSize: 9, color: commentReplyMode === "mixed" ? Colors.light.primary : Colors.light.textSecondary, fontWeight: "700" }}>+</Text>
                <Ionicons name="mic-outline" size={12} color={commentReplyMode === "mixed" ? Colors.light.primary : Colors.light.textSecondary} />
              </View>
            </Pressable>
            <Pressable
              style={[styles.commentReplySegBtn, commentReplyMode === "voice" && styles.commentReplySegBtnActive]}
              onPress={() => { onCommentReplyModeChange("voice"); haptic(); }}
            >
              <Ionicons name="mic-outline" size={16} color={commentReplyMode === "voice" ? Colors.light.primary : Colors.light.textSecondary} />
            </Pressable>
          </View>

          {commentReplyMode === "voice" ? (
            <Pressable
              style={[styles.commentReplyMicArea, isCommentRecording && styles.commentReplyMicAreaActive]}
              onPressIn={() => { onCommentRecordStart(); haptic(Haptics.ImpactFeedbackStyle.Heavy); }}
              onPressOut={onCommentRecordEnd}
            >
              <View style={[styles.commentReplyMicRing, isCommentRecording && styles.commentReplyMicRingActive]}>
                <Ionicons name="mic" size={22} color={isCommentRecording ? "#fff" : Colors.light.primary} />
              </View>
              <Text style={[styles.commentReplyMicLabel, isCommentRecording && { color: "#fff" }]}>
                {isCommentRecording ? "录音中 · 松开发送" : "按住开始录音"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.commentReplyInputArea}>
              <TextInput
                style={styles.commentReplyTextInput}
                placeholder={`回复 @${name}...`}
                placeholderTextColor={Colors.light.textSecondary}
                value={replyText}
                onChangeText={onReplyTextChange}
                autoFocus={commentReplyMode === "text"}
                multiline
              />
              <View style={styles.commentReplyActions}>
                {commentReplyMode === "mixed" && (
                  commentMixedVoiceDur ? (
                    <View style={styles.mixedVoiceChip}>
                      <Ionicons name="mic" size={11} color="#fff" />
                      <Text style={styles.mixedVoiceChipText}>{commentMixedVoiceDur}</Text>
                      <Pressable onPress={onClearCommentMixedVoice} hitSlop={6}>
                        <Ionicons name="close" size={11} color="#fff" />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.commentReplyMicSmall, isCommentRecording && styles.commentReplyMicSmallActive]}
                      onPressIn={() => { onCommentRecordStart(); haptic(Haptics.ImpactFeedbackStyle.Heavy); }}
                      onPressOut={onCommentMixedRecordEnd ?? onCommentRecordEnd}
                    >
                      <Ionicons name="mic" size={14} color={isCommentRecording ? "#fff" : Colors.light.primary} />
                    </Pressable>
                  )
                )}
                <Pressable
                  style={[styles.commentReplySendBtn, (!replyText.trim() && !commentMixedVoiceDur) && { opacity: 0.38 }]}
                  onPress={onSubmitReply}
                  disabled={!replyText.trim() && !commentMixedVoiceDur}
                >
                  <Ionicons name="arrow-up" size={15} color="#fff" />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function SoundPostcard({
  item,
  comments,
  isLiked,
  likeCount,
  onToggleLike,
  isExpanded,
  onToggleExpand,
  isReplying,
  onToggleReply,
  replyMode,
  onReplyModeChange,
  replyText,
  onReplyTextChange,
  onSubmitReply,
  isRecording,
  onRecordStart,
  onRecordEnd,
  onMixedRecordEnd,
  postcardMixedVoiceDur,
  onClearPostcardMixedVoice,
  subRepliesByComment,
  replyingToCommentId,
  onReplyToComment,
  commentReplyText,
  onCommentReplyTextChange,
  onSubmitCommentReply,
  commentReplyMode,
  onCommentReplyModeChange,
  isCommentRecording,
  onCommentRecordStart,
  onCommentRecordEnd,
  onCommentMixedRecordEnd,
  commentMixedVoiceDur,
  onClearCommentMixedVoice,
}: {
  item: typeof SOUND_POSTCARDS[0];
  comments: CommentItem[];
  isLiked: boolean;
  likeCount: number;
  onToggleLike: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isReplying: boolean;
  onToggleReply: () => void;
  replyMode: "text" | "mixed" | "voice";
  onReplyModeChange: (m: "text" | "mixed" | "voice") => void;
  replyText: string;
  onReplyTextChange: (t: string) => void;
  onSubmitReply: () => void;
  isRecording: boolean;
  onRecordStart: () => void;
  onRecordEnd: () => void;
  onMixedRecordEnd: () => void;
  postcardMixedVoiceDur: string | null;
  onClearPostcardMixedVoice: () => void;
  subRepliesByComment: Record<string, SubReply[]>;
  replyingToCommentId: string | null;
  onReplyToComment: (commentId: string) => void;
  commentReplyText: string;
  onCommentReplyTextChange: (t: string) => void;
  onSubmitCommentReply: (commentId: string) => void;
  commentReplyMode: "text" | "mixed" | "voice";
  onCommentReplyModeChange: (m: "text" | "mixed" | "voice") => void;
  isCommentRecording: boolean;
  onCommentRecordStart: () => void;
  onCommentRecordEnd: (commentId: string) => void;
  onCommentMixedRecordEnd: () => void;
  commentMixedVoiceDur: string | null;
  onClearCommentMixedVoice: () => void;
}) {
  return (
    <View style={styles.postcardCard}>
      <View style={styles.postcardTop}>
        <View style={[styles.postcardTypeIcon, { backgroundColor: item.typeBg }]}>
          <Ionicons
            name={item.type === "voice" ? "mic" : "location"}
            size={22}
            color={item.typeColor}
          />
        </View>
        <View style={styles.postcardTitleWrap}>
          <Text style={styles.postcardTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.postcardDatetime}>{item.datetime}</Text>
        </View>
        <View style={styles.postcardPlayWrap}>
          <Pressable
            style={[styles.postcardPlayBtn, { backgroundColor: Colors.light.primary }]}
            onPress={() => haptic(Haptics.ImpactFeedbackStyle.Medium)}
          >
            <Ionicons name="play" size={18} color="#fff" />
          </Pressable>
          <Text style={styles.postcardDuration}>{item.duration}</Text>
        </View>
      </View>

      <Text style={styles.postcardSender}>发送者：{item.sender}</Text>

      {item.quote ? (
        <View style={styles.postcardQuote}>
          <Text style={styles.postcardQuoteText}>{item.quote}</Text>
        </View>
      ) : (
        <View style={styles.postcardProgress}>
          <ProgressBar progress={item.progress} total={item.duration} audioUrl={getDemoAudio(item.id)} />
        </View>
      )}

      <View style={styles.postcardTagRow}>
        {item.tags.map((tag) => (
          <View key={tag} style={styles.postcardTagPill}>
            <Text style={styles.postcardTagText}>{tag}</Text>
          </View>
        ))}
        <View style={styles.postcardStats}>
          <Pressable
            style={styles.postcardExpandBtn}
            onPress={() => { onToggleExpand(); haptic(); }}
          >
            <Image
              source={require("@/assets/images/audio-comment-icon.png")}
              style={{ width: 22, height: 22 }}
              tintColor={isExpanded ? Colors.light.primary : "#666"}
            />
            <Text style={[styles.postcardStatNum, isExpanded && { color: Colors.light.primary }]}>
              {comments.length}
            </Text>
          </Pressable>
          <Pressable
            style={styles.postcardLikeBtn}
            onPress={() => { onToggleLike(); haptic(); }}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={17}
              color="#FF4D6A"
            />
            <Text style={[styles.postcardStatNum, { color: "#FF4D6A" }]}>{likeCount}</Text>
          </Pressable>
          <Pressable
            style={[styles.postcardReplyActionBtn, isReplying && styles.postcardReplyActionBtnActive]}
            onPress={() => { onToggleReply(); haptic(); }}
          >
            <Ionicons
              name="chatbubble-outline"
              size={16}
              color={isReplying ? Colors.light.primary : "#666"}
            />
          </Pressable>
        </View>
      </View>

      {isExpanded && comments.length > 0 && (
        <View style={styles.postcardCommentList}>
          <Text style={styles.postcardCommentTitle}>留言 · {comments.length} 条</Text>
          {comments.map((c) => (
            <PostcardComment
              key={c.id}
              item={c}
              subReplies={subRepliesByComment[c.id] ?? []}
              isReplying={replyingToCommentId === c.id}
              replyText={replyingToCommentId === c.id ? commentReplyText : ""}
              onReplyTextChange={onCommentReplyTextChange}
              onPress={() => onReplyToComment(c.id)}
              onSubmitReply={() => onSubmitCommentReply(c.id)}
              commentReplyMode={commentReplyMode}
              onCommentReplyModeChange={onCommentReplyModeChange}
              isCommentRecording={replyingToCommentId === c.id && isCommentRecording}
              onCommentRecordStart={onCommentRecordStart}
              onCommentRecordEnd={() => onCommentRecordEnd(c.id)}
              onCommentMixedRecordEnd={onCommentMixedRecordEnd}
              commentMixedVoiceDur={replyingToCommentId === c.id ? commentMixedVoiceDur : null}
              onClearCommentMixedVoice={onClearCommentMixedVoice}
            />
          ))}
        </View>
      )}

      {isReplying && (
        <View style={styles.postcardReplyBox}>
          <View style={styles.replyModeBar}>
            <Pressable
              style={[styles.replyModeBtn, replyMode === "text" && styles.replyModeBtnActive]}
              onPress={() => { onReplyModeChange("text"); haptic(); }}
            >
              <Ionicons name="chatbubble-outline" size={14} color={replyMode === "text" ? "#fff" : Colors.light.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.replyModeBtn, replyMode === "mixed" && styles.replyModeBtnActive]}
              onPress={() => { onReplyModeChange("mixed"); haptic(); }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                <Ionicons name="chatbubble-outline" size={11} color={replyMode === "mixed" ? "#fff" : Colors.light.textSecondary} />
                <Text style={{ fontSize: 9, color: replyMode === "mixed" ? "#fff" : Colors.light.textSecondary, fontWeight: "700" }}>+</Text>
                <Ionicons name="mic-outline" size={11} color={replyMode === "mixed" ? "#fff" : Colors.light.textSecondary} />
              </View>
            </Pressable>
            <Pressable
              style={[styles.replyModeBtn, replyMode === "voice" && styles.replyModeBtnActive]}
              onPress={() => { onReplyModeChange("voice"); haptic(); }}
            >
              <Ionicons name="mic-outline" size={14} color={replyMode === "voice" ? "#fff" : Colors.light.textSecondary} />
            </Pressable>
          </View>

          {replyMode === "voice" ? (
            <Pressable
              style={[styles.replyMicArea, isRecording && styles.replyMicAreaActive]}
              onPressIn={() => { onRecordStart(); haptic(Haptics.ImpactFeedbackStyle.Heavy); }}
              onPressOut={onRecordEnd}
            >
              <Ionicons name="mic" size={30} color={isRecording ? "#fff" : Colors.light.primary} />
              <Text style={[styles.replyMicAreaLabel, isRecording && { color: "#fff" }]}>
                {isRecording ? "录音中 · 松开发送" : "按住录音"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.replyInputRow}>
              <TextInput
                style={styles.postcardReplyInput}
                placeholder="写下你的文字留言..."
                placeholderTextColor={Colors.light.textSecondary}
                value={replyText}
                onChangeText={onReplyTextChange}
                multiline
                autoFocus={replyMode === "text"}
              />
              {replyMode === "mixed" && (
                postcardMixedVoiceDur ? (
                  <View style={styles.mixedVoiceChip}>
                    <Ionicons name="mic" size={11} color="#fff" />
                    <Text style={styles.mixedVoiceChipText}>{postcardMixedVoiceDur}</Text>
                    <Pressable onPress={onClearPostcardMixedVoice} hitSlop={6}>
                      <Ionicons name="close" size={11} color="#fff" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.replyMicBtn, isRecording && styles.replyMicBtnActive]}
                    onPressIn={() => { onRecordStart(); haptic(Haptics.ImpactFeedbackStyle.Heavy); }}
                    onPressOut={onMixedRecordEnd}
                  >
                    <Ionicons name="mic" size={16} color={isRecording ? "#fff" : Colors.light.primary} />
                  </Pressable>
                )
              )}
              <Pressable
                style={[styles.postcardReplySend, (!replyText.trim() && !postcardMixedVoiceDur) && { opacity: 0.4 }]}
                onPress={onSubmitReply}
                disabled={!replyText.trim() && !postcardMixedVoiceDur}
              >
                <Text style={styles.postcardReplySendText}>发送</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

interface NearbyRec {
  id: string;
  title: string;
  locationName: string;
  lat: number;
  lng: number;
  durationSeconds: number;
  publishedAt: string;
  author: string;
  quote: string | null;
  tags: string[];
  audioUri?: string;
  likeCount?: number;
  comments?: ServerComment[];
  isLiked?: boolean;
}

interface ServerComment {
  id: string;
  recordingId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}

interface NearbyComment {
  id: string;
  username: string;
  time: string;
  text: string;
}

function NearbyPostcard({ rec }: { rec: NearbyRec }) {
  const { user } = useAuth();
  const { refreshMyRecordings } = useRecordings();
  const mapComments = (cs: ServerComment[]): NearbyComment[] =>
    cs.map((c) => {
      const d = new Date(c.createdAt);
      return { id: c.id, username: c.username, time: `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, text: c.text };
    });
  const [isLiked, setIsLiked] = useState(rec.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(rec.likeCount ?? 0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [comments, setComments] = useState<NearbyComment[]>(mapComments(rec.comments ?? []));

  useEffect(() => {
    setIsLiked(rec.isLiked ?? false);
    setLikeCount(rec.likeCount ?? 0);
    setComments(mapComments(rec.comments ?? []));
  }, [rec.isLiked, rec.likeCount, rec.comments]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  const totalMs = audioDurationMs > 0 ? audioDurationMs : rec.durationSeconds * 1000;
  const totalSec = Math.ceil(totalMs / 1000);
  const mins = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const secs = (totalSec % 60).toString().padStart(2, "0");
  const duration = `${mins}:${secs}`;
  const elapsedSec = Math.floor(positionMs / 1000);
  const elapsed = `${Math.floor(elapsedSec / 60).toString().padStart(2, "0")}:${(elapsedSec % 60).toString().padStart(2, "0")}`;
  const playProgress = totalMs > 0 ? positionMs / totalMs : 0;
  const remainMs = Math.max(0, totalMs - positionMs);
  const remainSec = Math.ceil(remainMs / 1000);
  const countdown = `${Math.floor(remainSec / 60).toString().padStart(2, "0")}:${(remainSec % 60).toString().padStart(2, "0")}`;
  const dt = new Date(rec.publishedAt);
  const datetime = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;

  const toggleAudio = async () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    if (isPlaying) {
      try {
        await soundRef.current?.stopAsync();
        await soundRef.current?.unloadAsync();
        soundRef.current = null;
      } catch {}
      setIsPlaying(false);
      setPositionMs(0);
      return;
    }
    await stopGlobalAudio();
    await ensureAudioMode();
    let audioUrl: string;
    if (rec.audioUri) {
      const base = getApiUrl();
      audioUrl = rec.audioUri.startsWith("http") ? rec.audioUri : new URL(rec.audioUri, base).toString();
    } else {
      audioUrl = getDemoAudio(rec.id);
    }
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
      soundRef.current = sound;
      _gSound = sound;
      _gStop = () => { setIsPlaying(false); setPositionMs(0); };
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (!s.isLoaded) return;
        if (s.didJustFinish) {
          setIsPlaying(false);
          setPositionMs(0);
          if (_gSound === sound) _gSound = null;
        } else if (s.durationMillis && s.durationMillis > 0) {
          setAudioDurationMs(s.durationMillis);
          setPositionMs(s.positionMillis);
        }
      });
    } catch (e) { console.warn("NearbyPostcard audio error:", e); }
  };

  const toggleLike = async () => {
    if (!user || user.id === "guest") return;
    haptic();
    setIsLiked((v) => {
      setLikeCount((c) => c + (v ? -1 : 1));
      return !v;
    });
    try {
      const result = await apiRequest("POST", `/api/recordings/${rec.id}/like`, { userId: user.id }) as { liked: boolean; likeCount: number };
      setIsLiked(result.liked);
      setLikeCount(result.likeCount);
      refreshMyRecordings();
    } catch (e) {
      console.warn("Like failed:", e);
    }
  };

  const submitReply = async () => {
    if (!replyText.trim() || !user || user.id === "guest") return;
    const text = replyText.trim();
    setReplyText("");
    setIsReplying(false);
    haptic();
    const now = new Date();
    const time = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const tempId = Date.now().toString();
    setComments((prev) => [...prev, { id: tempId, username: user.username || "我", time, text }]);
    try {
      const comment = await apiRequest("POST", `/api/recordings/${rec.id}/comment`, { userId: user.id, username: user.username || "匿名", text }) as any;
      setComments((prev) => prev.map((c) => c.id === tempId ? { ...c, id: comment.id } : c));
      refreshMyRecordings();
    } catch (e) {
      console.warn("Comment failed:", e);
    }
  };

  return (
    <View style={styles.postcardCard}>
      <View style={styles.postcardTop}>
        <View style={[styles.postcardTypeIcon, { backgroundColor: "#FFF0E8" }]}>
          <Ionicons name="mic" size={22} color="#F5974E" />
        </View>
        <View style={styles.postcardTitleWrap}>
          <Text style={styles.postcardTitle} numberOfLines={1}>{rec.title}</Text>
          <Text style={styles.postcardDatetime}>{datetime}</Text>
        </View>
        <View style={styles.postcardPlayWrap}>
          <Pressable
            style={[styles.postcardPlayBtn, { backgroundColor: Colors.light.primary }]}
            onPress={toggleAudio}
          >
            <Ionicons name={isPlaying ? "pause" : "play"} size={18} color="#fff" />
          </Pressable>
          <Text style={styles.postcardDuration}>{countdown}</Text>
        </View>
      </View>

      <Text style={styles.postcardSender}>发送者：{rec.author}</Text>

      {rec.quote ? (
        <View style={styles.postcardQuote}>
          <Text style={styles.postcardQuoteText}>{rec.quote}</Text>
        </View>
      ) : (
        <View style={styles.postcardProgress}>
          <View style={styles.progressRow}>
            <Pressable
              style={[styles.playBtn, { width: 28, height: 28, borderRadius: 14, borderColor: Colors.light.primary }]}
              onPress={toggleAudio}
            >
              <Ionicons name={isPlaying ? "pause" : "play"} size={13} color={Colors.light.primary} />
            </Pressable>
            <View style={styles.progressTrackWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(playProgress * 100)}%` as any }]} />
              </View>
              <Text style={styles.progressTime}>{elapsed} / {duration}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.postcardTagRow}>
        {rec.tags.map((tag) => (
          <View key={tag} style={styles.postcardTagPill}>
            <Text style={styles.postcardTagText}>{tag}</Text>
          </View>
        ))}
        <View style={styles.postcardStats}>
          <Pressable
            style={styles.postcardExpandBtn}
            onPress={() => { setIsExpanded((v) => !v); haptic(); }}
          >
            <Image
              source={require("@/assets/images/audio-comment-icon.png")}
              style={{ width: 22, height: 22 }}
              tintColor={isExpanded ? Colors.light.primary : "#666"}
            />
            <Text style={[styles.postcardStatNum, isExpanded && { color: Colors.light.primary }]}>
              {comments.length}
            </Text>
          </Pressable>
          <Pressable style={styles.postcardLikeBtn} onPress={toggleLike}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={17} color="#FF4D6A" />
            <Text style={[styles.postcardStatNum, { color: "#FF4D6A" }]}>{likeCount}</Text>
          </Pressable>
          <Pressable
            style={[styles.postcardReplyActionBtn, isReplying && styles.postcardReplyActionBtnActive]}
            onPress={() => { setIsReplying((v) => !v); haptic(); }}
          >
            <Ionicons name="chatbubble-outline" size={16} color={isReplying ? Colors.light.primary : "#666"} />
          </Pressable>
        </View>
      </View>

      {isExpanded && comments.length > 0 && (
        <View style={styles.postcardCommentList}>
          <Text style={styles.postcardCommentTitle}>留言 · {comments.length} 条</Text>
          {comments.map((c) => (
            <View key={c.id} style={styles.uniComment}>
              <View style={styles.uniCommentPressable}>
                <View style={styles.uniCommentAvatar}>
                  <Ionicons name="person" size={12} color="#fff" />
                </View>
                <View style={styles.uniCommentBody}>
                  <View style={styles.uniCommentHeader}>
                    <Text style={styles.uniCommentName}>{c.username}</Text>
                    <Text style={styles.uniCommentTime}>{c.time}</Text>
                  </View>
                  <Text style={styles.uniCommentText}>{c.text}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {isReplying && (
        <View style={styles.postcardReplyBox}>
          <View style={styles.replyInputRow}>
            <TextInput
              style={styles.postcardReplyInput}
              placeholder="写下你的文字留言..."
              placeholderTextColor={Colors.light.textSecondary}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              autoFocus
            />
            <Pressable
              style={[styles.postcardReplySend, !replyText.trim() && { opacity: 0.4 }]}
              onPress={submitReply}
              disabled={!replyText.trim()}
            >
              <Text style={styles.postcardReplySendText}>发送</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const DISCOVER_FALLBACK_LAT = 43.8223;
const DISCOVER_FALLBACK_LNG = 87.5987;

function DiscoverOthersTab() {
  "use no memo";
  const { deviceLocation } = useRecordings();
  const { user } = useAuth();
  const [nearbyRecs, setNearbyRecs] = useState<NearbyRec[]>([]);
  const [nearbyError, setNearbyError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNearby = useCallback(async () => {
    const fallbackLat = deviceLocation?.lat ?? DISCOVER_FALLBACK_LAT;
    const fallbackLng = deviceLocation?.lng ?? DISCOVER_FALLBACK_LNG;

    const doFetch = async (lat: number, lng: number) => {
      try {
        const url = new URL("/api/recordings/nearby", getApiUrl());
        url.searchParams.set("lat", String(lat));
        url.searchParams.set("lng", String(lng));
        url.searchParams.set("radius", "100");
        if (user && user.id !== "guest") {
          url.searchParams.set("viewerUserId", user.id);
        }
        const res = await fetch(url.toString());
        if (res.ok) {
          const data: NearbyRec[] = await res.json();
          setNearbyRecs(data);
          setNearbyError(false);
        }
      } catch {
        setNearbyError(true);
      }
    };

    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => doFetch(pos.coords.latitude, pos.coords.longitude),
          () => doFetch(fallbackLat, fallbackLng)
        );
      } else {
        await doFetch(fallbackLat, fallbackLng);
      }
    } else {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        try {
          const last = await Location.getLastKnownPositionAsync({});
          if (last) {
            await doFetch(last.coords.latitude, last.coords.longitude);
            return;
          }
        } catch { /* fall through */ }
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000,
          } as Location.LocationOptions);
          await doFetch(pos.coords.latitude, pos.coords.longitude);
          return;
        } catch { /* fall through to shared fallback */ }
      }
      await doFetch(fallbackLat, fallbackLng);
    }
  }, [deviceLocation, user]);

  useEffect(() => { fetchNearby(); }, [fetchNearby]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNearby();
    setRefreshing(false);
  }, [fetchNearby]);

  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<SortOrder | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>(
    Object.fromEntries(SOUND_POSTCARDS.map((p) => [p.id, p.likeCount]))
  );
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [commentsByPostcard, setCommentsByPostcard] = useState<Record<string, CommentItem[]>>(
    Object.fromEntries(SOUND_POSTCARDS.map((p) => [p.id, p.comments as CommentItem[]]))
  );
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyMode, setReplyMode] = useState<"text" | "mixed" | "voice">("text");
  const [isRecording, setIsRecording] = useState(false);
  const [postcardMixedVoiceDur, setPostcardMixedVoiceDur] = useState<string | null>(null);
  const [postcardMixedVoiceUri, setPostcardMixedVoiceUri] = useState<string | null>(null);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [commentReplyText, setCommentReplyText] = useState("");
  const [commentReplyMode, setCommentReplyMode] = useState<"text" | "mixed" | "voice">("text");
  const [isCommentRecording, setIsCommentRecording] = useState(false);
  const [commentMixedVoiceDur, setCommentMixedVoiceDur] = useState<string | null>(null);
  const [commentMixedVoiceUri, setCommentMixedVoiceUri] = useState<string | null>(null);
  const [subRepliesByComment, setSubRepliesByComment] = useState<Record<string, SubReply[]>>({});

  const toggleLike = (id: string) => {
    setLikedIds((prev) => {
      const wasLiked = !!prev[id];
      setLikeCounts((counts) => ({
        ...counts,
        [id]: counts[id] + (wasLiked ? -1 : 1),
      }));
      return { ...prev, [id]: !wasLiked };
    });
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleReply = (id: string) => {
    if (replyingToId === id) {
      setReplyingToId(null);
      setReplyText("");
      setReplyMode("text");
      setIsRecording(false);
      setPostcardMixedVoiceDur(null);
      setPostcardMixedVoiceUri(null);
    } else {
      setReplyingToId(id);
      setReplyText("");
      setReplyMode("text");
      setIsRecording(false);
      setPostcardMixedVoiceDur(null);
      setPostcardMixedVoiceUri(null);
    }
  };

  const nowStr = () => {
    const n = new Date();
    return `${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")} ${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };

  const submitVoiceReply = async (postcardId: string) => {
    const { uri, duration, recorded } = await stopRecording();
    setIsRecording(false);
    if (!recorded) return;
    const capturedText = replyText;
    const capturedTime = nowStr();
    const capturedUri = uri;
    Alert.alert("录制完成", `时长 ${duration}，是否上传？`, [
      { text: "取消", style: "cancel" },
      {
        text: "上传",
        onPress: () => {
          let newComment: CommentItem;
          if (capturedText.trim()) {
            newComment = {
              id: Date.now().toString(),
              type: "text",
              username: "我",
              time: capturedTime,
              text: `${capturedText.trim()}\n🎤 语音 ${duration}`,
              uri: capturedUri,
            } as TextComment;
            setReplyText("");
          } else {
            newComment = {
              id: Date.now().toString(),
              type: "voice",
              title: "我的语音留言",
              duration,
              date: capturedTime,
              phone: "我",
              uri: capturedUri,
            } as VoiceComment;
          }
          setCommentsByPostcard((prev) => ({
            ...prev,
            [postcardId]: [...(prev[postcardId] ?? []), newComment],
          }));
          setExpandedIds((prev) => ({ ...prev, [postcardId]: true }));
          setReplyingToId(null);
          haptic(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  const handlePostcardMixedRecordEnd = async () => {
    const { uri, duration, recorded } = await stopRecording();
    setIsRecording(false);
    if (recorded) {
      setPostcardMixedVoiceDur(duration);
      setPostcardMixedVoiceUri(uri);
    }
  };

  const submitReply = (postcardId: string) => {
    const text = replyText.trim();
    if (!text && !postcardMixedVoiceDur) return;
    const voicePart = postcardMixedVoiceDur ? `🎤 语音 ${postcardMixedVoiceDur}` : null;
    const combinedText = voicePart ? (text ? `${text}\n${voicePart}` : voicePart) : text;
    const time = nowStr();
    const newComment: TextComment = {
      id: Date.now().toString(),
      type: "text",
      username: "我",
      time,
      text: combinedText,
      uri: postcardMixedVoiceUri,
    };
    setCommentsByPostcard((prev) => ({
      ...prev,
      [postcardId]: [...(prev[postcardId] ?? []), newComment],
    }));
    setExpandedIds((prev) => ({ ...prev, [postcardId]: true }));
    setReplyingToId(null);
    setReplyText("");
    setPostcardMixedVoiceDur(null);
    setPostcardMixedVoiceUri(null);
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const replyToComment = (commentId: string) => {
    if (replyingToCommentId === commentId) {
      setReplyingToCommentId(null);
      setCommentReplyText("");
      setCommentReplyMode("text");
      setIsCommentRecording(false);
      setCommentMixedVoiceDur(null);
      setCommentMixedVoiceUri(null);
    } else {
      setReplyingToCommentId(commentId);
      setCommentReplyText("");
      setCommentReplyMode("text");
      setIsCommentRecording(false);
      setCommentMixedVoiceDur(null);
      setCommentMixedVoiceUri(null);
    }
  };

  const handleCommentMixedRecordEnd = async () => {
    const { uri, duration, recorded } = await stopRecording();
    setIsCommentRecording(false);
    if (recorded) {
      setCommentMixedVoiceDur(duration);
      setCommentMixedVoiceUri(uri);
    }
  };

  const submitCommentVoiceReply = async (commentId: string) => {
    const { uri, duration, recorded } = await stopRecording();
    setIsCommentRecording(false);
    if (!recorded) return;
    const allComments = Object.values(commentsByPostcard).flat();
    const target = allComments.find((c) => c.id === commentId);
    const replyTo = target
      ? target.type === "voice" ? target.phone : target.username
      : "对方";
    const capturedCommentText = commentReplyText;
    const capturedTime = nowStr();
    const capturedUri = uri;
    Alert.alert("录制完成", `时长 ${duration}，是否上传？`, [
      { text: "取消", style: "cancel" },
      {
        text: "上传",
        onPress: () => {
          const voicePart = `🎤 语音 ${duration}`;
          const combinedText = capturedCommentText.trim()
            ? `${capturedCommentText.trim()}\n${voicePart}`
            : voicePart;
          const newReply: SubReply = {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
            username: "我",
            time: capturedTime,
            text: combinedText,
            replyTo,
            uri: capturedUri,
          };
          setSubRepliesByComment((prev) => ({
            ...prev,
            [commentId]: [...(prev[commentId] ?? []), newReply],
          }));
          setCommentReplyText("");
          setReplyingToCommentId(null);
          haptic(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  const submitCommentReply = (commentId: string) => {
    const text = commentReplyText.trim();
    if (!text && !commentMixedVoiceDur) return;
    const now = new Date();
    const time = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const allComments = Object.values(commentsByPostcard).flat();
    const target = allComments.find((c) => c.id === commentId);
    const replyTo = target
      ? target.type === "voice" ? target.phone : target.username
      : "对方";
    const voicePart = commentMixedVoiceDur ? `🎤 语音 ${commentMixedVoiceDur}` : null;
    const combinedText = voicePart
      ? (text ? `${text}\n${voicePart}` : voicePart)
      : text;
    const newReply: SubReply = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      username: "我",
      time,
      text: combinedText,
      replyTo,
      uri: commentMixedVoiceUri,
    };
    setSubRepliesByComment((prev) => ({
      ...prev,
      [commentId]: [...(prev[commentId] ?? []), newReply],
    }));
    setReplyingToCommentId(null);
    setCommentReplyText("");
    setCommentMixedVoiceDur(null);
    setCommentMixedVoiceUri(null);
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const totalFound = SOUND_POSTCARDS.length + nearbyRecs.length;

  const sortedNearby = sortBy
    ? [...nearbyRecs].sort((a, b) => {
        if (sortBy === "time") return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        return 0;
      })
    : nearbyRecs;

  const sortedPostcards = sortBy
    ? [...SOUND_POSTCARDS].sort((a, b) => {
        if (sortBy === "time") return new Date(b.datetime.replace(" ", "T")).getTime() - new Date(a.datetime.replace(" ", "T")).getTime();
        if (sortBy === "comments") return (commentsByPostcard[b.id]?.length ?? 0) - (commentsByPostcard[a.id]?.length ?? 0);
        return (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0);
      })
    : SOUND_POSTCARDS;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.tabContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.light.primary}
          colors={[Colors.light.primary]}
        />
      }
    >
      <View style={styles.discoverHeader}>
        <Text style={styles.discoverHeaderText}>共搜到 {totalFound} 封声音明信片</Text>
        <Pressable style={[styles.filterBtn, sortOpen && styles.filterBtnActive]} onPress={() => { setSortOpen((v) => !v); haptic(); }}>
          <Ionicons name="options-outline" size={20} color={sortOpen ? Colors.light.primary : Colors.light.text} />
        </Pressable>
      </View>
      {sortOpen && <SortPicker sortBy={sortBy} onChange={setSortBy} />}

      {/* ── 附近用户发布的声音随记（全卡片样式） ─────────── */}
      {sortedNearby.map((rec) => (
        <NearbyPostcard key={rec.id} rec={rec} />
      ))}

      {sortedPostcards.map((p) => (
        <SoundPostcard
          key={p.id}
          item={p}
          comments={commentsByPostcard[p.id] ?? []}
          isLiked={!!likedIds[p.id]}
          likeCount={likeCounts[p.id] ?? p.likeCount}
          onToggleLike={() => toggleLike(p.id)}
          isExpanded={!!expandedIds[p.id]}
          onToggleExpand={() => toggleExpand(p.id)}
          isReplying={replyingToId === p.id}
          onToggleReply={() => toggleReply(p.id)}
          replyMode={replyMode}
          onReplyModeChange={setReplyMode}
          replyText={replyingToId === p.id ? replyText : ""}
          onReplyTextChange={setReplyText}
          onSubmitReply={() => submitReply(p.id)}
          isRecording={isRecording}
          onRecordStart={async () => {
            const ok = await startRecording();
            if (ok) setIsRecording(true);
          }}
          onRecordEnd={() => submitVoiceReply(p.id)}
          onMixedRecordEnd={handlePostcardMixedRecordEnd}
          postcardMixedVoiceDur={replyingToId === p.id ? postcardMixedVoiceDur : null}
          onClearPostcardMixedVoice={() => { setPostcardMixedVoiceDur(null); setPostcardMixedVoiceUri(null); }}
          subRepliesByComment={subRepliesByComment}
          replyingToCommentId={replyingToCommentId}
          onReplyToComment={replyToComment}
          commentReplyText={commentReplyText}
          onCommentReplyTextChange={setCommentReplyText}
          onSubmitCommentReply={submitCommentReply}
          commentReplyMode={commentReplyMode}
          onCommentReplyModeChange={setCommentReplyMode}
          isCommentRecording={isCommentRecording}
          onCommentRecordStart={async () => {
            const ok = await startRecording();
            if (ok) setIsCommentRecording(true);
          }}
          onCommentRecordEnd={(commentId) => submitCommentVoiceReply(commentId)}
          onCommentMixedRecordEnd={handleCommentMixedRecordEnd}
          commentMixedVoiceDur={commentMixedVoiceDur}
          onClearCommentMixedVoice={() => { setCommentMixedVoiceDur(null); setCommentMixedVoiceUri(null); }}
        />
      ))}

      <View style={styles.deliveryNote}>
        <Text style={styles.deliveryNoteText}>· · · 时光邮局正在派送更多声音...</Text>
      </View>
    </ScrollView>
  );
}

// ─── Conversation Chain Tab ───────────────────────────────────────────────────

function ConversationItem({ item, isLast }: { item: typeof CONVERSATION_CHAIN[0]; isLast?: boolean }) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyMode, setReplyMode] = useState<"text" | "mixed" | "voice">("text");
  const [replyText, setReplyText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedDuration, setRecordedDuration] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);

  const toggleReply = () => {
    setIsReplying((v) => {
      if (v) { setReplyText(""); setReplyMode("text"); setIsRecording(false); setRecordedDuration(null); }
      return !v;
    });
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };
  const submitReply = () => {
    const hasText = replyText.trim().length > 0;
    const hasVoice = !!recordedDuration;
    if (!hasText && !hasVoice) return;
    setIsReplying(false); setReplyText(""); setRecordedDuration(null);
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };
  const handleRecordStart = async () => {
    const ok = await startRecording();
    if (ok) { setIsRecording(true); haptic(Haptics.ImpactFeedbackStyle.Heavy); }
  };
  const submitVoiceReply = async () => {
    const { duration, recorded } = await stopRecording();
    setIsRecording(false);
    if (!recorded) return;
    Alert.alert("录制完成", `时长 ${duration}，是否上传？`, [
      { text: "取消", style: "cancel" },
      {
        text: "上传",
        onPress: () => {
          setIsReplying(false);
          haptic(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };
  const handleLike = () => {
    setIsLiked((v) => !v);
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <View>
      <View style={styles.convCard}>
        <Image source={item.avatar} style={styles.convAvatar} resizeMode="cover" />
        <View style={styles.convBody}>
          <View style={styles.convNameRow}>
            <Text style={styles.convUsername} numberOfLines={1}>{item.username}</Text>
            {item.isHost && (
              <View style={styles.hostBadge}>
                <Text style={styles.hostBadgeText}>主</Text>
              </View>
            )}
          </View>
          <Text style={styles.convAction} numberOfLines={1}>{item.action}</Text>
          <Text style={styles.convText} numberOfLines={2}>{item.text}</Text>
          <ProgressBar progress={item.progress} total={item.total} audioUrl={getDemoAudio(item.id)} />
          <View style={styles.convFooter}>
            <Text style={styles.convDate}>{item.date}</Text>
            <View style={styles.convActions}>
              <Pressable style={[styles.convActionBtn, isReplying && styles.convActionBtnActive]} onPress={toggleReply}>
                <MaterialCommunityIcons name="chat-outline" size={14} color={isReplying ? Colors.light.primary : Colors.light.textSecondary} />
                <Text style={[styles.convActionText, isReplying && { color: Colors.light.primary }]}>回复</Text>
              </Pressable>
              <Pressable style={styles.convActionBtn} onPress={handleLike}>
                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={14} color={isLiked ? "#FF4D6A" : Colors.light.textSecondary} />
                <Text style={[styles.convActionText, isLiked && { color: "#FF4D6A" }]}>点赞</Text>
              </Pressable>
            </View>
          </View>

          {isReplying && (
            <View style={styles.convReplyArea}>
              <View style={styles.convReplyModePills}>
                <Pressable style={[styles.convReplyModePill, replyMode === "text" && styles.convReplyModePillActive]} onPress={() => { setReplyMode("text"); haptic(); }}>
                  <Ionicons name="chatbubble-outline" size={13} color={replyMode === "text" ? "#fff" : Colors.light.textSecondary} />
                </Pressable>
                <Pressable style={[styles.convReplyModePill, replyMode === "mixed" && styles.convReplyModePillActive]} onPress={() => { setReplyMode("mixed"); haptic(); }}>
                  <Ionicons name="chatbubble-outline" size={10} color={replyMode === "mixed" ? "#fff" : Colors.light.textSecondary} />
                  <Text style={{ fontSize: 8, color: replyMode === "mixed" ? "#fff" : Colors.light.textSecondary, fontWeight: "700" }}>+</Text>
                  <Ionicons name="mic-outline" size={10} color={replyMode === "mixed" ? "#fff" : Colors.light.textSecondary} />
                </Pressable>
                <Pressable style={[styles.convReplyModePill, replyMode === "voice" && styles.convReplyModePillActive]} onPress={() => { setReplyMode("voice"); haptic(); }}>
                  <Ionicons name="mic-outline" size={13} color={replyMode === "voice" ? "#fff" : Colors.light.textSecondary} />
                </Pressable>
              </View>

              {replyMode === "voice" ? (
                <Pressable
                  style={[styles.convReplyMicArea, isRecording && styles.convReplyMicAreaActive]}
                  onPressIn={handleRecordStart}
                  onPressOut={submitVoiceReply}
                >
                  <View style={[styles.convReplyMicRing, isRecording && styles.convReplyMicRingActive]}>
                    <Ionicons name="mic" size={20} color={isRecording ? "#fff" : Colors.light.primary} />
                  </View>
                  <Text style={[styles.convReplyMicLabel, isRecording && { color: "#fff" }]}>
                    {isRecording ? "录音中 · 松开发送" : "按住开始录音"}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.convReplyInputRow}>
                  <TextInput
                    style={styles.convReplyInput}
                    placeholder={`回复 @${item.username}...`}
                    placeholderTextColor={Colors.light.textSecondary}
                    value={replyText}
                    onChangeText={setReplyText}
                    autoFocus={replyMode === "text"}
                    multiline
                  />
                  <View style={styles.commentReplyActions}>
                    {replyMode === "mixed" && (
                      recordedDuration ? (
                        <View style={styles.convRecordedChip}>
                          <Ionicons name="mic" size={11} color={Colors.light.primary} />
                          <Text style={styles.convRecordedChipText}>{recordedDuration}</Text>
                          <Pressable onPress={() => setRecordedDuration(null)}>
                            <Ionicons name="close-circle" size={13} color={Colors.light.textSecondary} />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          style={[styles.convReplyMicSmall, isRecording && styles.convReplyMicSmallActive]}
                          onPressIn={handleRecordStart}
                          onPressOut={async () => {
                            const { duration, recorded } = await stopRecording();
                            setIsRecording(false);
                            if (recorded) setRecordedDuration(duration);
                          }}
                        >
                          <Ionicons name="mic" size={12} color={isRecording ? "#fff" : Colors.light.primary} />
                        </Pressable>
                      )
                    )}
                    <Pressable
                      style={[styles.convReplySendBtn, (!replyText.trim() && !recordedDuration) && { opacity: 0.38 }]}
                      onPress={submitReply}
                      disabled={!replyText.trim() && !recordedDuration}
                    >
                      <Ionicons name="arrow-up" size={14} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
      {!isLast && <View style={styles.convDivider} />}
    </View>
  );
}

function MyConversationChainTab() {
  const [likeNotifs, setLikeNotifs] = useState<LikeNotif[]>([..._likeNotifs]);
  useEffect(() => {
    const update = () => setLikeNotifs([..._likeNotifs]);
    _likeSubscribers.add(update);
    return () => { _likeSubscribers.delete(update); };
  }, []);

  const dismissNotif = (id: string) => {
    const idx = _likeNotifs.findIndex((n) => n.id === id);
    if (idx !== -1) _likeNotifs.splice(idx, 1);
    setLikeNotifs([..._likeNotifs]);
    haptic();
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {likeNotifs.length > 0 && (
        <View style={styles.likeNotifList}>
          {likeNotifs.map((n) => (
            <View key={n.id} style={styles.likeNotifCard}>
              <View style={styles.likeNotifIcon}>
                <Ionicons name="heart" size={16} color="#FF4D6A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.likeNotifLabel}>{n.label}</Text>
                <Text style={styles.likeNotifDate}>{n.date}</Text>
              </View>
              <Pressable onPress={() => dismissNotif(n.id)} style={styles.likeNotifClose}>
                <Ionicons name="close" size={14} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={styles.convList}>
        {CONVERSATION_CHAIN.map((c, idx) => (
          <ConversationItem key={c.id} item={c} isLast={idx === CONVERSATION_CHAIN.length - 1} />
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Sound Post Office Tab ────────────────────────────────────────────────────

function SoundPostOfficeTab() {
  const [subTab, setSubTab] = useState<"discover" | "chain">("discover");

  return (
    <View style={styles.postOfficeContainer}>
      <View style={styles.segmentedControl}>
        <Pressable
          style={[styles.segmentBtn, subTab === "discover" && styles.segmentBtnActive]}
          onPress={() => { setSubTab("discover"); haptic(); }}
        >
          <Text style={[styles.segmentBtnText, subTab === "discover" && styles.segmentBtnTextActive]}>
            发现他人声音
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, subTab === "chain" && styles.segmentBtnActive]}
          onPress={() => { setSubTab("chain"); haptic(); }}
        >
          <Text style={[styles.segmentBtnText, subTab === "chain" && styles.segmentBtnTextActive]}>
            我的对话链
          </Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {subTab === "discover"
          ? <DiscoverOthersTab />
          : <MyConversationChainTab />
        }
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [mainTab, setMainTab] = useState<"diary" | "postoffice">("diary");

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.topTabBar}>
        <Pressable
          style={styles.topTabItem}
          onPress={() => { setMainTab("diary"); haptic(); }}
        >
          <Text style={[styles.topTabText, mainTab === "diary" && styles.topTabTextActive]}>
            我的日记
          </Text>
          {mainTab === "diary" && <View style={styles.topTabUnderline} />}
        </Pressable>
        <Pressable
          style={styles.topTabItem}
          onPress={() => { setMainTab("postoffice"); haptic(); }}
        >
          <Text style={[styles.topTabText, mainTab === "postoffice" && styles.topTabTextActive]}>
            声音邮局
          </Text>
          {mainTab === "postoffice" && <View style={styles.topTabUnderline} />}
        </Pressable>
      </View>

      <View style={[styles.body, { paddingBottom: TAB_BAR_HEIGHT + bottomPad }]}>
        {mainTab === "diary" ? <MyDiaryTab /> : <SoundPostOfficeTab />}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F6FA",
  },

  // Top tab bar
  topTabBar: {
    flexDirection: "row",
    backgroundColor: "#F5F6FA",
    paddingHorizontal: 40,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  topTabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  topTabText: {
    fontSize: 15,
    fontWeight: "500",
    color: Colors.light.textSecondary,
  },
  topTabTextActive: {
    color: Colors.light.primary,
    fontWeight: "700",
  },
  topTabUnderline: {
    position: "absolute",
    bottom: 0,
    width: 32,
    height: 2.5,
    backgroundColor: Colors.light.primary,
    borderRadius: 2,
  },

  body: {
    flex: 1,
  },

  tabContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },

  // My Diary header
  diaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  diaryHeaderText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  filterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F0F5",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: {
    backgroundColor: "#EAF7F0",
  },
  sortPicker: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F0F0F5",
    borderWidth: 1,
    borderColor: "transparent",
  },
  sortChipActive: {
    backgroundColor: "#EAF7F0",
    borderColor: Colors.light.primary,
  },
  sortChipText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: "500" as const,
  },
  sortChipTextActive: {
    color: Colors.light.primary,
    fontWeight: "600" as const,
  },
  viewToggle: {
    flexDirection: "row",
    gap: 12,
  },

  // My published recordings section
  myPublishedSection: { marginBottom: 6 },
  myPublishedSectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
  },
  myPublishedDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.light.primary,
  },
  myPublishedNewCountDot: {
    backgroundColor: Colors.light.primary,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: Colors.light.primary + "55",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  myPublishedNewCountText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  myPublishedCardHighlightWrapper: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    marginBottom: 14,
  },
  statHighlightGreen: {
    borderColor: Colors.light.primary,
    borderWidth: 1.5,
    borderRadius: 16,
    backgroundColor: Colors.light.greenLight,
  },
  statHighlightHeart: {
    borderColor: "#FF4D6A",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: "#FFF0F3",
  },
  myPublishedSectionTitle: {
    fontSize: 13, fontWeight: "700", color: Colors.light.text,
  },
  myPublishedCountBadge: {
    backgroundColor: Colors.light.primary, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 1,
  },
  myPublishedCountText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  myPublishedCard: {
    backgroundColor: "#fff", borderRadius: 14, marginBottom: 10,
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderLeftWidth: 3, borderLeftColor: Colors.light.primary,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  myPublishedIcon: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: "#EAF7F0", alignItems: "center", justifyContent: "center",
  },
  myPublishedImgWrap: {
    width: 46, height: 46, borderRadius: 12, overflow: "hidden",
    position: "relative",
  },
  myPublishedImg: { width: 46, height: 46 },
  myPublishedImgOverlay: {
    position: "absolute", bottom: 2, right: 2,
    backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 5,
    width: 16, height: 16, alignItems: "center", justifyContent: "center",
  },
  myPubImgBtn: {
    width: 72, height: 56, borderRadius: 10, overflow: "hidden",
  },
  myPubImg: { width: 72, height: 56 },
  myPublishedViewer: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center", justifyContent: "center",
  },
  myPublishedViewerImg: { width: "100%", height: "100%" },
  myPublishedViewerClose: {
    position: "absolute", top: 54, right: 20,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20,
    width: 40, height: 40, alignItems: "center", justifyContent: "center",
  },
  myPublishedInfo: { flex: 1, gap: 3 },
  myPublishedTitle: { fontSize: 14, fontWeight: "600", color: Colors.light.text },
  myPublishedMeta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  myPublishedMetaText: { fontSize: 11, color: Colors.light.textSecondary },
  myPublishedDate: { fontSize: 11, color: Colors.light.textSecondary },
  myPublishedBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#EAF7F0", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  myPublishedBadgeText: { fontSize: 10, color: Colors.light.primary, fontWeight: "700" },

  // Diary group
  diaryGroup: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 14,
    overflow: "hidden",
  },
  diaryMainCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 0,
  },
  diaryMainThumb: {
    width: 72,
    height: 56,
    borderRadius: 10,
  },
  diaryMainInfo: {
    flex: 1,
    gap: 4,
  },
  diaryMainTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.text,
  },
  diaryMainMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  diaryMainMetaText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginRight: 4,
  },
  diaryStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  diaryStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  diaryStatBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  diaryStatBtnActive: {
    backgroundColor: Colors.light.greenLight,
    borderColor: Colors.light.primary + "40",
  },
  diaryStatCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FF4D6A",
  },

  // Reply items
  replyList: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  replyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 8,
  },
  replyLeft: {
    flex: 1,
    gap: 3,
  },
  replyTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.text,
  },
  replyMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  replyMetaText: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginRight: 2,
  },
  replyPhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  replyPhoneText: {
    fontSize: 10,
    color: "#6B9FFF",
    fontWeight: "500",
    flexShrink: 1,
  },
  replyBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  replyPlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  replyCommentBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0F0F5",
    alignItems: "center",
    justifyContent: "center",
  },
  replyCommentBtnActive: {
    backgroundColor: Colors.light.primary,
  },
  diarySubReplies: {
    paddingHorizontal: 14,
    paddingBottom: 6,
    gap: 5,
  },
  diarySubReplyBubble: {
    flexDirection: "column",
    backgroundColor: "#F2F9F5",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  diarySubReplyAt: {
    fontSize: 12,
    color: Colors.light.primary,
    fontWeight: "600",
  },
  diarySubReplyText: {
    fontSize: 12,
    color: Colors.light.text,
    flex: 1,
  },
  diarySubReplyTime: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },

  voiceMixedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "#EAF7F0",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#B8E8CE",
  },
  voiceMixedWave: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  voiceMixedBar: {
    width: 2.5,
    borderRadius: 2,
    backgroundColor: Colors.light.primary,
  },
  voiceMixedDuration: {
    fontSize: 11,
    color: Colors.light.primary,
    fontWeight: "600",
  },

  // Shared play button
  playBtn: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  // Progress bar
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressTrackWrap: {
    flex: 1,
    gap: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#E0E0E8",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressTime: {
    fontSize: 10,
    color: Colors.light.textSecondary,
  },

  // Postcard
  postOfficeContainer: {
    flex: 1,
  },
  segmentedControl: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: "#EBEBF0",
    borderRadius: 10,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.textSecondary,
  },
  segmentBtnTextActive: {
    color: Colors.light.text,
    fontWeight: "600",
  },

  // Discover header
  discoverHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  discoverHeaderText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },

  nearbySection: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  nearbySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  nearbySectionTitle: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.light.primary,
    letterSpacing: 0.3,
  },
  nearbyEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  nearbyEmptyText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  nearbyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F0F0F0",
  },
  nearbyCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  nearbyPlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  nearbyCardName: {
    fontSize: 13,
    fontWeight: "500" as const,
    color: Colors.light.text,
    maxWidth: 180,
  },
  nearbyCardMeta: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  nearbyCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  nearbyCardDist: {
    fontSize: 11,
    color: Colors.light.primary,
  },

  postcardCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  postcardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  postcardTypeIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  postcardTitleWrap: {
    flex: 1,
    gap: 3,
  },
  postcardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.text,
  },
  postcardDatetime: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  postcardPlayWrap: {
    alignItems: "center",
    gap: 4,
  },
  postcardPlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  postcardDuration: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  postcardSender: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  postcardQuote: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.primary,
    paddingLeft: 10,
    paddingVertical: 4,
  },
  postcardQuoteText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    fontStyle: "italic",
  },
  postcardProgress: {
    paddingVertical: 4,
  },
  postcardTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  postcardTagPill: {
    backgroundColor: "#FFF0E8",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  postcardTagText: {
    fontSize: 11,
    color: Colors.light.accent,
    fontWeight: "500",
  },
  postcardStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  postcardStatNum: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },
  postcardLikeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
  },
  postcardExpandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  postcardReplyActionBtn: {
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  postcardReplyActionBtnActive: {
    opacity: 1,
  },
  postcardReplyBox: {
    flexDirection: "column",
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 4,
    gap: 8,
    backgroundColor: "#F7FAF8",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.primary + "40",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  replyModeBar: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "flex-start",
  },
  replyModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#E8E8EE",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
  },
  replyModeBtnActive: {
    backgroundColor: Colors.light.primary,
  },
  replyInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  postcardReplyInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    maxHeight: 80,
    paddingTop: 0,
    paddingBottom: 0,
  },
  replyMicBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0FAF4",
  },
  replyMicBtnActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  replyMicArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    borderStyle: "dashed",
    gap: 6,
    backgroundColor: "#F0FAF4",
  },
  replyMicAreaActive: {
    backgroundColor: Colors.light.primary,
    borderStyle: "solid",
  },
  replyMicAreaLabel: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: "500",
  },
  postcardReplySend: {
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  postcardReplySendText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  postcardCommentList: {
    marginTop: 2,
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: "#F7FAF8",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 10,
  },
  postcardCommentTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.primary,
    marginBottom: 2,
  },
  uniComment: {
    flexDirection: "column",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBEB",
    borderRadius: 8,
  },
  uniCommentActive: {
    backgroundColor: "#F0FAF4",
    borderBottomColor: Colors.light.primary + "30",
    paddingHorizontal: 6,
    paddingTop: 4,
    marginHorizontal: -6,
  },
  uniCommentPressable: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  uniCommentAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  uniCommentAvatarVoice: {
    backgroundColor: "#F5974E",
  },
  uniCommentBody: {
    flex: 1,
    gap: 4,
  },
  uniCommentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  uniCommentName: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.text,
    flex: 1,
    marginRight: 8,
  },
  uniCommentTime: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    flexShrink: 0,
  },
  uniCommentText: {
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 18,
  },
  uniCommentVoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF8F2",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  uniCommentVoiceTitle: {
    flex: 1,
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: "500",
  },
  uniCommentVoiceDuration: {
    flexShrink: 0,
  },
  uniCommentVoiceDurationText: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    fontWeight: "400",
  },
  uniCommentPlayBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  subReplyList: {
    marginLeft: 34,
    marginTop: 6,
    gap: 6,
  },
  subReplyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#F3F7F5",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  subReplyAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.light.primary + "99",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  subReplyMeta: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  subReplyText: {
    fontSize: 12,
    color: Colors.light.text,
    lineHeight: 17,
  },
  subReplyAt: {
    color: Colors.light.primary,
    fontWeight: "600",
  },
  commentReplyCard: {
    marginLeft: 38,
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D6EEE0",
    shadowColor: "#3DAA6F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  commentReplySegment: {
    flexDirection: "row",
    backgroundColor: "#F4FAF7",
    borderBottomWidth: 1,
    borderBottomColor: "#E2F0E8",
  },
  commentReplySegBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
  },
  commentReplySegBtnActive: {
    backgroundColor: "#EAF7F0",
    borderBottomWidth: 2,
    borderBottomColor: Colors.light.primary,
  },
  commentReplyInputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  commentReplyTextInput: {
    flex: 1,
    fontSize: 13.5,
    color: Colors.light.text,
    maxHeight: 72,
    lineHeight: 20,
    paddingTop: 0,
    paddingBottom: 0,
  },
  commentReplyActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  commentReplyMicSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    backgroundColor: "#EAF7F0",
    alignItems: "center",
    justifyContent: "center",
  },
  commentReplyMicSmallActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  mixedVoiceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    height: 30,
  },
  mixedVoiceChipText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "600",
  },
  commentReplySendBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  commentReplyMicArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,
    gap: 10,
    backgroundColor: "#F7FCF9",
  },
  commentReplyMicAreaActive: {
    backgroundColor: Colors.light.primary,
  },
  commentReplyMicRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EAF7F0",
    borderWidth: 2,
    borderColor: Colors.light.primary + "40",
    alignItems: "center",
    justifyContent: "center",
  },
  commentReplyMicRingActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderColor: "rgba(255,255,255,0.5)",
  },
  commentReplyMicLabel: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: "600",
  },
  deliveryNote: {
    alignItems: "center",
    paddingVertical: 20,
  },
  deliveryNoteText: {
    fontSize: 13,
    color: Colors.light.textLight,
    letterSpacing: 0.3,
  },

  // Conversation chain
  convList: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  convCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  convDivider: {
    height: 1,
    backgroundColor: "#E8F5EE",
    marginLeft: 68,
  },
  convAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  convBody: {
    flex: 1,
    gap: 7,
  },
  convNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  convUsername: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
    maxWidth: 150,
  },
  hostBadge: {
    backgroundColor: Colors.light.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  hostBadgeText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "700",
  },
  convAction: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 17,
  },
  convText: {
    fontSize: 13.5,
    color: Colors.light.text,
    lineHeight: 20,
  },
  convFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  convDate: {
    fontSize: 11,
    color: Colors.light.textLight,
  },
  convActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  convActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  convActionText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  convActionBtnActive: {
    opacity: 1,
  },

  replyLikeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0F0F5",
    alignItems: "center",
    justifyContent: "center",
  },

  commentLikeRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 8,
    paddingBottom: 2,
    marginTop: -2,
  },
  commentLikeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  likeNotifList: {
    gap: 8,
    marginBottom: 12,
  },
  likeNotifCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFF2F4",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#FF4D6A",
  },
  likeNotifIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFE0E6",
    alignItems: "center",
    justifyContent: "center",
  },
  likeNotifLabel: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: "500",
  },
  likeNotifDate: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  likeNotifClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F0F0F5",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },

  convReplyArea: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#D6EEE0",
    backgroundColor: "#fff",
  },
  convReplyModePills: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F4FAF7",
    borderBottomWidth: 1,
    borderBottomColor: "#E2F0E8",
  },
  convReplyModePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#E8F5EF",
    gap: 2,
  },
  convReplyModePillActive: {
    backgroundColor: Colors.light.primary,
  },
  convReplyInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  convReplyInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    maxHeight: 60,
    lineHeight: 18,
    paddingVertical: 0,
  },
  convReplySendBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  convReplyMicSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    backgroundColor: "#EAF7F0",
    alignItems: "center",
    justifyContent: "center",
  },
  convReplyMicSmallActive: {
    backgroundColor: Colors.light.primary,
  },
  convRecordedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#EAF7F0",
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  convRecordedChipText: {
    fontSize: 11,
    color: Colors.light.primary,
    fontWeight: "600",
  },
  convReplyMicArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 10,
    backgroundColor: "#F4FAF7",
  },
  convReplyMicAreaActive: {
    backgroundColor: Colors.light.primary,
  },
  convReplyMicRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#EAF7F0",
    alignItems: "center",
    justifyContent: "center",
  },
  convReplyMicRingActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  convReplyMicLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
});
