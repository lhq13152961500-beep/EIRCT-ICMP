import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  Dimensions,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_BAR_HEIGHT = 80;

function haptic(style = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== "web") Haptics.impactAsync(style);
}

// ─── Data ────────────────────────────────────────────────────────────────────

const MY_DIARY_GROUPS = [
  {
    id: "d1",
    title: "听见·黄岭村的清晨",
    date: "2026-02-15 16:05",
    duration: "02:14",
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
    isHost: true,
    text: "你说的对，我非常感佩你的发言。",
    progress: 0.25,
    total: "02:14",
    date: "2025年12月1日",
  },
  {
    id: "c2",
    avatar: require("@/assets/images/avatar-2.png"),
    username: "聪明的一休",
    isHost: true,
    text: "好的",
    progress: 0.62,
    total: "05:06",
    date: "2025年6月15日",
  },
  {
    id: "c3",
    avatar: require("@/assets/images/avatar-3.png"),
    username: "可爱的常常的Smooth",
    isHost: true,
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
    text: "这段声音真的很触动人心。",
    progress: 0.4,
    total: "03:22",
    date: "2025年5月20日",
  },
];

// ─── Small shared components ──────────────────────────────────────────────────

function PlayButton({ size = 36, color = Colors.light.primary }: { size?: number; color?: string }) {
  return (
    <Pressable
      style={[styles.playBtn, { width: size, height: size, borderRadius: size / 2, borderColor: color }]}
      onPress={() => haptic()}
    >
      <Ionicons name="play" size={size * 0.45} color={color} />
    </Pressable>
  );
}

function ProgressBar({ progress, total, color = Colors.light.primary }: { progress: number; total: string; color?: string }) {
  const elapsed = (() => {
    const parts = total.split(":").map(Number);
    const totalSec = parts[0] * 60 + parts[1];
    const elapsedSec = Math.floor(totalSec * progress);
    const m = Math.floor(elapsedSec / 60).toString().padStart(2, "0");
    const s = (elapsedSec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  })();

  return (
    <View style={styles.progressRow}>
      <PlayButton size={28} color={color} />
      <View style={styles.progressTrackWrap}>
        <View style={[styles.progressTrack]}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: color }]} />
        </View>
        <Text style={styles.progressTime}>{elapsed} / {total}</Text>
      </View>
    </View>
  );
}

// ─── My Diary Tab ─────────────────────────────────────────────────────────────

function DiaryReplyItem({ item }: { item: typeof MY_DIARY_GROUPS[0]["replies"][0] }) {
  return (
    <View style={styles.replyItem}>
      <View style={styles.replyLeft}>
        <Text style={styles.replyTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.replyMeta}>
          <Ionicons name="time-outline" size={10} color={Colors.light.textSecondary} />
          <Text style={styles.replyMetaText}>{item.duration}</Text>
          <Ionicons name="calendar-outline" size={10} color={Colors.light.textSecondary} />
          <Text style={styles.replyMetaText}>{item.date}</Text>
          <Ionicons name="person-outline" size={10} color="#6B9FFF" />
          <Text style={[styles.replyMetaText, { color: "#6B9FFF" }]}>{item.phone}</Text>
        </View>
      </View>
      <View style={styles.replyBtnRow}>
        <Pressable onPress={() => haptic()} style={styles.replyPlayBtn}>
          <Ionicons name="play" size={14} color={Colors.light.primary} />
        </Pressable>
        <Pressable
          onPress={() => haptic(Haptics.ImpactFeedbackStyle.Medium)}
          style={styles.replyCommentBtn}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={Colors.light.primary} />
        </Pressable>
      </View>
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
        </View>
        <PlayButton size={32} />
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
            <DiaryReplyItem key={r.id} item={r} />
          ))}
        </View>
      )}
    </View>
  );
}

function MyDiaryTab() {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.tabContent}
    >
      <View style={styles.diaryHeader}>
        <Text style={styles.diaryHeaderText}>共 12 份记忆</Text>
        <View style={styles.viewToggle}>
          <Pressable onPress={() => haptic()}>
            <Ionicons name="grid-outline" size={20} color={Colors.light.textSecondary} />
          </Pressable>
          <Pressable onPress={() => haptic()}>
            <Ionicons name="list-outline" size={20} color={Colors.light.text} />
          </Pressable>
        </View>
      </View>

      {MY_DIARY_GROUPS.map((g) => (
        <DiaryGroup
          key={g.id}
          group={g}
          isExpanded={!!expandedIds[g.id]}
          onToggleExpand={() => toggleExpand(g.id)}
        />
      ))}
    </ScrollView>
  );
}

// ─── Comment Types ────────────────────────────────────────────────────────────

