"use no memo";
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Platform, Modal, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

// ── Colors ──────────────────────────────────────────────────────────────────
const BG      = "#F5EFE6";
const CARD    = "#FFFFFF";
const ORANGE  = "#E07030";
const ORANGE_L = "#FFF0E8";
const TEXT1   = "#1A1A2E";
const TEXT2   = "#666880";
const TEXT3   = "#9B9BB0";
const BORDER  = "#F0EBE3";
const GREEN   = "#3A9060";
const GREEN_L = "#E8F5EE";
const BLUE    = "#3A78E0";

type Screen = "list" | "dialect" | "sound" | "rewards" | "achievements";

// ── Dialect terms (5 ways to say "玉米") ─────────────────────────────────────
const DIALECT_TERMS = [
  { id: 1, term: "包谷",  region: "西南地区" },
  { id: 2, term: "棒子",  region: "华北地区" },
  { id: 3, term: "苞米",  region: "东北地区" },
  { id: 4, term: "珍珠米", region: "江南地区" },
  { id: 5, term: "玉蜀黍", region: "闽南地区" },
];

// ── Sound matching items ─────────────────────────────────────────────────────
const SOUND_ITEMS = [
  { id: 1, name: "土豆", dialect: "洋芋",  emoji: "🥔" },
  { id: 2, name: "西红柿", dialect: "番茄",  emoji: "🍅" },
  { id: 3, name: "花生", dialect: "长生果", emoji: "🥜" },
  { id: 4, name: "红薯", dialect: "地瓜",  emoji: "🍠" },
  { id: 5, name: "黄瓜", dialect: "青瓜",  emoji: "🥒" },
  { id: 6, name: "茄子", dialect: "矮瓜",  emoji: "🍆" },
];

// ── Badges ───────────────────────────────────────────────────────────────────
const ALL_BADGES = [
  { id: "dialect-master", icon: "🗣️", name: "方言达人",   desc: "收集所有方言称呼" },
  { id: "sound-expert",   icon: "👂", name: "听音辨物",   desc: "完成声音寻觅游戏" },
  { id: "perfect-score",  icon: "⭐", name: "满分学霸",   desc: "获得满分成绩" },
  { id: "explorer",       icon: "🧭", name: "乡音探索者", desc: "完成两项游戏" },
];

// ── Physical rewards ─────────────────────────────────────────────────────────
const REWARDS = [
  { id: "grape", icon: "🍇", name: "吐峪沟葡萄干", desc: "500g纯天然晾晒葡萄干", cost: 80 },
  { id: "naan",  icon: "🫓", name: "馕饼兑换券",   desc: "兑换一个传统馕坑烤馕", cost: 50 },
  { id: "stay",  icon: "🏠", name: "民宿折扣券",   desc: "入住合作民宿立减50元", cost: 120 },
  { id: "craft", icon: "🎨", name: "土陶体验课",   desc: "参与传统土陶制作体验", cost: 150 },
  { id: "honey", icon: "🍯", name: "农家蜂蜜",     desc: "250g纯天然蜂蜜",      cost: 100 },
  { id: "photo", icon: "📸", name: "摄影服务券",   desc: "专属摄影服务一次",      cost: 180 },
];

