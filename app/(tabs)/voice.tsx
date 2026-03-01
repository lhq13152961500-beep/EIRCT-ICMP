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
      <Pressable onPress={() => haptic()} style={styles.replyPlayBtn}>
        <Ionicons name="play" size={14} color={Colors.light.primary} />
      </Pressable>
      <Pressable onPress={() => haptic()} style={styles.replyCommentBtn}>
        <MaterialCommunityIcons name="chat-outline" size={18} color="#555" />
      </Pressable>
    </View>
  );
}

function DiaryGroup({ group }: { group: typeof MY_DIARY_GROUPS[0] }) {
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
        <View style={styles.diaryStatItem}>
          <MaterialCommunityIcons name="headphones" size={18} color="#555" />
        </View>
        <View style={styles.diaryStatItem}>
          <Ionicons name="heart" size={16} color="#FF4D6A" />
          <Text style={styles.diaryStatCount}>{group.likeCount}</Text>
        </View>
        <View style={styles.diaryStatItem}>
          <MaterialCommunityIcons name="chat-outline" size={18} color="#555" />
        </View>
      </View>

      <View style={styles.replyList}>
        {group.replies.map((r) => (
          <DiaryReplyItem key={r.id} item={r} />
        ))}
      </View>
    </View>
  );
}

function MyDiaryTab() {
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
        <DiaryGroup key={g.id} group={g} />
      ))}
    </ScrollView>
  );
}

// ─── Sound Postcard Card ──────────────────────────────────────────────────────

function SoundPostcard({ item }: { item: typeof SOUND_POSTCARDS[0] }) {
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
          <MaterialCommunityIcons name="headphones" size={16} color="#666" />
          <Text style={styles.postcardStatNum}>{item.listenCount}</Text>
          <Ionicons name="heart" size={15} color="#FF4D6A" />
          <Text style={[styles.postcardStatNum, { color: "#FF4D6A" }]}>{item.likeCount}</Text>
        </View>
      </View>
    </View>
  );
}

function DiscoverOthersTab() {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      <View style={styles.discoverHeader}>
        <Text style={styles.discoverHeaderText}>共收到 8 封声音明信片</Text>
        <Pressable style={styles.filterBtn} onPress={() => haptic()}>
          <Ionicons name="filter" size={14} color={Colors.light.primary} />
          <Text style={styles.filterBtnText}>筛选</Text>
        </Pressable>
      </View>

      {SOUND_POSTCARDS.map((p) => (
        <SoundPostcard key={p.id} item={p} />
      ))}

      <View style={styles.deliveryNote}>
        <Text style={styles.deliveryNoteText}>· · · 时光邮局正在派送更多声音...</Text>
      </View>
    </ScrollView>
  );
}

// ─── Conversation Chain Tab ───────────────────────────────────────────────────

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

function MyConversationChainTab() {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
      {CONVERSATION_CHAIN.map((c) => (
        <ConversationItem key={c.id} item={c} />
      ))}
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
        {subTab === "discover" ? <DiscoverOthersTab /> : <MyConversationChainTab />}
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
    padding: 12,
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