type VoiceComment = { id: string; type: "voice"; title: string; duration: string; date: string; phone: string };
type TextComment  = { id: string; type: "text";  username: string; time: string; text: string };
type CommentItem  = VoiceComment | TextComment;
type SubReply       = { id: string; username: string; time: string; text: string; replyTo: string };
type MyInteraction  = {
  id: string;
  kind: "postcard_text" | "postcard_voice" | "comment_reply";
  postcardTitle: string;
  replyToName?: string;
  text: string;
  date: string;
};

// ─── Sound Postcard Card ──────────────────────────────────────────────────────

function PostcardComment({
  item,
  subReplies,
  isReplying,
  replyText,
  onReplyTextChange,
  onPress,
  onSubmitReply,
}: {
  item: CommentItem;
  subReplies: SubReply[];
  isReplying: boolean;
  replyText: string;
  onReplyTextChange: (t: string) => void;
  onPress: () => void;
  onSubmitReply: () => void;
}) {
  const isVoice = item.type === "voice";
  const name = isVoice ? item.phone : item.username;
  const time = isVoice ? item.date : item.time;

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
            <Text style={styles.uniCommentText}>{item.text}</Text>
          )}
        </View>
      </Pressable>

      {subReplies.length > 0 && (
        <View style={styles.subReplyList}>
          {subReplies.map((r) => (
            <View key={r.id} style={styles.subReplyItem}>
              <View style={styles.subReplyAvatar}>
                <Ionicons name="person" size={9} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subReplyMeta}>{r.username} · {r.time}</Text>
                <Text style={styles.subReplyText}>
                  <Text style={styles.subReplyAt}>@{r.replyTo} </Text>
                  {r.text}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {isReplying && (
        <View style={styles.commentReplyBox}>
          <TextInput
            style={styles.commentReplyInput}
            placeholder={`回复 @${name}...`}
            placeholderTextColor={Colors.light.textSecondary}
            value={replyText}
            onChangeText={onReplyTextChange}
            autoFocus
            multiline
          />
          <Pressable
            style={[styles.commentReplySend, replyText.trim().length === 0 && { opacity: 0.4 }]}
            onPress={onSubmitReply}
            disabled={replyText.trim().length === 0}
          >
            <Text style={styles.commentReplySendText}>回复</Text>
          </Pressable>
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
  subRepliesByComment,
  replyingToCommentId,
  onReplyToComment,
  commentReplyText,
  onCommentReplyTextChange,
  onSubmitCommentReply,
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
  subRepliesByComment: Record<string, SubReply[]>;
  replyingToCommentId: string | null;
  onReplyToComment: (commentId: string) => void;
  commentReplyText: string;
  onCommentReplyTextChange: (t: string) => void;
  onSubmitCommentReply: (commentId: string) => void;
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
          <ProgressBar progress={item.progress} total={item.duration} />
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
                <Pressable
                  style={[styles.replyMicBtn, isRecording && styles.replyMicBtnActive]}
                  onPressIn={() => { onRecordStart(); haptic(Haptics.ImpactFeedbackStyle.Heavy); }}
                  onPressOut={onRecordEnd}
                >
                  <Ionicons name="mic" size={16} color={isRecording ? "#fff" : Colors.light.primary} />
                </Pressable>
              )}
              <Pressable
                style={[styles.postcardReplySend, replyText.trim().length === 0 && { opacity: 0.4 }]}
                onPress={onSubmitReply}
                disabled={replyText.trim().length === 0}
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

function DiscoverOthersTab({ onAddInteraction }: { onAddInteraction: (item: MyInteraction) => void }) {
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
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
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [commentReplyText, setCommentReplyText] = useState("");
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
    } else {
      setReplyingToId(id);
      setReplyText("");
      setReplyMode("text");
      setIsRecording(false);
    }
  };

  const nowStr = () => {
    const n = new Date();
    return `${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")} ${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };

  const submitVoiceReply = (postcardId: string) => {
    if (!isRecording) return;
    const time = nowStr();
    const dur = `00:${String(Math.floor(Math.random() * 25) + 5).padStart(2, "0")}`;
    const newComment: VoiceComment = {
      id: Date.now().toString(),
      type: "voice",
      title: "我的语音留言",
      duration: dur,
      date: time,
      phone: "我",
    };
    setCommentsByPostcard((prev) => ({
      ...prev,
      [postcardId]: [...(prev[postcardId] ?? []), newComment],
    }));
    setExpandedIds((prev) => ({ ...prev, [postcardId]: true }));
    setIsRecording(false);
    const postcard = SOUND_POSTCARDS.find((p) => p.id === postcardId);
    onAddInteraction({
      id: Date.now().toString() + "v",
      kind: "postcard_voice",
      postcardTitle: postcard?.title ?? "声音明信片",
      text: dur,
      date: time,
    });
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const submitReply = (postcardId: string) => {
    if (!replyText.trim()) return;
    const time = nowStr();
    const newComment: TextComment = {
      id: Date.now().toString(),
      type: "text",
      username: "我",
      time,
      text: replyText.trim(),
    };
    setCommentsByPostcard((prev) => ({
      ...prev,
      [postcardId]: [...(prev[postcardId] ?? []), newComment],
    }));
    setExpandedIds((prev) => ({ ...prev, [postcardId]: true }));
    setReplyingToId(null);
    const savedText = replyText.trim();
    setReplyText("");
    const postcard = SOUND_POSTCARDS.find((p) => p.id === postcardId);
    onAddInteraction({
      id: Date.now().toString() + "t",
      kind: "postcard_text",
      postcardTitle: postcard?.title ?? "声音明信片",
      text: savedText,
      date: time,
    });
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  const replyToComment = (commentId: string) => {
    if (replyingToCommentId === commentId) {
      setReplyingToCommentId(null);
      setCommentReplyText("");
    } else {
      setReplyingToCommentId(commentId);
      setCommentReplyText("");
    }
  };

  const submitCommentReply = (commentId: string) => {
    if (!commentReplyText.trim()) return;
    const now = new Date();
    const time = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const allComments = Object.values(commentsByPostcard).flat();
    const target = allComments.find((c) => c.id === commentId);
    const replyTo = target
      ? target.type === "voice" ? target.phone : target.username
      : "对方";
    const newReply: SubReply = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      username: "我",
      time,
      text: commentReplyText.trim(),
      replyTo,
    };
    setSubRepliesByComment((prev) => ({
      ...prev,
      [commentId]: [...(prev[commentId] ?? []), newReply],
    }));
    setReplyingToCommentId(null);
    const savedCommentText = commentReplyText.trim();
    setCommentReplyText("");
    const postcardForComment = SOUND_POSTCARDS.find((p) =>
      p.comments.some((c) => c.id === commentId)
    );
    onAddInteraction({
      id: Date.now().toString() + "r",
      kind: "comment_reply",
      postcardTitle: postcardForComment?.title ?? "声音明信片",
      replyToName: replyTo,
      text: savedCommentText,
      date: time,
    });
    haptic(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.tabContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.discoverHeader}>
        <Text style={styles.discoverHeaderText}>共收到 8 封声音明信片</Text>
        <Pressable style={styles.filterBtn} onPress={() => haptic()}>
          <Ionicons name="filter" size={14} color={Colors.light.primary} />
          <Text style={styles.filterBtnText}>筛选</Text>
        </Pressable>
      </View>

      {SOUND_POSTCARDS.map((p) => (
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
          onRecordStart={() => setIsRecording(true)}
          onRecordEnd={() => submitVoiceReply(p.id)}
          subRepliesByComment={subRepliesByComment}
          replyingToCommentId={replyingToCommentId}
          onReplyToComment={replyToComment}
          commentReplyText={commentReplyText}
          onCommentReplyTextChange={setCommentReplyText}
          onSubmitCommentReply={submitCommentReply}
        />
      ))}

      <View style={styles.deliveryNote}>
        <Text style={styles.deliveryNoteText}>· · · 时光邮局正在派送更多声音...</Text>
      </View>
    </ScrollView>
  );
}

// ─── Conversation Chain Tab ───────────────────────────────────────────────────

function MyInteractionItem({ item }: { item: MyInteraction }) {
  const kindLabel =
    item.kind === "postcard_voice"
      ? "发送了语音留言"
      : item.kind === "comment_reply"
      ? `回复了 @${item.replyToName}`
      : "发送了文字留言";

  const kindIcon: "mic" | "chatbubble-ellipses" | "text" =
    item.kind === "postcard_voice" ? "mic" : "chatbubble-ellipses";

  return (
    <View style={styles.myInteractionCard}>
      <View style={styles.myInteractionAvatarWrap}>
        <View style={styles.myInteractionAvatar}>
          <Ionicons name={kindIcon} size={14} color="#fff" />
        </View>
      </View>
      <View style={styles.myInteractionBody}>
        <View style={styles.myInteractionHeader}>
          <Text style={styles.myInteractionLabel} numberOfLines={1}>
            我 · <Text style={styles.myInteractionKind}>{kindLabel}</Text>
          </Text>
          <Text style={styles.myInteractionDate}>{item.date}</Text>
        </View>
        <Text style={styles.myInteractionTarget} numberOfLines={1}>
          {item.postcardTitle}
        </Text>
        <View style={styles.myInteractionTextWrap}>
          {item.kind === "postcard_voice" ? (
            <View style={styles.myInteractionVoiceRow}>
              <Ionicons name="mic" size={11} color={Colors.light.primary} />
              <Text style={styles.myInteractionVoiceLabel}>语音留言</Text>
              <View style={styles.myInteractionVoiceDot} />
              <Text style={styles.myInteractionVoiceLen}>{item.text}</Text>
            </View>
          ) : (
            <Text style={styles.myInteractionText} numberOfLines={2}>{item.text}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function ConversationItem({ item }: { item: typeof CONVERSATION_CHAIN[0] }) {
  return (
    <View style={styles.convCard}>
      <Image source={item.avatar} style={styles.convAvatar} resizeMode="cover" />
      <View style={styles.convBody}>
        <View style={styles.convHeader}>
          <Text style={styles.convUsername} numberOfLines={1}>{item.username}</Text>
          {item.isHost && (
            <View style={styles.hostBadge}>
              <Text style={styles.hostBadgeText}>主</Text>
            </View>
          )}
          <Text style={styles.convAction}>对您的留音进行了回应</Text>
        </View>

        <Text style={styles.convText} numberOfLines={2}>{item.text}</Text>

        <ProgressBar progress={item.progress} total={item.total} />

        <View style={styles.convFooter}>
          <Text style={styles.convDate}>{item.date}</Text>
          <View style={styles.convActions}>
            <Pressable style={styles.convActionBtn} onPress={() => haptic()}>
              <MaterialCommunityIcons name="chat-outline" size={14} color={Colors.light.textSecondary} />
              <Text style={styles.convActionText}>回复</Text>
            </Pressable>
            <Pressable style={styles.convActionBtn} onPress={() => haptic()}>
              <Ionicons name="heart-outline" size={14} color={Colors.light.textSecondary} />
              <Text style={styles.convActionText}>点赞</Text>
            </Pressable>
            <Pressable onPress={() => haptic()}>
              <Ionicons name="ellipsis-vertical" size={16} color={Colors.light.textSecondary} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function MyConversationChainTab({ myInteractions }: { myInteractions: MyInteraction[] }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {myInteractions.length > 0 && (
        <View style={styles.myInteractionSection}>
          <Text style={styles.myInteractionSectionTitle}>我的互动记录</Text>
          {myInteractions.map((i) => (
            <MyInteractionItem key={i.id} item={i} />
          ))}
        </View>
      )}
      {CONVERSATION_CHAIN.map((c) => (
        <ConversationItem key={c.id} item={c} />
      ))}
    </ScrollView>
  );
}

// ─── Sound Post Office Tab ────────────────────────────────────────────────────

function SoundPostOfficeTab() {
  const [subTab, setSubTab] = useState<"discover" | "chain">("discover");
  const [myInteractions, setMyInteractions] = useState<MyInteraction[]>([]);

  const addInteraction = (item: MyInteraction) => {
    setMyInteractions((prev) => [item, ...prev]);
  };

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
          ? <DiscoverOthersTab onAddInteraction={addInteraction} />
          : <MyConversationChainTab myInteractions={myInteractions} />
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
  viewToggle: {
    flexDirection: "row",
    gap: 12,
  },

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
    flexWrap: "wrap",
  },
  replyMetaText: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginRight: 2,
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
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  filterBtnText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: "500",
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
  commentReplyBox: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginLeft: 34,
    marginTop: 8,
    gap: 6,
    backgroundColor: "#EEF8F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.light.primary + "50",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  commentReplyInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.light.text,
    maxHeight: 60,
    paddingTop: 0,
    paddingBottom: 0,
  },
  commentReplySend: {
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  commentReplySendText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "700",
  },
  myInteractionSection: {
    marginBottom: 8,
    gap: 8,
  },
  myInteractionSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.textSecondary,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  myInteractionCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.primary + "25",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  myInteractionAvatarWrap: {
    paddingTop: 2,
  },
  myInteractionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  myInteractionBody: {
    flex: 1,
    gap: 3,
  },
  myInteractionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  myInteractionLabel: {
    fontSize: 12,
    color: Colors.light.text,
    flex: 1,
  },
  myInteractionKind: {
    color: Colors.light.primary,
    fontWeight: "600",
  },
  myInteractionDate: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    flexShrink: 0,
    marginLeft: 6,
  },
  myInteractionTarget: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  myInteractionTextWrap: {
    backgroundColor: "#F5FAF7",
    borderRadius: 8,
    padding: 8,
  },
  myInteractionText: {
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 18,
  },
  myInteractionVoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  myInteractionVoiceLabel: {
    fontSize: 12,
    color: Colors.light.text,
    fontWeight: "500",
  },
  myInteractionVoiceDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.light.textSecondary,
  },
  myInteractionVoiceLen: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: "500",
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
  convCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  convAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  convBody: {
    flex: 1,
    gap: 8,
  },
  convHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
  },
  convUsername: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
    maxWidth: 130,
  },
  hostBadge: {
    backgroundColor: "#FF6B6B",
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
  },
  convText: {
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 18,
  },
  convFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
});