// ── Skins ────────────────────────────────────────────────────────────────────
const SKINS = [
  { id: "default", preview: "🧑", name: "默认皮肤", cost: 0,   unlocked: true },
  { id: "folk",    preview: "👘", name: "民族风",   cost: 200, unlocked: false },
  { id: "ancient", preview: "🏺", name: "古韵风",   cost: 300, unlocked: false },
  { id: "nature",  preview: "🌿", name: "自然风",   cost: 250, unlocked: false },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function DialectGamePage() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const haptic = () => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const [screen, setScreen]     = useState<Screen>("list");
  const [points, setPoints]     = useState(0);
  const [unlockedBadges, setUnlockedBadges] = useState<string[]>([]);
  const [redeemedRewards, setRedeemedRewards] = useState<string[]>([]);
  const [activeSkin, setActiveSkin] = useState("default");
  const [unlockedSkins, setUnlockedSkins] = useState(["default"]);

  // ── Dialect game state ───────────────────────────────────────────────────
  const [collectedIds, setCollectedIds]   = useState<number[]>([]);
  const [dialectDone, setDialectDone]     = useState(false);
  const [dialectRewarded, setDialectRewarded] = useState(false);
  const [showDialectWin, setShowDialectWin]   = useState(false);

  useEffect(() => {
    if (collectedIds.length === DIALECT_TERMS.length && !dialectRewarded) {
      setDialectRewarded(true);
      setPoints(p => p + 100);
      const newBadges = [...unlockedBadges];
      if (!newBadges.includes("dialect-master")) newBadges.push("dialect-master");
      if (!newBadges.includes("perfect-score"))  newBadges.push("perfect-score");
      if (newBadges.filter(b => ["dialect-master","sound-expert"].includes(b)).length === 2)
        if (!newBadges.includes("explorer")) newBadges.push("explorer");
      setUnlockedBadges(newBadges);
      setTimeout(() => setShowDialectWin(true), 400);
    }
  }, [collectedIds]);

  // ── Sound game state ─────────────────────────────────────────────────────
  const [soundRound, setSoundRound]   = useState(0);
  const [soundScore, setSoundScore]   = useState(0);
  const [soundResult, setSoundResult] = useState<"correct" | "wrong" | null>(null);
  const [soundSelected, setSoundSelected] = useState<number | null>(null);
  const [soundDone, setSoundDone]     = useState(false);
  const [soundOptions, setSoundOptions] = useState<typeof SOUND_ITEMS>([]);
  const [soundRewarded, setSoundRewarded] = useState(false);

  const shuffleOptions = useCallback((correctId: number) => {
    const pool = [...SOUND_ITEMS].sort(() => Math.random() - 0.5);
    const opts: typeof SOUND_ITEMS = [];
    if (!pool.slice(0, 4).find(i => i.id === correctId)) {
      pool[0] = SOUND_ITEMS.find(i => i.id === correctId)!;
    }
    const seen = new Set<number>();
    for (const item of pool) {
      if (!seen.has(item.id)) { seen.add(item.id); opts.push(item); }
      if (opts.length === 4) break;
    }
    setSoundOptions(opts);
  }, []);

  useEffect(() => {
    if (screen === "sound") shuffleOptions(SOUND_ITEMS[soundRound].id);
  }, [screen, soundRound]);

  useEffect(() => {
    if (soundDone && !soundRewarded) {
      setSoundRewarded(true);
      setPoints(p => p + soundScore * 10);
      const newBadges = [...unlockedBadges];
      if (!newBadges.includes("sound-expert")) newBadges.push("sound-expert");
      if (dialectRewarded && !newBadges.includes("explorer")) newBadges.push("explorer");
      setUnlockedBadges(newBadges);
    }
  }, [soundDone]);

  const handleSoundSelect = (id: number) => {
    if (soundResult) return;
    haptic();
    setSoundSelected(id);
    const correct = id === SOUND_ITEMS[soundRound].id;
    setSoundResult(correct ? "correct" : "wrong");
    if (correct) setSoundScore(s => s + 1);
    setTimeout(() => {
      setSoundSelected(null);
      setSoundResult(null);
      if (soundRound < SOUND_ITEMS.length - 1) {
        setSoundRound(r => r + 1);
      } else {
        setSoundDone(true);
      }
    }, 1200);
  };

  // ── Rewards ──────────────────────────────────────────────────────────────
  const [rewardsTab, setRewardsTab] = useState<"physical"|"badges"|"skins">("physical");
  const [toastMsg, setToastMsg]     = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const handleRedeem = (reward: typeof REWARDS[0]) => {
    if (redeemedRewards.includes(reward.id)) return;
    if (points < reward.cost) { showToast("积分不足"); return; }
    setPoints(p => p - reward.cost);
    setRedeemedRewards(r => [...r, reward.id]);
    showToast(`兑换成功：${reward.name}`);
    haptic();
  };

  const handleUnlockSkin = (skinId: string, cost: number) => {
    if (unlockedSkins.includes(skinId)) { setActiveSkin(skinId); return; }
    if (points < cost) { showToast("积分不足"); return; }
    setPoints(p => p - cost);
    setUnlockedSkins(s => [...s, skinId]);
    setActiveSkin(skinId);
    showToast("皮肤已解锁！");
    haptic();
  };

  // ── Dialect game progress (stored across nav) ────────────────────────────
  const dialectProgress = collectedIds.length;
  const soundProgress   = soundRound < SOUND_ITEMS.length ? soundRound : SOUND_ITEMS.length;

  // ════════════════════════════════════════════════════════════════════════════
  //  SCREENS
  // ════════════════════════════════════════════════════════════════════════════

  // ── HEADER helper ────────────────────────────────────────────────────────
  const Header = ({ title, onBack }: { title: string; onBack: () => void }) => (
    <View style={[s.header, { paddingTop: topPad + 4 }]}>
      <Pressable style={s.backBtn} onPress={() => { haptic(); onBack(); }}>
        <Ionicons name="chevron-back" size={24} color={TEXT1} />
      </Pressable>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={{ width: 32 }} />
    </View>
  );

  // ── GAME LIST ────────────────────────────────────────────────────────────
  if (screen === "list") {
    return (
      <View style={s.root}>
        <LinearGradient colors={["#FFF4EC", "#F5EFE6"]} style={[s.header, { paddingTop: topPad + 4 }]}>
          <Pressable style={s.backBtn} onPress={() => { haptic(); router.back(); }}>
            <Ionicons name="chevron-back" size={24} color={TEXT1} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>乡音趣采</Text>
          </View>
          <View style={{ width: 32 }} />
        </LinearGradient>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Title block */}
          <View style={s.titleBlock}>
            <Text style={s.pageTitle}>乡音趣采</Text>
            <Text style={s.pageSub}>探索本地方言，感受文化魅力</Text>
          </View>

          {/* Points banner */}
          <Pressable onPress={() => { haptic(); setScreen("rewards"); }} style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <LinearGradient colors={["#A060E8", "#E03080"]} style={s.pointsBanner}>
              <View style={s.pointsLeft}>
                <View style={s.pointsIconWrap}>
                  <Ionicons name="gift-outline" size={24} color="#fff" />
                </View>
                <View>
                  <Text style={s.pointsTitle}>积分中心</Text>
                  <Text style={s.pointsSub}>兑换精彩奖励</Text>
                </View>
              </View>
              <View style={s.pointsRight}>
                <View style={s.pointsAmtRow}>
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={s.pointsAmt}>{points}</Text>
                </View>
                <Text style={s.pointsBadgeCount}>{unlockedBadges.length} 个徽章</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </Pressable>

          {/* Game cards */}
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            {/* 方言采集 */}
            <Pressable style={s.gameCard} onPress={() => { haptic(); setScreen("dialect"); }}>
              <View style={s.gameCardBg}>
                <LinearGradient colors={["rgba(224,112,48,0.06)","rgba(220,60,60,0.06)"]} style={StyleSheet.absoluteFill} />
              </View>
              <View style={s.gameCardTop}>
                <LinearGradient colors={["#F07040","#D04040"]} style={s.gameIconWrap}>
                  <Ionicons name="list-outline" size={22} color="#fff" />
                </LinearGradient>
                <Ionicons name="chevron-forward" size={18} color={TEXT3} />
              </View>
              <Text style={s.gameTitle}>方言采集</Text>
              <Text style={s.gameSub}>收集本地「玉米」的5种称呼</Text>
              <View style={s.progressArea}>
                <View style={s.progressLabelRow}>
                  <Text style={s.progressLabel}>进度</Text>
                  <Text style={s.progressVal}>{dialectProgress}/5</Text>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${(dialectProgress / 5) * 100}%`, backgroundColor: "#E07040" }]} />
                </View>
              </View>
            </Pressable>

            {/* 声音寻觅 */}
            <Pressable style={s.gameCard} onPress={() => { haptic(); setScreen("sound"); }}>
              <View style={s.gameCardBg}>
                <LinearGradient colors={["rgba(58,120,224,0.06)","rgba(40,190,220,0.06)"]} style={StyleSheet.absoluteFill} />
              </View>
              <View style={s.gameCardTop}>
                <LinearGradient colors={["#3A78E0","#28BCDC"]} style={s.gameIconWrap}>
                  <Ionicons name="volume-high-outline" size={22} color="#fff" />
                </LinearGradient>
                <Ionicons name="chevron-forward" size={18} color={TEXT3} />
              </View>
              <Text style={s.gameTitle}>声音寻觅</Text>
              <Text style={s.gameSub}>根据方言发音找到对应物品</Text>
              <View style={s.progressArea}>
                <View style={s.progressLabelRow}>
                  <Text style={s.progressLabel}>进度</Text>
                  <Text style={s.progressVal}>{soundProgress}/{SOUND_ITEMS.length}</Text>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${(soundProgress / SOUND_ITEMS.length) * 100}%`, backgroundColor: BLUE }]} />
                </View>
              </View>
            </Pressable>
          </View>

          <Text style={s.comingSoon}>更多游戏即将上架....</Text>

          {/* Achievement entry */}
          <Pressable style={s.achieveCard} onPress={() => { haptic(); setScreen("achievements"); }}>
            <View style={s.achieveLeft}>
              <View style={s.trophyWrap}>
                <LinearGradient colors={["#4A88E8","#3060C0"]} style={s.trophyOuter}>
                  <LinearGradient colors={["#F07828","#D04010"]} style={s.trophyInner}>
                    <Ionicons name="trophy" size={28} color="#fff" />
                  </LinearGradient>
                </LinearGradient>
                {unlockedBadges.length > 0 && (
                  <View style={s.trophyBadgeCount}>
                    <Text style={s.trophyBadgeNum}>{unlockedBadges.length}</Text>
                  </View>
                )}
              </View>
              <View>
                <Text style={s.achieveTitle}>已获得 {unlockedBadges.length} 枚勋章</Text>
                <Text style={s.achieveSub}>解锁更多游戏，收获专属成就</Text>
              </View>
            </View>
            <View style={s.achieveBtn}>
              <Text style={s.achieveBtnText}>全部成就</Text>
            </View>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── DIALECT GAME ─────────────────────────────────────────────────────────
  if (screen === "dialect") {
    return (
      <View style={s.root}>
        <LinearGradient colors={["#FFF4EC", "#F5EFE6"]} style={[s.header, { paddingTop: topPad + 4 }]}>
          <Pressable style={s.backBtn} onPress={() => { haptic(); setScreen("list"); }}>
            <Ionicons name="chevron-back" size={24} color={TEXT1} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>方言采集</Text>
          </View>
          <View style={s.roundBadge}>
            <Text style={s.roundBadgeText}>{collectedIds.length}/5</Text>
          </View>
        </LinearGradient>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={s.gameHeading}>「玉米」的方言称呼</Text>
          <Text style={s.gameSubheading}>点击卡片采集各地的方言说法，收集全部5种即可获得 +100 乡音积分</Text>

          <View style={s.dialectGrid}>
            {DIALECT_TERMS.map((term) => {
              const collected = collectedIds.includes(term.id);
              return (
                <Pressable
                  key={term.id}
                  style={[s.dialectCard, collected && s.dialectCardCollected]}
                  onPress={() => {
                    if (collected) return;
                    haptic();
                    setCollectedIds(prev => [...prev, term.id]);
                  }}
                >
                  {collected ? (
                    <>
                      <Ionicons name="checkmark-circle" size={28} color={GREEN} style={{ marginBottom: 6 }} />
                      <Text style={s.dialectTermCollected}>{term.term}</Text>
                      <Text style={s.dialectRegion}>{term.region}</Text>
                    </>
                  ) : (
                    <>
                      <View style={s.dialectQuestionWrap}>
                        <Text style={s.dialectQuestion}>???</Text>
                      </View>
                      <Text style={s.dialectRegion}>{term.region}</Text>
                      <Text style={s.dialectTap}>点击采集</Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Progress */}
          <View style={s.dialectProgressCard}>
            <Text style={s.dialectProgressLabel}>已收集 {collectedIds.length} / 5 种称呼</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${(collectedIds.length / 5) * 100}%`, backgroundColor: ORANGE }]} />
            </View>
          </View>
        </ScrollView>

        {/* Win modal */}
        <Modal visible={showDialectWin} transparent animationType="fade">
          <View style={s.modalBackdrop}>
            <View style={s.winModal}>
              <View style={s.winIconWrap}>
                <LinearGradient colors={["#F0A828","#E06018"]} style={s.winIcon}>
                  <Ionicons name="sparkles" size={36} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={s.winTitle}>恭喜完成！</Text>
              <Text style={s.winDesc}>你已收集到「玉米」的5种方言称呼，了解了中国语言的多样性！</Text>
              <View style={s.winPointsRow}>
                <Ionicons name="sparkles" size={20} color="#E09020" />
                <Text style={s.winPoints}>+100 乡音积分</Text>
              </View>
              <Pressable style={s.winBtn} onPress={() => { haptic(); setShowDialectWin(false); setScreen("list"); }}>
                <Text style={s.winBtnText}>继续探索</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── SOUND GAME ───────────────────────────────────────────────────────────
  if (screen === "sound") {
    const current = SOUND_ITEMS[Math.min(soundRound, SOUND_ITEMS.length - 1)];
    return (
      <View style={s.root}>
        <LinearGradient colors={["#EEF4FF", "#F5EFE6"]} style={[s.header, { paddingTop: topPad + 4 }]}>
          <Pressable style={s.backBtn} onPress={() => { haptic(); setScreen("list"); }}>
            <Ionicons name="chevron-back" size={24} color={TEXT1} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>声音寻觅</Text>
          </View>
          <View style={s.roundBadge}>
            <Text style={s.roundBadgeText}>{soundScore}/{SOUND_ITEMS.length}</Text>
          </View>
        </LinearGradient>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Progress bar */}
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${((soundRound) / SOUND_ITEMS.length) * 100}%`, backgroundColor: BLUE }]} />
          </View>
          <Text style={[s.gameSubheading, { marginTop: 8, marginBottom: 16 }]}>
            第 {Math.min(soundRound + 1, SOUND_ITEMS.length)} / {SOUND_ITEMS.length} 题
          </Text>

          {soundDone ? (
            /* Result card */
            <View style={s.soundResultCard}>
              <LinearGradient colors={["#3A78E0", "#28BCDC"]} style={s.soundResultGrad}>
                <Ionicons name="trophy" size={52} color="#fff" style={{ marginBottom: 12 }} />
                <Text style={s.soundResultTitle}>游戏完成！</Text>
                <Text style={s.soundResultScore}>得分：{soundScore} / {SOUND_ITEMS.length}</Text>
                <Text style={s.soundResultMsg}>
                  {soundScore === SOUND_ITEMS.length ? "完美！你对方言了如指掌！"
                    : soundScore >= 4 ? "非常好！继续加油！"
                    : "不错的尝试，多练习会更好！"}
                </Text>
                <View style={s.soundResultPointsRow}>
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={s.soundResultPoints}>+{soundScore * 10} 乡音积分</Text>
                </View>
                <Pressable style={s.soundRetryBtn} onPress={() => {
                  haptic();
                  setSoundRound(0); setSoundScore(0); setSoundDone(false);
                  setSoundRewarded(false); setSoundResult(null); setSoundSelected(null);
                  setScreen("list");
                }}>
                  <Text style={s.soundRetryText}>返回首页</Text>
                </Pressable>
              </LinearGradient>
            </View>
          ) : (
            <>
              {/* Question card */}
              <View style={s.soundQuestionCard}>
                <Text style={s.soundQLabel}>听到方言发音：</Text>
                <View style={s.soundDialectBox}>
                  <Ionicons name="volume-high" size={22} color={BLUE} />
                  <Text style={s.soundDialectText}>「{current.dialect}」</Text>
                </View>
                <Text style={s.soundQSub}>请选出对应的物品</Text>
              </View>

              {/* Options grid */}
              <View style={s.optionsGrid}>
                {soundOptions.map((item) => {
                  const isSelected  = soundSelected === item.id;
                  const isCorrect   = soundResult && item.id === current.id;
                  const isWrong     = soundResult === "wrong" && isSelected;
                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        s.optionCard,
                        isCorrect ? s.optionCorrect : isWrong ? s.optionWrong : isSelected ? s.optionSelected : null,
                      ]}
                      onPress={() => handleSoundSelect(item.id)}
                      disabled={!!soundResult}
                    >
                      <Text style={s.optionEmoji}>{item.emoji}</Text>
                      <Text style={s.optionName}>{item.name}</Text>
                      {isCorrect && <View style={s.optionCheckWrap}><Ionicons name="checkmark-circle" size={20} color={GREEN} /></View>}
                      {isWrong   && <View style={s.optionCheckWrap}><Ionicons name="close-circle" size={20} color="#D04040" /></View>}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── REWARDS CENTER ───────────────────────────────────────────────────────
  if (screen === "rewards") {
    return (
      <View style={s.root}>
        <LinearGradient colors={["#F8F0FF", "#F5EFE6"]} style={[s.header, { paddingTop: topPad + 4 }]}>
          <Pressable style={s.backBtn} onPress={() => { haptic(); setScreen("list"); }}>
            <Ionicons name="chevron-back" size={24} color={TEXT1} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>积分中心</Text>
          </View>
          <View style={{ width: 32 }} />
        </LinearGradient>

        {/* Points display */}
        <View style={s.pointsHeader}>
          <Text style={s.pointsHeaderNum}>{points}</Text>
          <Text style={s.pointsHeaderLabel}>可用积分</Text>
        </View>

        {/* Tabs */}
        <View style={s.rewardTabs}>
          {(["physical","badges","skins"] as const).map((tab) => (
            <Pressable key={tab} style={[s.rewardTab, rewardsTab === tab && s.rewardTabActive]} onPress={() => { haptic(); setRewardsTab(tab); }}>
              <Ionicons
                name={tab === "physical" ? "gift-outline" : tab === "badges" ? "ribbon-outline" : "sparkles-outline"}
                size={16}
                color={rewardsTab === tab ? "#A060E8" : TEXT3}
              />
              <Text style={[s.rewardTabText, rewardsTab === tab && s.rewardTabTextActive]}>
                {tab === "physical" ? "实体权益" : tab === "badges" ? "成就勋章" : "伴游皮肤"}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {rewardsTab === "physical" && (
            <View style={s.rewardGrid}>
              {REWARDS.map((r) => {
                const redeemed = redeemedRewards.includes(r.id);
                const canAfford = points >= r.cost;
                return (
                  <View key={r.id} style={s.rewardItem}>
                    <Text style={s.rewardIcon}>{r.icon}</Text>
                    <Text style={s.rewardName}>{r.name}</Text>
                    <Text style={s.rewardDesc}>{r.desc}</Text>
                    <View style={s.rewardBottom}>
                      <View style={s.rewardCostRow}>
                        <Ionicons name="sparkles" size={12} color="#E09020" />
                        <Text style={s.rewardCost}>{r.cost}</Text>
                      </View>
                      <Pressable
                        style={[s.redeemBtn, redeemed ? s.redeemBtnDone : !canAfford ? s.redeemBtnDisabled : null]}
                        onPress={() => handleRedeem(r)}
                        disabled={redeemed || !canAfford}
                      >
                        <Text style={[s.redeemBtnText, (redeemed || !canAfford) && { color: TEXT3 }]}>
                          {redeemed ? "已兑换" : "兑换"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {rewardsTab === "badges" && (
            <View style={s.badgeGrid}>
              {ALL_BADGES.map((badge) => {
                const unlocked = unlockedBadges.includes(badge.id);
                return (
                  <View key={badge.id} style={[s.badgeItem, unlocked && s.badgeItemUnlocked]}>
                    {unlocked && <View style={s.badgeCheck}><Ionicons name="checkmark" size={14} color="#fff" /></View>}
                    <Text style={[s.badgeIcon, !unlocked && { opacity: 0.35 }]}>{badge.icon}</Text>
                    <Text style={[s.badgeName, unlocked ? s.badgeNameUnlocked : {}]}>{badge.name}</Text>
                    <Text style={s.badgeDesc}>{badge.desc}</Text>
                    {!unlocked && <Text style={s.badgeLock}>🔒 未解锁</Text>}
                  </View>
                );
              })}
            </View>
          )}

          {rewardsTab === "skins" && (
            <View style={s.skinGrid}>
              {SKINS.map((skin) => {
                const isUnlocked = unlockedSkins.includes(skin.id);
                const isActive   = activeSkin === skin.id;
                return (
                  <View key={skin.id} style={[s.skinItem, isActive && s.skinItemActive]}>
                    {isActive && <View style={s.skinActiveBadge}><Text style={s.skinActiveBadgeText}>使用中</Text></View>}
                    <Text style={s.skinPreview}>{skin.preview}</Text>
                    <Text style={s.skinName}>{skin.name}</Text>
                    {isUnlocked ? (
                      <Pressable style={[s.skinBtn, isActive && s.skinBtnActive]} onPress={() => { haptic(); setActiveSkin(skin.id); }}>
                        <Text style={[s.skinBtnText, isActive && { color: "#fff" }]}>{isActive ? "使用中" : "使用"}</Text>
                      </Pressable>
                    ) : (
                      <>
                        <View style={s.rewardCostRow}>
                          <Ionicons name="sparkles" size={12} color="#E09020" />
                          <Text style={s.rewardCost}>{skin.cost}</Text>
                        </View>
                        <Pressable
                          style={[s.skinBtn, { backgroundColor: points >= skin.cost ? "#A060E8" : "#F0EBE3" }]}
                          onPress={() => handleUnlockSkin(skin.id, skin.cost)}
                        >
                          <Text style={[s.skinBtnText, { color: points >= skin.cost ? "#fff" : TEXT3 }]}>解锁</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Toast */}
        {toastMsg && (
          <View style={s.toast}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={s.toastText}>{toastMsg}</Text>
          </View>
        )}
      </View>
    );
  }

  // ── ACHIEVEMENTS ─────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <LinearGradient colors={["#EEF2FF", "#F5EFE6"]} style={[s.header, { paddingTop: topPad + 4 }]}>
        <Pressable style={s.backBtn} onPress={() => { haptic(); setScreen("list"); }}>
          <Ionicons name="chevron-back" size={24} color={TEXT1} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>我的勋章墙</Text>
        </View>
        <View style={{ width: 32 }} />
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Hero trophy */}
        <LinearGradient colors={["#4A88E8","#3060C0","#2040A0"]} style={s.trophyHero}>
          <View style={s.trophyHeroDeco} />
          <View style={s.trophyHeroCenter}>
            <View style={s.trophyHeroOuter}>
              <LinearGradient colors={["#F07828","#D04010"]} style={s.trophyHeroInner}>
                <Ionicons name="trophy" size={52} color="#fff" />
              </LinearGradient>
              <View style={s.trophyHeroBadge}>
                <Text style={s.trophyHeroBadgeNum}>{unlockedBadges.length}</Text>
              </View>
            </View>
            <Text style={s.trophyHeroLabel}>最近获得</Text>
            <Text style={s.trophyHeroSub}>
              {unlockedBadges.length > 0
                ? ALL_BADGES.find(b => b.id === unlockedBadges[unlockedBadges.length - 1])?.name || "暂无"
                : "完成游戏解锁勋章"}
            </Text>
          </View>
        </LinearGradient>

        {/* Badge grid */}
        <LinearGradient colors={["#3060C0","#2040A0"]} style={s.badgeHeroGrid}>
          <View style={s.badgeHeroInner}>
            {ALL_BADGES.map((badge) => {
              const unlocked = unlockedBadges.includes(badge.id);
              return (
                <View key={badge.id} style={s.badgeHeroItem}>
                  <View style={[s.badgeHeroIconWrap, !unlocked && s.badgeHeroIconLocked]}>
                    <Text style={[s.badgeHeroIcon, !unlocked && { opacity: 0.3 }]}>{badge.icon}</Text>
                  </View>
                  <Text style={[s.badgeHeroName, !unlocked && { color: "rgba(180,200,255,0.6)" }]}>{badge.name}</Text>
                  <Text style={s.badgeHeroDesc}>{badge.desc}</Text>
                </View>
              );
            })}
          </View>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  backBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center", marginRight: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: TEXT1, textAlign: "center" },
  roundBadge: { backgroundColor: ORANGE_L, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  roundBadgeText: { fontSize: 13, fontWeight: "700", color: ORANGE },

  /* Game list */
  titleBlock: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  pageTitle: { fontSize: 28, fontWeight: "800", color: TEXT1, letterSpacing: -0.5 },
  pageSub:   { fontSize: 14, color: TEXT2, marginTop: 3 },

  pointsBanner: { borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center" },
  pointsLeft:   { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  pointsIconWrap: { width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  pointsTitle:  { fontSize: 15, fontWeight: "700", color: "#fff" },
  pointsSub:    { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  pointsRight:  { alignItems: "flex-end", marginRight: 8 },
  pointsAmtRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  pointsAmt:    { fontSize: 22, fontWeight: "800", color: "#fff" },
  pointsBadgeCount: { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  gameCard: { backgroundColor: CARD, borderRadius: 20, padding: 18, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  gameCardBg: { ...StyleSheet.absoluteFillObject },
  gameCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  gameIconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  gameTitle: { fontSize: 17, fontWeight: "700", color: TEXT1, marginBottom: 4 },
  gameSub:   { fontSize: 13, color: TEXT2, marginBottom: 14 },
  progressArea: { gap: 6 },
  progressLabelRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: 12, color: TEXT3 },
  progressVal:   { fontSize: 12, fontWeight: "600", color: TEXT1 },
  progressTrack: { height: 7, backgroundColor: "#F0EBE3", borderRadius: 4, overflow: "hidden" },
  progressFill:  { height: "100%", borderRadius: 4 },

  comingSoon: { textAlign: "center", fontSize: 13, color: TEXT3, marginVertical: 16 },

  achieveCard: { marginHorizontal: 16, backgroundColor: CARD, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  achieveLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  trophyWrap: { position: "relative" },
  trophyOuter: { width: 56, height: 56, borderRadius: 14, padding: 3, alignItems: "center", justifyContent: "center" },
  trophyInner: { width: "100%", height: "100%", borderRadius: 11, alignItems: "center", justifyContent: "center" },
  trophyBadgeCount: { position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: GOLD, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: CARD },
  trophyBadgeNum: { fontSize: 10, fontWeight: "800", color: "#fff" },
  achieveTitle: { fontSize: 15, fontWeight: "700", color: TEXT1 },
  achieveSub: { fontSize: 12, color: TEXT2, marginTop: 2 },
  achieveBtn: { borderWidth: 1.5, borderColor: ORANGE, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  achieveBtnText: { fontSize: 12, fontWeight: "700", color: ORANGE },

  /* Dialect game */
  gameHeading: { fontSize: 20, fontWeight: "800", color: TEXT1, marginBottom: 6 },
  gameSubheading: { fontSize: 13, color: TEXT2, lineHeight: 19, marginBottom: 20 },
  dialectGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  dialectCard: { width: "47%", backgroundColor: CARD, borderRadius: 18, padding: 16, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, borderWidth: 2, borderColor: "transparent" },
  dialectCardCollected: { backgroundColor: GREEN_L, borderColor: GREEN },
  dialectQuestionWrap: { width: 50, height: 50, borderRadius: 25, backgroundColor: ORANGE_L, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  dialectQuestion: { fontSize: 18, fontWeight: "800", color: ORANGE },
  dialectTap: { fontSize: 11, color: ORANGE, fontWeight: "600", marginTop: 4 },
  dialectTermCollected: { fontSize: 22, fontWeight: "800", color: GREEN, marginBottom: 3 },
  dialectRegion: { fontSize: 11, color: TEXT3, textAlign: "center", marginTop: 4 },
  dialectProgressCard: { backgroundColor: CARD, borderRadius: 16, padding: 16, gap: 10 },
  dialectProgressLabel: { fontSize: 14, fontWeight: "600", color: TEXT1 },

  /* Win modal */
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  winModal: { backgroundColor: CARD, borderRadius: 28, padding: 28, width: "85%", alignItems: "center", gap: 10 },
  winIconWrap: { marginBottom: 4 },
  winIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  winTitle: { fontSize: 22, fontWeight: "800", color: TEXT1 },
  winDesc:  { fontSize: 13, color: TEXT2, textAlign: "center", lineHeight: 20 },
  winPointsRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF8EC", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 },
  winPoints: { fontSize: 17, fontWeight: "700", color: "#E09020" },
  winBtn: { backgroundColor: ORANGE, borderRadius: 18, paddingHorizontal: 32, paddingVertical: 14, marginTop: 6 },
  winBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  /* Sound game */
  soundQuestionCard: { backgroundColor: CARD, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  soundQLabel:    { fontSize: 14, color: TEXT2, marginBottom: 10 },
  soundDialectBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EEF4FF", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginBottom: 10 },
  soundDialectText: { fontSize: 24, fontWeight: "800", color: BLUE },
  soundQSub:      { fontSize: 12, color: TEXT3 },
  optionsGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  optionCard:     { width: "47%", backgroundColor: CARD, borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 2, borderColor: BORDER, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  optionCorrect:  { backgroundColor: GREEN_L, borderColor: GREEN },
  optionWrong:    { backgroundColor: "#FFE8E8", borderColor: "#D04040" },
  optionSelected: { backgroundColor: "#EEF4FF", borderColor: BLUE },
  optionEmoji:    { fontSize: 36, marginBottom: 8 },
  optionName:     { fontSize: 14, fontWeight: "700", color: TEXT1 },
  optionCheckWrap: { position: "absolute", top: 8, right: 8 },
  soundResultCard: { overflow: "hidden", borderRadius: 24 },
  soundResultGrad: { padding: 32, alignItems: "center" },
  soundResultTitle:  { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 8 },
  soundResultScore:  { fontSize: 18, color: "rgba(255,255,255,0.9)", marginBottom: 8 },
  soundResultMsg:    { fontSize: 13, color: "rgba(255,255,255,0.8)", textAlign: "center", marginBottom: 16 },
  soundResultPointsRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14, marginBottom: 20 },
  soundResultPoints: { fontSize: 17, fontWeight: "700", color: "#fff" },
  soundRetryBtn:  { backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 28, paddingVertical: 13 },
  soundRetryText: { fontSize: 15, fontWeight: "700", color: BLUE },

  /* Rewards */
  pointsHeader: { alignItems: "center", paddingVertical: 20, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  pointsHeaderNum:   { fontSize: 36, fontWeight: "800", color: "#A060E8" },
  pointsHeaderLabel: { fontSize: 13, color: TEXT3, marginTop: 3 },
  rewardTabs: { flexDirection: "row", backgroundColor: CARD, paddingHorizontal: 16, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  rewardTab:  { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 12, flexDirection: "row", justifyContent: "center", gap: 5 },
  rewardTabActive: { backgroundColor: "#F5EEFF" },
  rewardTabText:   { fontSize: 12, fontWeight: "500", color: TEXT3 },
  rewardTabTextActive: { color: "#A060E8", fontWeight: "700" },
  rewardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  rewardItem: { width: "47%", backgroundColor: CARD, borderRadius: 16, padding: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  rewardIcon: { fontSize: 36, marginBottom: 8 },
  rewardName: { fontSize: 13, fontWeight: "700", color: TEXT1, marginBottom: 4 },
  rewardDesc: { fontSize: 11, color: TEXT2, lineHeight: 16, marginBottom: 10 },
  rewardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rewardCostRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  rewardCost:   { fontSize: 13, fontWeight: "700", color: "#E09020" },
  redeemBtn:     { backgroundColor: "#A060E8", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  redeemBtnDone: { backgroundColor: "#F0EBE3" },
  redeemBtnDisabled: { backgroundColor: "#F0EBE3" },
  redeemBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeItem: { width: "47%", backgroundColor: CARD, borderRadius: 16, padding: 14, alignItems: "flex-start", opacity: 0.65 },
  badgeItemUnlocked: { opacity: 1, borderWidth: 1.5, borderColor: "#F0A830" },
  badgeCheck: { position: "absolute", top: 10, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },
  badgeIcon: { fontSize: 36, marginBottom: 8 },
  badgeName: { fontSize: 13, fontWeight: "700", color: TEXT1, marginBottom: 3 },
  badgeNameUnlocked: { color: "#C07010" },
  badgeDesc: { fontSize: 11, color: TEXT2, lineHeight: 16 },
  badgeLock: { fontSize: 11, color: TEXT3, marginTop: 6 },
  skinGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  skinItem:  { width: "47%", backgroundColor: CARD, borderRadius: 16, padding: 14, alignItems: "center" },
  skinItemActive: { borderWidth: 2, borderColor: BLUE, backgroundColor: "#EEF4FF" },
  skinActiveBadge: { position: "absolute", top: 8, right: 8, backgroundColor: BLUE, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  skinActiveBadgeText: { fontSize: 10, color: "#fff", fontWeight: "600" },
  skinPreview: { fontSize: 40, marginBottom: 8 },
  skinName:  { fontSize: 13, fontWeight: "700", color: TEXT1, marginBottom: 8 },
  skinBtn:   { backgroundColor: "#F0EBE3", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 7, alignSelf: "stretch", alignItems: "center" },
  skinBtnActive: { backgroundColor: BLUE },
  skinBtnText: { fontSize: 12, fontWeight: "700", color: TEXT2 },

  /* Achievements */
  trophyHero: { borderRadius: 24, overflow: "hidden", marginBottom: 12 },
  trophyHeroDeco: { position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.1)" },
  trophyHeroCenter: { padding: 28, alignItems: "center" },
  trophyHeroOuter: { width: 110, height: 110, borderRadius: 22, padding: 4, alignItems: "center", justifyContent: "center", marginBottom: 16, backgroundColor: "rgba(255,255,255,0.2)" },
  trophyHeroInner: { width: "100%", height: "100%", borderRadius: 18, alignItems: "center", justifyContent: "center" },
  trophyHeroBadge: { position: "absolute", top: -6, right: -6, width: 30, height: 30, borderRadius: 15, backgroundColor: GOLD, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#3060C0" },
  trophyHeroBadgeNum: { fontSize: 12, fontWeight: "800", color: "#fff" },
  trophyHeroLabel: { fontSize: 13, color: "rgba(200,220,255,0.8)", marginBottom: 4 },
  trophyHeroSub:   { fontSize: 17, fontWeight: "700", color: "#fff" },
  badgeHeroGrid:   { borderRadius: 24, overflow: "hidden" },
  badgeHeroInner:  { padding: 20, flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "center" },
  badgeHeroItem:   { width: "28%", alignItems: "center" },
  badgeHeroIconWrap: { width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,255,255,0.95)", alignItems: "center", justifyContent: "center", marginBottom: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  badgeHeroIconLocked: { backgroundColor: "rgba(60,80,140,0.4)" },
  badgeHeroIcon:   { fontSize: 34 },
  badgeHeroName:   { fontSize: 12, fontWeight: "700", color: "#fff", textAlign: "center", marginBottom: 3 },
  badgeHeroDesc:   { fontSize: 10, color: "rgba(180,200,255,0.7)", textAlign: "center", lineHeight: 14 },

  /* Toast */
  toast: { position: "absolute", bottom: 40, alignSelf: "center", backgroundColor: GREEN, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 8 },
  toastText: { fontSize: 13, fontWeight: "600", color: "#fff" },
});
