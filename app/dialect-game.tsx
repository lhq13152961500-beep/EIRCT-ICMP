"use no memo";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Platform, Modal, Animated, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const { height: SCREEN_H } = Dimensions.get("window");

// ── Colors ───────────────────────────────────────────────────────────────────
const BG       = "#F5EFE6";
const CARD     = "#FFFFFF";
const ORANGE   = "#E07030";
const ORANGE_L = "#FFF0E8";
const TEXT1    = "#1A1A2E";
const TEXT2    = "#666880";
const TEXT3    = "#9B9BB0";
const BORDER   = "#F0EBE3";
const GREEN    = "#3A9060";
const GREEN_L  = "#E8F5EE";
const BLUE     = "#3A78E0";
const BLUE_L   = "#EEF3FF";
const GOLD     = "#F5A623";

type Screen         = "list" | "dialect" | "sound" | "rewards" | "achievements";
type ChallengeStep  = "listen" | "locate" | "record" | "success";

// ── Dialect terms (5 ways to say 「玉米」) ────────────────────────────────────
const DIALECT_TERMS = [
  {
    id: 1, term: "包谷", pinyin: "bāo gǔ", region: "西南地区",
    location: "村西头老磨坊旁边", person: "阿依古丽阿姨",
    personDesc: "身穿绿色连衣裙，旁边有一个大石磨", emoji: "🌽",
  },
  {
    id: 2, term: "棒子", pinyin: "bàng zi", region: "华北地区",
    location: "清真寺广场东侧小摊", person: "吐尔逊大叔",
    personDesc: "戴白色斗笠，正在烤玉米的摊位前", emoji: "🌽",
  },
  {
    id: 3, term: "苞米", pinyin: "bāo mǐ", region: "东北地区",
    location: "葡萄晾房旁边的晒场", person: "卡德尔·老爷爷",
    personDesc: "站在葡萄架荫凉下，穿黑色坎肩", emoji: "🌽",
  },
  {
    id: 4, term: "珍珠米", pinyin: "zhēn zhū mǐ", region: "江南地区",
    location: "古村落主街路口", person: "米日古丽阿姨",
    personDesc: "坐在百年老枣树下摆摊的阿姨", emoji: "🌽",
  },
  {
    id: 5, term: "玉蜀黍", pinyin: "yù shǔ shǔ", region: "闽南地区",
    location: "村头古井旁边", person: "买孜汗奶奶",
    personDesc: "穿花色头巾、带着小孙子打水的奶奶", emoji: "🌽",
  },
];

// ── Sound matching items (吐峪沟 specialty × 方言称呼) ─────────────────────────
const SOUND_ITEMS = [
  { id: 1, name: "葡萄干", dialect: "提孜纳普", emoji: "🍇", bg: "#F5EEFF" },
  { id: 2, name: "馕",     dialect: "恩格尔",   emoji: "🫓", bg: "#FFF5EA" },
  { id: 3, name: "蜂蜜",   dialect: "漫古尔",   emoji: "🍯", bg: "#FFF8E0" },
  { id: 4, name: "花帽",   dialect: "多帕",     emoji: "🎩", bg: "#EEFFF5" },
  { id: 5, name: "红枣",   dialect: "曾格尔",   emoji: "🍮", bg: "#FFF0F0" },
  { id: 6, name: "羊肉串", dialect: "果也提",   emoji: "🍖", bg: "#FFF4F0" },
];

// ── Badges / Rewards / Skins ──────────────────────────────────────────────────
const ALL_BADGES = [
  { id: "dialect-master", icon: "🗣️", name: "方言达人",   desc: "收集所有方言称呼" },
  { id: "sound-expert",   icon: "👂", name: "听音辨物",   desc: "完成声音寻觅游戏" },
  { id: "perfect-score",  icon: "⭐", name: "满分学霸",   desc: "获得满分成绩" },
  { id: "explorer",       icon: "🧭", name: "乡音探索者", desc: "完成两项游戏" },
];

const REWARDS = [
  { id: "grape", icon: "🍇", name: "吐峪沟葡萄干", desc: "500g纯天然晾晒葡萄干", cost: 80 },
  { id: "naan",  icon: "🫓", name: "馕饼兑换券",   desc: "兑换一个传统馕坑烤馕", cost: 50 },
  { id: "stay",  icon: "🏠", name: "民宿折扣券",   desc: "入住合作民宿立减50元", cost: 120 },
  { id: "craft", icon: "🎨", name: "土陶体验课",   desc: "参与传统土陶制作体验", cost: 150 },
  { id: "honey", icon: "🍯", name: "农家蜂蜜",     desc: "250g纯天然蜂蜜",      cost: 100 },
  { id: "photo", icon: "📸", name: "摄影服务券",   desc: "专属摄影服务一次",      cost: 180 },
];

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

  // ── Global state ─────────────────────────────────────────────────────────
  const [screen,         setScreen]         = useState<Screen>("list");
  const [points,         setPoints]         = useState(0);
  const [unlockedBadges, setUnlockedBadges] = useState<string[]>([]);
  const [redeemedRewards,setRedeemedRewards]= useState<string[]>([]);
  const [activeSkin,     setActiveSkin]     = useState("default");
  const [unlockedSkins,  setUnlockedSkins]  = useState(["default"]);
  const [rewardsTab,     setRewardsTab]     = useState<"physical"|"badges"|"skins">("physical");
  const [toastMsg,       setToastMsg]       = useState<string | null>(null);

  // ── 方言采集 state ────────────────────────────────────────────────────────
  const [collectedIds,    setCollectedIds]    = useState<number[]>([]);
  const [dialectRewarded, setDialectRewarded] = useState(false);
  const [showDialectWin,  setShowDialectWin]  = useState(false);

  // challenge modal
  const [challengeTermId, setChallengeTermId] = useState<number | null>(null);
  const [challengeStep,   setChallengeStep]   = useState<ChallengeStep>("listen");
  const [isPlaying,       setIsPlaying]       = useState(false);
  const [hasPlayed,       setHasPlayed]       = useState(false);
  const [isRecording,     setIsRecording]     = useState(false);

  // waveform bars animation
  const waveAnims = useRef([...Array(7)].map(() => new Animated.Value(0.3))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startWaveAnim = () => {
    const anims = waveAnims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 80),
          Animated.timing(a, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.2, duration: 280, useNativeDriver: true }),
        ])
      )
    );
    Animated.parallel(anims).start();
  };

  const stopWaveAnim = () => {
    waveAnims.forEach(a => { a.stopAnimation(); a.setValue(0.3); });
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => { pulseAnim.stopAnimation(); pulseAnim.setValue(1); };

  const openChallenge = (id: number) => {
    haptic();
    setChallengeTermId(id);
    setChallengeStep("listen");
    setHasPlayed(false);
    setIsPlaying(false);
    setIsRecording(false);
  };

  const closeChallenge = () => {
    stopWaveAnim(); stopPulse();
    setChallengeTermId(null);
    setChallengeStep("listen");
    setHasPlayed(false);
    setIsPlaying(false);
    setIsRecording(false);
  };

  const handlePlay = () => {
    if (isPlaying) return;
    haptic();
    setIsPlaying(true);
    startWaveAnim();
    setTimeout(() => {
      stopWaveAnim();
      setIsPlaying(false);
      setHasPlayed(true);
    }, 2500);
  };

  const handleRecord = () => {
    if (isRecording) return;
    haptic();
    setIsRecording(true);
    startPulse();
    setTimeout(() => {
      stopPulse();
      setIsRecording(false);
      setChallengeStep("success");
    }, 2000);
  };

  useEffect(() => {
    if (collectedIds.length === DIALECT_TERMS.length && !dialectRewarded) {
      setDialectRewarded(true);
      setPoints(p => p + 100);
      const nb = [...unlockedBadges];
      if (!nb.includes("dialect-master")) nb.push("dialect-master");
      if (!nb.includes("perfect-score"))  nb.push("perfect-score");
      if (nb.filter(b => ["dialect-master","sound-expert"].includes(b)).length === 2)
        if (!nb.includes("explorer")) nb.push("explorer");
      setUnlockedBadges(nb);
      setTimeout(() => setShowDialectWin(true), 400);
    }
  }, [collectedIds]);

  // ── 声音寻觅 state ────────────────────────────────────────────────────────
  const [soundRound,    setSoundRound]    = useState(0);
  const [soundScore,    setSoundScore]    = useState(0);
  const [soundResult,   setSoundResult]   = useState<"correct"|"wrong"|null>(null);
  const [soundSelected, setSoundSelected] = useState<number | null>(null);
  const [soundDone,     setSoundDone]     = useState(false);
  const [soundOptions,  setSoundOptions]  = useState<typeof SOUND_ITEMS>([]);
  const [soundRewarded, setSoundRewarded] = useState(false);
  const [soundPlayed,   setSoundPlayed]   = useState(false);
  const [soundPlaying,  setSoundPlaying]  = useState(false);

  // sound waveform
  const sWaveAnims = useRef([...Array(5)].map(() => new Animated.Value(0.3))).current;

  const startSoundWave = () => {
    const anims = sWaveAnims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 100),
          Animated.timing(a, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.2, duration: 300, useNativeDriver: true }),
        ])
      )
    );
    Animated.parallel(anims).start();
  };

  const stopSoundWave = () => { sWaveAnims.forEach(a => { a.stopAnimation(); a.setValue(0.3); }); };

  const shuffleOptions = useCallback((correctId: number) => {
    const pool = [...SOUND_ITEMS].sort(() => Math.random() - 0.5);
    const opts: typeof SOUND_ITEMS = [];
    if (!pool.slice(0, 4).find(i => i.id === correctId))
      pool[0] = SOUND_ITEMS.find(i => i.id === correctId)!;
    const seen = new Set<number>();
    for (const item of pool) {
      if (!seen.has(item.id)) { seen.add(item.id); opts.push(item); }
      if (opts.length === 4) break;
    }
    setSoundOptions(opts);
  }, []);

  useEffect(() => {
    if (screen === "sound") {
      shuffleOptions(SOUND_ITEMS[soundRound].id);
      setSoundPlayed(false);
      setSoundPlaying(false);
    }
  }, [screen, soundRound]);

  useEffect(() => {
    if (soundDone && !soundRewarded) {
      setSoundRewarded(true);
      setPoints(p => p + soundScore * 10);
      const nb = [...unlockedBadges];
      if (!nb.includes("sound-expert")) nb.push("sound-expert");
      if (dialectRewarded && !nb.includes("explorer")) nb.push("explorer");
      setUnlockedBadges(nb);
    }
  }, [soundDone]);

  const handleSoundPlay = () => {
    if (soundPlaying || soundPlayed) return;
    haptic();
    setSoundPlaying(true);
    startSoundWave();
    setTimeout(() => {
      stopSoundWave();
      setSoundPlaying(false);
      setSoundPlayed(true);
    }, 2200);
  };

  const handleSoundSelect = (id: number) => {
    if (soundResult || !soundPlayed) return;
    haptic();
    setSoundSelected(id);
    const correct = id === SOUND_ITEMS[soundRound].id;
    setSoundResult(correct ? "correct" : "wrong");
    if (correct) setSoundScore(s => s + 1);
    setTimeout(() => {
      setSoundSelected(null);
      setSoundResult(null);
      setSoundPlayed(false);
      setSoundPlaying(false);
      if (soundRound < SOUND_ITEMS.length - 1) {
        setSoundRound(r => r + 1);
      } else {
        setSoundDone(true);
      }
    }, 1400);
  };

  // ── Rewards ───────────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  const handleRedeem = (r: typeof REWARDS[0]) => {
    if (redeemedRewards.includes(r.id)) return;
    if (points < r.cost) { showToast("积分不足"); return; }
    setPoints(p => p - r.cost);
    setRedeemedRewards(prev => [...prev, r.id]);
    showToast(`兑换成功：${r.name}`);
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

  const dialectProgress = collectedIds.length;
  const soundProgress   = Math.min(soundRound, SOUND_ITEMS.length);

  // ── Header ────────────────────────────────────────────────────────────────
  const Header = ({ title, right, gradColors, onBack }: { title: string; right?: React.ReactNode; gradColors: string[]; onBack: () => void }) => (
    <LinearGradient colors={gradColors as any} style={[s.header, { paddingTop: topPad + 4 }]}>
      <Pressable style={s.backBtn} onPress={() => { haptic(); onBack(); }}>
        <Ionicons name="chevron-back" size={24} color={TEXT1} />
      </Pressable>
      <Text style={s.headerTitle}>{title}</Text>
      {right ?? <View style={{ width: 40 }} />}
    </LinearGradient>
  );

  // ════════════════════════════════════════════════════════════════════════════
  //  GAME LIST
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "list") {
    return (
      <View style={s.root}>
        <Header title="乡音趣采" gradColors={["#FFF4EC","#F5EFE6"]} onBack={() => router.back()} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.titleBlock}>
            <Text style={s.pageTitle}>乡音趣采</Text>
            <Text style={s.pageSub}>探索本地方言，感受吐峪沟文化魅力</Text>
          </View>

          {/* Points banner */}
          <Pressable onPress={() => { haptic(); setScreen("rewards"); }} style={{ marginHorizontal:16, marginBottom:16 }}>
            <LinearGradient colors={["#A060E8","#E03080"]} style={s.pointsBanner}>
              <View style={s.pointsLeft}>
                <View style={s.pointsIconWrap}><Ionicons name="gift-outline" size={24} color="#fff" /></View>
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
          <View style={{ paddingHorizontal:16, gap:12 }}>
            <Pressable style={s.gameCard} onPress={() => { haptic(); setScreen("dialect"); }}>
              <View style={s.gameCardTop}>
                <LinearGradient colors={["#F07040","#D04040"]} style={s.gameIconWrap}>
                  <Ionicons name="mic-outline" size={22} color="#fff" />
                </LinearGradient>
                <Ionicons name="chevron-forward" size={18} color={TEXT3} />
              </View>
              <Text style={s.gameTitle}>方言采集</Text>
              <Text style={s.gameSub}>听方言 → 找村民 → 录音匹配，收集「玉米」5种地方称呼</Text>
              <View style={s.progressArea}>
                <View style={s.progressLabelRow}>
                  <Text style={s.progressLabel}>进度</Text>
                  <Text style={s.progressVal}>{dialectProgress}/5</Text>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width:`${(dialectProgress/5)*100}%`, backgroundColor:"#E07040" }]} />
                </View>
              </View>
            </Pressable>

            <Pressable style={s.gameCard} onPress={() => { haptic(); setScreen("sound"); }}>
              <View style={s.gameCardTop}>
                <LinearGradient colors={["#3A78E0","#28BCDC"]} style={s.gameIconWrap}>
                  <Ionicons name="volume-high-outline" size={22} color="#fff" />
                </LinearGradient>
                <Ionicons name="chevron-forward" size={18} color={TEXT3} />
              </View>
              <Text style={s.gameTitle}>声音寻觅</Text>
              <Text style={s.gameSub}>听方言发音 → 在4张图片中找出对应的本地特产</Text>
              <View style={s.progressArea}>
                <View style={s.progressLabelRow}>
                  <Text style={s.progressLabel}>进度</Text>
                  <Text style={s.progressVal}>{soundProgress}/{SOUND_ITEMS.length}</Text>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width:`${(soundProgress/SOUND_ITEMS.length)*100}%`, backgroundColor:BLUE }]} />
                </View>
              </View>
            </Pressable>
          </View>

          <Text style={s.comingSoon}>更多游戏即将上架....</Text>

          <Pressable style={s.achieveCard} onPress={() => { haptic(); setScreen("achievements"); }}>
            <View style={s.achieveLeft}>
              <View style={s.trophyWrap}>
                <LinearGradient colors={["#4A88E8","#3060C0"]} style={s.trophyOuter}>
                  <LinearGradient colors={["#F07828","#D04010"]} style={s.trophyInner}>
                    <Ionicons name="trophy" size={28} color="#fff" />
                  </LinearGradient>
                </LinearGradient>
                {unlockedBadges.length > 0 && (
                  <View style={s.trophyBadgeCount}><Text style={s.trophyBadgeNum}>{unlockedBadges.length}</Text></View>
                )}
              </View>
              <View>
                <Text style={s.achieveTitle}>已获得 {unlockedBadges.length} 枚勋章</Text>
                <Text style={s.achieveSub}>解锁更多游戏，收获专属成就</Text>
              </View>
            </View>
            <View style={s.achieveBtn}><Text style={s.achieveBtnText}>全部成就</Text></View>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  方言采集
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "dialect") {
    const activeTerm = DIALECT_TERMS.find(t => t.id === challengeTermId);
    return (
      <View style={s.root}>
        <Header
          title="方言采集"
          gradColors={["#FFF4EC","#F5EFE6"]}
          onBack={() => setScreen("list")}
          right={
            <View style={s.roundBadge}>
              <Text style={s.roundBadgeText}>{collectedIds.length}/5</Text>
            </View>
          }
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16, paddingBottom:40 }}>
          {/* Task description card */}
          <LinearGradient colors={["#FFF4EC","#FFE8D8"]} style={s.taskCard}>
            <View style={s.taskCardRow}>
              <Ionicons name="information-circle-outline" size={20} color={ORANGE} />
              <Text style={s.taskCardTitle}>任务说明</Text>
            </View>
            <View style={s.taskSteps}>
              {[
                { icon:"volume-high-outline", color:BLUE,  text:"播放方言，聆听当地人说「玉米」" },
                { icon:"location-outline",    color:ORANGE, text:"根据提示前往对应位置找到村民" },
                { icon:"mic-outline",         color:GREEN,  text:"跟着学说，录音匹配方言发音" },
              ].map((step, i) => (
                <View key={i} style={s.taskStep}>
                  <View style={[s.taskStepDot, { backgroundColor: step.color + "20" }]}>
                    <Ionicons name={step.icon as any} size={14} color={step.color} />
                  </View>
                  <Text style={s.taskStepText}>{step.text}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {/* Progress bar */}
          <View style={s.dialectProgressCard}>
            <Text style={s.dialectProgressLabel}>已采集 {collectedIds.length} / 5 种称呼</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width:`${(collectedIds.length/5)*100}%`, backgroundColor:ORANGE }]} />
            </View>
          </View>

          {/* Term cards */}
          <View style={{ gap: 12 }}>
            {DIALECT_TERMS.map(term => {
              const collected = collectedIds.includes(term.id);
              return (
                <Pressable
                  key={term.id}
                  style={[s.termCard, collected && s.termCardDone]}
                  onPress={() => { if (!collected) openChallenge(term.id); }}
                >
                  <View style={s.termCardLeft}>
                    {collected ? (
                      <View style={s.termCollectedIcon}>
                        <Ionicons name="checkmark" size={22} color="#fff" />
                      </View>
                    ) : (
                      <View style={s.termUncollectedIcon}>
                        <Text style={s.termEmoji}>{term.emoji}</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.termCardMid}>
                    {collected ? (
                      <>
                        <Text style={s.termWordCollected}>{term.term}</Text>
                        <Text style={s.termPinyin}>{term.pinyin}</Text>
                      </>
                    ) : (
                      <Text style={s.termWordHidden}>???</Text>
                    )}
                    <View style={s.termLocationRow}>
                      <Ionicons name="location-outline" size={12} color={TEXT3} />
                      <Text style={s.termLocationText}>{term.location}</Text>
                    </View>
                    <View style={s.termRegionTag}>
                      <Text style={s.termRegionText}>{term.region}</Text>
                    </View>
                  </View>
                  <View style={s.termCardRight}>
                    {collected ? (
                      <View style={s.termDoneTag}>
                        <Text style={s.termDoneTagText}>+20积分</Text>
                      </View>
                    ) : (
                      <View style={s.termGoBtn}>
                        <Text style={s.termGoBtnText}>前往采集</Text>
                        <Ionicons name="chevron-forward" size={12} color={ORANGE} />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* ── Challenge Modal ────────────────────────────────────────────── */}
        <Modal visible={challengeTermId !== null} transparent animationType="slide">
          <View style={s.challengeOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeChallenge} />
            <View style={s.challengeSheet}>
              {/* Handle */}
              <View style={s.challengeHandle} />

              {/* Step indicator */}
              <View style={s.stepIndicatorRow}>
                {(["listen","locate","record","success"] as ChallengeStep[]).map((step, i) => (
                  <React.Fragment key={step}>
                    <View style={[s.stepDot, challengeStep === step && s.stepDotActive,
                      (["listen","locate","record","success"].indexOf(challengeStep) > i) && s.stepDotDone]}>
                      {["listen","locate","record","success"].indexOf(challengeStep) > i
                        ? <Ionicons name="checkmark" size={12} color="#fff" />
                        : <Text style={[s.stepDotNum, challengeStep===step && {color:"#fff"}]}>{i+1}</Text>}
                    </View>
                    {i < 3 && <View style={[s.stepLine, (["listen","locate","record","success"].indexOf(challengeStep) > i) && s.stepLineDone]} />}
                  </React.Fragment>
                ))}
              </View>
              <View style={s.stepLabels}>
                {["听声音","找位置","录音","完成"].map((lbl, i) => (
                  <Text key={i} style={[s.stepLabel, i===["listen","locate","record","success"].indexOf(challengeStep) && s.stepLabelActive]}>
                    {lbl}
                  </Text>
                ))}
              </View>

              {activeTerm && (
                <>
                  {/* ─── Step 1: 听声音 ──────────────────────────── */}
                  {challengeStep === "listen" && (
                    <View style={s.challengeContent}>
                      <Text style={s.challengeHeading}>聆听方言发音</Text>
                      <Text style={s.challengeSubtext}>点击播放，听当地人说「玉米」的方式</Text>

                      {/* Waveform + play */}
                      <Pressable style={s.playerCard} onPress={handlePlay}>
                        <LinearGradient colors={["#EEF6FF","#DDEEFF"]} style={s.playerGrad}>
                          <View style={s.waveformRow}>
                            {waveAnims.map((anim, i) => (
                              <Animated.View key={i} style={[s.waveBar, {
                                height: 28 + i % 3 * 8,
                                backgroundColor: isPlaying ? BLUE : "#B0C8F0",
                                transform: [{ scaleY: anim }],
                              }]} />
                            ))}
                          </View>
                          <View style={[s.playBtn, isPlaying && { backgroundColor: BLUE }]}>
                            <Ionicons name={isPlaying ? "pause" : "play"} size={24} color={isPlaying ? "#fff" : BLUE} />
                          </View>
                          <Text style={s.playerHint}>
                            {isPlaying ? "正在播放方言..." : hasPlayed ? "再次播放" : "点击播放方言"}
                          </Text>
                        </LinearGradient>
                      </Pressable>

                      <View style={s.regionInfoRow}>
                        <Ionicons name="earth-outline" size={14} color={TEXT2} />
                        <Text style={s.regionInfoText}>{activeTerm.region}方言称呼</Text>
                      </View>

                      <Pressable
                        style={[s.challengeNextBtn, !hasPlayed && s.challengeNextBtnDisabled]}
                        onPress={() => { if (hasPlayed) { haptic(); setChallengeStep("locate"); } }}
                      >
                        <Text style={[s.challengeNextBtnText, !hasPlayed && { color: TEXT3 }]}>
                          {hasPlayed ? "下一步：前往位置" : "请先播放声音"}
                        </Text>
                        {hasPlayed && <Ionicons name="arrow-forward" size={16} color="#fff" />}
                      </Pressable>
                    </View>
                  )}

                  {/* ─── Step 2: 找位置 ──────────────────────────── */}
                  {challengeStep === "locate" && (
                    <View style={s.challengeContent}>
                      <Text style={s.challengeHeading}>前往指定位置</Text>
                      <Text style={s.challengeSubtext}>根据提示找到这位村民，向他学习方言</Text>

                      <View style={s.locationCard}>
                        <View style={s.locationCardTop}>
                          <Ionicons name="location" size={20} color={ORANGE} />
                          <Text style={s.locationCardTitle}>目标位置</Text>
                        </View>
                        <Text style={s.locationAddr}>{activeTerm.location}</Text>
                        <View style={s.locationDivider} />
                        <View style={s.locationCardTop}>
                          <Ionicons name="person-circle-outline" size={20} color={BLUE} />
                          <Text style={s.locationCardTitle}>寻找村民</Text>
                        </View>
                        <Text style={s.locationPerson}>{activeTerm.person}</Text>
                        <Text style={s.locationHint}>{activeTerm.personDesc}</Text>
                      </View>

                      <Pressable style={s.challengeNextBtn} onPress={() => { haptic(); setChallengeStep("record"); }}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                        <Text style={s.challengeNextBtnText}>我已到达位置</Text>
                      </Pressable>
                      <Pressable onPress={() => setChallengeStep("listen")} style={s.backStepBtn}>
                        <Text style={s.backStepBtnText}>← 返回听声音</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* ─── Step 3: 录音 ────────────────────────────── */}
                  {challengeStep === "record" && (
                    <View style={s.challengeContent}>
                      <Text style={s.challengeHeading}>开始录音匹配</Text>
                      <Text style={s.challengeSubtext}>跟着村民学说，录下你的发音进行匹配</Text>

                      <View style={s.recordHintCard}>
                        <Ionicons name="volume-medium-outline" size={16} color={TEXT2} />
                        <Text style={s.recordHintText}>
                          模仿 {activeTerm.person} 的发音方式，说出「玉米」的方言称呼
                        </Text>
                      </View>

                      <Pressable style={s.micArea} onPress={handleRecord}>
                        <Animated.View style={[s.micOuter, { transform: [{ scale: pulseAnim }] }]}>
                          <LinearGradient
                            colors={isRecording ? ["#D04010","#A03008"] : ["#E07040","#D04010"]}
                            style={s.micInner}
                          >
                            <Ionicons name={isRecording ? "square" : "mic"} size={38} color="#fff" />
                          </LinearGradient>
                        </Animated.View>
                        <Text style={s.micLabel}>{isRecording ? "录音中... 请继续说" : "点击开始录音"}</Text>
                        {isRecording && (
                          <View style={s.recordingDots}>
                            {[0,1,2].map(i => (
                              <View key={i} style={[s.recordingDot, { opacity: 0.4 + i * 0.2 }]} />
                            ))}
                          </View>
                        )}
                      </Pressable>
                    </View>
                  )}

                  {/* ─── Step 4: 成功 ────────────────────────────── */}
                  {challengeStep === "success" && (
                    <View style={s.challengeContent}>
                      <LinearGradient colors={["#F0FFF4","#E8F5EE"]} style={s.successCard}>
                        <View style={s.successIconWrap}>
                          <LinearGradient colors={["#3A9060","#2A7040"]} style={s.successIcon}>
                            <Ionicons name="checkmark" size={36} color="#fff" />
                          </LinearGradient>
                        </View>
                        <Text style={s.successTitle}>采集成功！</Text>
                        <Text style={s.successRegion}>{activeTerm.region}的称呼</Text>
                        <View style={s.successTermBox}>
                          <Text style={s.successTerm}>{activeTerm.term}</Text>
                          <Text style={s.successPinyin}>{activeTerm.pinyin}</Text>
                        </View>
                        <View style={s.successPointsRow}>
                          <Ionicons name="sparkles" size={16} color={GOLD} />
                          <Text style={s.successPoints}>+20 乡音积分</Text>
                        </View>
                      </LinearGradient>

                      <Pressable
                        style={s.challengeNextBtn}
                        onPress={() => {
                          haptic();
                          if (!collectedIds.includes(activeTerm.id)) {
                            setCollectedIds(prev => [...prev, activeTerm.id]);
                            setPoints(p => p + 20);
                          }
                          closeChallenge();
                        }}
                      >
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                        <Text style={s.challengeNextBtnText}>继续采集下一个</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Win modal */}
        <Modal visible={showDialectWin} transparent animationType="fade">
          <View style={s.modalBackdrop}>
            <View style={s.winModal}>
              <LinearGradient colors={["#F0A828","#E06018"]} style={s.winIcon}>
                <Ionicons name="sparkles" size={36} color="#fff" />
              </LinearGradient>
              <Text style={s.winTitle}>恭喜全部采集完成！</Text>
              <Text style={s.winDesc}>你已收集到「玉米」的5种方言称呼！</Text>
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

  // ════════════════════════════════════════════════════════════════════════════
  //  声音寻觅
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "sound") {
    const current = SOUND_ITEMS[Math.min(soundRound, SOUND_ITEMS.length - 1)];
    return (
      <View style={s.root}>
        <Header
          title="声音寻觅"
          gradColors={["#EEF4FF","#F5EFE6"]}
          onBack={() => setScreen("list")}
          right={
            <View style={[s.roundBadge, { backgroundColor: BLUE_L }]}>
              <Text style={[s.roundBadgeText, { color: BLUE }]}>{soundScore}/{SOUND_ITEMS.length}</Text>
            </View>
          }
        />

        {soundDone ? (
          /* ── Result ── */
          <ScrollView contentContainerStyle={{ padding:20, paddingBottom:48 }}>
            <View style={s.soundResultCard}>
              <LinearGradient colors={["#3A78E0","#28BCDC"]} style={s.soundResultGrad}>
                <Ionicons name="trophy" size={52} color="#fff" style={{ marginBottom:12 }} />
                <Text style={s.soundResultTitle}>游戏完成！</Text>
                <Text style={s.soundResultScore}>得分：{soundScore} / {SOUND_ITEMS.length}</Text>
                <Text style={s.soundResultMsg}>
                  {soundScore === SOUND_ITEMS.length ? "完美！你对方言了如指掌！"
                    : soundScore >= 4 ? "非常棒！再接再厉！"
                    : "不错的尝试，多听多练！"}
                </Text>
                <View style={s.soundResultPointsRow}>
                  <Ionicons name="sparkles" size={18} color="#fff" />
                  <Text style={s.soundResultPoints}>+{soundScore * 10} 乡音积分</Text>
                </View>
                <Pressable style={s.soundRetryBtn} onPress={() => {
                  haptic();
                  setSoundRound(0); setSoundScore(0); setSoundDone(false);
                  setSoundRewarded(false); setSoundResult(null); setSoundSelected(null);
                  setSoundPlayed(false); setSoundPlaying(false);
                  setScreen("list");
                }}>
                  <Text style={s.soundRetryText}>返回首页</Text>
                </Pressable>
              </LinearGradient>
            </View>
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom:40 }}>
            {/* Progress */}
            <View style={s.soundProgressArea}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width:`${(soundRound/SOUND_ITEMS.length)*100}%`, backgroundColor:BLUE }]} />
              </View>
              <Text style={s.soundRoundText}>第 {soundRound+1} / {SOUND_ITEMS.length} 题</Text>
            </View>

            {/* Audio player card */}
            <View style={s.soundPlayerCard}>
              <View style={s.soundPlayerTop}>
                <View style={s.soundPlayerLabel}>
                  <Ionicons name="musical-notes-outline" size={16} color={BLUE} />
                  <Text style={s.soundPlayerLabelText}>方言发音</Text>
                </View>
                <View style={s.soundDialectReveal}>
                  {soundPlayed
                    ? <Text style={s.soundDialectWord}>「{current.dialect}」</Text>
                    : <Text style={s.soundDialectHidden}>点击播放后显示</Text>}
                </View>
              </View>

              {/* Waveform + play button */}
              <Pressable style={s.soundPlayArea} onPress={handleSoundPlay}>
                <View style={s.sWaveRow}>
                  {sWaveAnims.map((anim, i) => (
                    <Animated.View key={i} style={[s.sWaveBar, {
                      height: 20 + (i % 3) * 10,
                      backgroundColor: soundPlaying ? BLUE : soundPlayed ? "#88B0F0" : "#C8D8F0",
                      transform: [{ scaleY: anim }],
                    }]} />
                  ))}
                </View>
                <View style={[s.soundPlayBtn, soundPlayed && { backgroundColor:"#E8F0FF" }]}>
                  <Ionicons
                    name={soundPlaying ? "pause-circle" : soundPlayed ? "refresh-circle" : "play-circle"}
                    size={48}
                    color={soundPlaying ? BLUE : soundPlayed ? "#8898BB" : BLUE}
                  />
                </View>
                <Text style={s.soundPlayHint}>
                  {soundPlaying ? "正在播放..." : soundPlayed ? "再次播放" : "▶ 点击播放方言声音"}
                </Text>
              </Pressable>

              {!soundPlayed && (
                <View style={s.soundPlayPrompt}>
                  <Ionicons name="information-circle-outline" size={14} color={BLUE} />
                  <Text style={s.soundPlayPromptText}>请先播放方言声音，再选择对应图片</Text>
                </View>
              )}
            </View>

            {/* Options grid */}
            <Text style={s.optionsTitle}>选出方言对应的本地特产</Text>
            <View style={s.optionsGrid}>
              {soundOptions.map(item => {
                const isSelected = soundSelected === item.id;
                const isCorrect  = !!soundResult && item.id === current.id;
                const isWrong    = soundResult === "wrong" && isSelected;
                return (
                  <Pressable
                    key={item.id}
                    style={[
                      s.optionCard,
                      { backgroundColor: item.bg },
                      isCorrect && s.optionCorrect,
                      isWrong   && s.optionWrong,
                      !soundPlayed && s.optionDisabled,
                    ]}
                    onPress={() => handleSoundSelect(item.id)}
                    disabled={!!soundResult || !soundPlayed}
                  >
                    <Text style={s.optionEmoji}>{item.emoji}</Text>
                    <Text style={s.optionName}>{item.name}</Text>
                    {isCorrect && (
                      <View style={s.optionFeedback}>
                        <Ionicons name="checkmark-circle" size={22} color={GREEN} />
                      </View>
                    )}
                    {isWrong && (
                      <View style={s.optionFeedback}>
                        <Ionicons name="close-circle" size={22} color="#D04040" />
                      </View>
                    )}
                    {!soundPlayed && <View style={s.optionLock}><Ionicons name="lock-closed" size={16} color={TEXT3} /></View>}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  积分中心
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "rewards") {
    return (
      <View style={s.root}>
        <Header title="积分中心" gradColors={["#F8F0FF","#F5EFE6"]} onBack={() => setScreen("list")} />
        <View style={s.pointsHeader}>
          <Text style={s.pointsHeaderNum}>{points}</Text>
          <Text style={s.pointsHeaderLabel}>可用积分</Text>
        </View>
        <View style={s.rewardTabs}>
          {(["physical","badges","skins"] as const).map(tab => (
            <Pressable key={tab} style={[s.rewardTab, rewardsTab===tab && s.rewardTabActive]} onPress={() => { haptic(); setRewardsTab(tab); }}>
              <Ionicons name={tab==="physical"?"gift-outline":tab==="badges"?"ribbon-outline":"sparkles-outline"} size={16} color={rewardsTab===tab?"#A060E8":TEXT3} />
              <Text style={[s.rewardTabText, rewardsTab===tab && s.rewardTabTextActive]}>
                {tab==="physical"?"实体权益":tab==="badges"?"成就勋章":"伴游皮肤"}
              </Text>
            </Pressable>
          ))}
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16, paddingBottom:40 }}>
          {rewardsTab === "physical" && (
            <View style={s.rewardGrid}>
              {REWARDS.map(r => {
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
                      <Pressable style={[s.redeemBtn, redeemed?s.redeemBtnDone:!canAfford?s.redeemBtnDisabled:null]}
                        onPress={() => handleRedeem(r)} disabled={redeemed||!canAfford}>
                        <Text style={[s.redeemBtnText,(redeemed||!canAfford)&&{color:TEXT3}]}>{redeemed?"已兑换":"兑换"}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {rewardsTab === "badges" && (
            <View style={s.badgeGrid}>
              {ALL_BADGES.map(badge => {
                const unlocked = unlockedBadges.includes(badge.id);
                return (
                  <View key={badge.id} style={[s.badgeItem, unlocked && s.badgeItemUnlocked]}>
                    {unlocked && <View style={s.badgeCheck}><Ionicons name="checkmark" size={14} color="#fff" /></View>}
                    <Text style={[s.badgeIcon, !unlocked && {opacity:0.35}]}>{badge.icon}</Text>
                    <Text style={[s.badgeName, unlocked?s.badgeNameUnlocked:{}]}>{badge.name}</Text>
                    <Text style={s.badgeDesc}>{badge.desc}</Text>
                    {!unlocked && <Text style={s.badgeLock}>🔒 未解锁</Text>}
                  </View>
                );
              })}
            </View>
          )}
          {rewardsTab === "skins" && (
            <View style={s.skinGrid}>
              {SKINS.map(skin => {
                const isUnlocked = unlockedSkins.includes(skin.id);
                const isActive = activeSkin === skin.id;
                return (
                  <View key={skin.id} style={[s.skinItem, isActive && s.skinItemActive]}>
                    {isActive && <View style={s.skinActiveBadge}><Text style={s.skinActiveBadgeText}>使用中</Text></View>}
                    <Text style={s.skinPreview}>{skin.preview}</Text>
                    <Text style={s.skinName}>{skin.name}</Text>
                    {isUnlocked ? (
                      <Pressable style={[s.skinBtn, isActive && s.skinBtnActive]} onPress={() => { haptic(); setActiveSkin(skin.id); }}>
                        <Text style={[s.skinBtnText, isActive && {color:"#fff"}]}>{isActive?"使用中":"使用"}</Text>
                      </Pressable>
                    ) : (
                      <>
                        <View style={s.rewardCostRow}>
                          <Ionicons name="sparkles" size={12} color="#E09020" />
                          <Text style={s.rewardCost}>{skin.cost}</Text>
                        </View>
                        <Pressable style={[s.skinBtn,{backgroundColor:points>=skin.cost?"#A060E8":"#F0EBE3"}]}
                          onPress={() => handleUnlockSkin(skin.id, skin.cost)}>
                          <Text style={[s.skinBtnText,{color:points>=skin.cost?"#fff":TEXT3}]}>解锁</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
        {toastMsg && (
          <View style={s.toast}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={s.toastText}>{toastMsg}</Text>
          </View>
        )}
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  成就墙
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <View style={s.root}>
      <Header title="我的勋章墙" gradColors={["#EEF2FF","#F5EFE6"]} onBack={() => setScreen("list")} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:16, paddingBottom:40 }}>
        <LinearGradient colors={["#4A88E8","#3060C0","#2040A0"]} style={s.trophyHero}>
          <View style={s.trophyHeroCenter}>
            <View style={s.trophyHeroOuter}>
              <LinearGradient colors={["#F07828","#D04010"]} style={s.trophyHeroInner}>
                <Ionicons name="trophy" size={52} color="#fff" />
              </LinearGradient>
              <View style={s.trophyHeroBadge}><Text style={s.trophyHeroBadgeNum}>{unlockedBadges.length}</Text></View>
            </View>
            <Text style={s.trophyHeroLabel}>最近获得</Text>
            <Text style={s.trophyHeroSub}>
              {unlockedBadges.length > 0
                ? ALL_BADGES.find(b => b.id === unlockedBadges[unlockedBadges.length-1])?.name || "暂无"
                : "完成游戏解锁勋章"}
            </Text>
          </View>
        </LinearGradient>
        <LinearGradient colors={["#3060C0","#2040A0"]} style={s.badgeHeroGrid}>
          <View style={s.badgeHeroInner}>
            {ALL_BADGES.map(badge => {
              const unlocked = unlockedBadges.includes(badge.id);
              return (
                <View key={badge.id} style={s.badgeHeroItem}>
                  <View style={[s.badgeHeroIconWrap, !unlocked && s.badgeHeroIconLocked]}>
                    <Text style={[s.badgeHeroIcon, !unlocked && {opacity:0.3}]}>{badge.icon}</Text>
                  </View>
                  <Text style={[s.badgeHeroName, !unlocked && {color:"rgba(180,200,255,0.6)"}]}>{badge.name}</Text>
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

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex:1, backgroundColor:BG },

  header:      { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingBottom:12, borderBottomWidth:1, borderBottomColor:BORDER },
  backBtn:     { width:32, height:32, justifyContent:"center", alignItems:"center", marginRight:4 },
  headerTitle: { flex:1, fontSize:17, fontWeight:"700", color:TEXT1, textAlign:"center" },
  roundBadge:      { backgroundColor:ORANGE_L, borderRadius:12, paddingHorizontal:10, paddingVertical:3 },
  roundBadgeText:  { fontSize:13, fontWeight:"700", color:ORANGE },

  /* List screen */
  titleBlock: { paddingHorizontal:16, paddingTop:20, paddingBottom:8 },
  pageTitle:  { fontSize:28, fontWeight:"800", color:TEXT1, letterSpacing:-0.5 },
  pageSub:    { fontSize:14, color:TEXT2, marginTop:3 },

  pointsBanner:    { flexDirection:"row", alignItems:"center", borderRadius:20, padding:16, gap:12 },
  pointsLeft:      { flex:1, flexDirection:"row", alignItems:"center", gap:12 },
  pointsIconWrap:  { width:42, height:42, borderRadius:21, backgroundColor:"rgba(255,255,255,0.2)", alignItems:"center", justifyContent:"center" },
  pointsTitle:     { fontSize:16, fontWeight:"800", color:"#fff" },
  pointsSub:       { fontSize:12, color:"rgba(255,255,255,0.75)", marginTop:2 },
  pointsRight:     { alignItems:"flex-end" },
  pointsAmtRow:    { flexDirection:"row", alignItems:"center", gap:4 },
  pointsAmt:       { fontSize:22, fontWeight:"800", color:"#fff" },
  pointsBadgeCount:{ fontSize:11, color:"rgba(255,255,255,0.7)", marginTop:2 },

  gameCard:    { backgroundColor:CARD, borderRadius:20, padding:18, shadowColor:"#000", shadowOpacity:0.06, shadowRadius:10, shadowOffset:{width:0,height:2}, elevation:2 },
  gameCardTop: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:12 },
  gameIconWrap:{ width:44, height:44, borderRadius:14, alignItems:"center", justifyContent:"center" },
  gameTitle:   { fontSize:18, fontWeight:"800", color:TEXT1, marginBottom:4 },
  gameSub:     { fontSize:13, color:TEXT2, lineHeight:18, marginBottom:14 },
  progressArea:{ gap:6 },
  progressLabelRow:{ flexDirection:"row", justifyContent:"space-between" },
  progressLabel:   { fontSize:12, color:TEXT3 },
  progressVal:     { fontSize:12, fontWeight:"700", color:TEXT1 },
  progressTrack:   { height:6, backgroundColor:"#F0EBE3", borderRadius:3, overflow:"hidden" },
  progressFill:    { height:"100%", borderRadius:3 },

  comingSoon:  { textAlign:"center", color:TEXT3, fontSize:13, marginVertical:18 },

  achieveCard: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", backgroundColor:CARD, marginHorizontal:16, marginBottom:16, borderRadius:20, padding:16, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:8, elevation:1 },
  achieveLeft: { flexDirection:"row", alignItems:"center", gap:12 },
  trophyWrap:  { position:"relative" },
  trophyOuter:{ width:50, height:50, borderRadius:25, alignItems:"center", justifyContent:"center", padding:3 },
  trophyInner:{ width:44, height:44, borderRadius:22, alignItems:"center", justifyContent:"center" },
  trophyBadgeCount:{ position:"absolute", top:-4, right:-4, backgroundColor:ORANGE, width:20, height:20, borderRadius:10, alignItems:"center", justifyContent:"center", borderWidth:2, borderColor:CARD },
  trophyBadgeNum:  { fontSize:10, fontWeight:"800", color:"#fff" },
  achieveTitle:{ fontSize:15, fontWeight:"700", color:TEXT1 },
  achieveSub:  { fontSize:12, color:TEXT2, marginTop:2 },
  achieveBtn:  { backgroundColor:ORANGE_L, borderRadius:12, paddingHorizontal:12, paddingVertical:7 },
  achieveBtnText:{ fontSize:13, fontWeight:"700", color:ORANGE },

  /* 方言采集 screen */
  taskCard:      { borderRadius:18, padding:16, marginBottom:14, gap:10 },
  taskCardRow:   { flexDirection:"row", alignItems:"center", gap:6 },
  taskCardTitle: { fontSize:14, fontWeight:"700", color:TEXT1 },
  taskSteps:     { gap:8 },
  taskStep:      { flexDirection:"row", alignItems:"center", gap:10 },
  taskStepDot:   { width:30, height:30, borderRadius:15, alignItems:"center", justifyContent:"center" },
  taskStepText:  { fontSize:13, color:TEXT2, flex:1 },

  dialectProgressCard:  { backgroundColor:CARD, borderRadius:16, padding:14, marginBottom:14, gap:8 },
  dialectProgressLabel: { fontSize:14, fontWeight:"600", color:TEXT1 },

  termCard:        { flexDirection:"row", alignItems:"center", backgroundColor:CARD, borderRadius:18, padding:14, gap:12, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:6, elevation:1 },
  termCardDone:    { backgroundColor:"#F0FFF8", borderWidth:1, borderColor:"#B0DEC0" },
  termCardLeft:    { flexShrink:0 },
  termCollectedIcon:  { width:44, height:44, borderRadius:22, backgroundColor:GREEN, alignItems:"center", justifyContent:"center" },
  termUncollectedIcon:{ width:44, height:44, borderRadius:22, backgroundColor:"#FFF4EC", alignItems:"center", justifyContent:"center" },
  termEmoji:       { fontSize:24 },
  termCardMid:     { flex:1, gap:4 },
  termWordCollected:{ fontSize:20, fontWeight:"800", color:GREEN },
  termWordHidden:  { fontSize:20, fontWeight:"800", color:TEXT3, letterSpacing:2 },
  termPinyin:      { fontSize:12, color:TEXT2 },
  termLocationRow: { flexDirection:"row", alignItems:"center", gap:3 },
  termLocationText:{ fontSize:11, color:TEXT3 },
  termRegionTag:   { alignSelf:"flex-start", backgroundColor:"#F5EFE6", borderRadius:8, paddingHorizontal:7, paddingVertical:2 },
  termRegionText:  { fontSize:10, color:TEXT2 },
  termCardRight:   { flexShrink:0 },
  termDoneTag:     { backgroundColor:GREEN_L, borderRadius:10, paddingHorizontal:8, paddingVertical:5 },
  termDoneTagText: { fontSize:11, fontWeight:"700", color:GREEN },
  termGoBtn:       { flexDirection:"row", alignItems:"center", gap:2, backgroundColor:ORANGE_L, borderRadius:10, paddingHorizontal:8, paddingVertical:5 },
  termGoBtnText:   { fontSize:11, fontWeight:"700", color:ORANGE },

  /* Challenge modal */
  challengeOverlay:{ flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" },
  challengeSheet:  { backgroundColor:CARD, borderTopLeftRadius:28, borderTopRightRadius:28, maxHeight:SCREEN_H * 0.85, paddingBottom:40 },
  challengeHandle: { width:40, height:4, backgroundColor:"#E0DAD4", borderRadius:2, alignSelf:"center", marginTop:12, marginBottom:4 },

  stepIndicatorRow: { flexDirection:"row", alignItems:"center", justifyContent:"center", paddingHorizontal:32, paddingTop:12 },
  stepDot:      { width:26, height:26, borderRadius:13, backgroundColor:"#EEE", alignItems:"center", justifyContent:"center" },
  stepDotActive:{ backgroundColor:ORANGE },
  stepDotDone:  { backgroundColor:GREEN },
  stepDotNum:   { fontSize:12, fontWeight:"700", color:TEXT3 },
  stepLine:     { flex:1, height:2, backgroundColor:"#EEE", marginHorizontal:4 },
  stepLineDone: { backgroundColor:GREEN },
  stepLabels:   { flexDirection:"row", justifyContent:"space-around", paddingHorizontal:16, marginTop:4, marginBottom:4 },
  stepLabel:    { fontSize:11, color:TEXT3, textAlign:"center", flex:1 },
  stepLabelActive:{ color:ORANGE, fontWeight:"700" },

  challengeContent: { padding:20, gap:14 },
  challengeHeading: { fontSize:18, fontWeight:"800", color:TEXT1, textAlign:"center" },
  challengeSubtext: { fontSize:13, color:TEXT2, textAlign:"center", lineHeight:18 },

  playerCard:    { borderRadius:18, overflow:"hidden" },
  playerGrad:    { alignItems:"center", padding:20, gap:14 },
  waveformRow:   { flexDirection:"row", alignItems:"center", gap:4, height:44, marginBottom:4 },
  waveBar:       { width:5, borderRadius:3, backgroundColor:"#B0C8F0" },
  playBtn:       { width:56, height:56, borderRadius:28, borderWidth:2, borderColor:BLUE, backgroundColor:CARD, alignItems:"center", justifyContent:"center" },
  playerHint:    { fontSize:13, color:TEXT2 },

  regionInfoRow:  { flexDirection:"row", alignItems:"center", gap:5, justifyContent:"center" },
  regionInfoText: { fontSize:12, color:TEXT2 },

  challengeNextBtn:         { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8, backgroundColor:ORANGE, borderRadius:20, paddingVertical:14 },
  challengeNextBtnDisabled: { backgroundColor:"#F0EBE3" },
  challengeNextBtnText:     { fontSize:15, fontWeight:"700", color:"#fff" },
  backStepBtn:     { alignItems:"center", paddingVertical:8 },
  backStepBtnText: { fontSize:13, color:TEXT3 },

  locationCard:     { backgroundColor:"#F5EFE6", borderRadius:18, padding:16, gap:8 },
  locationCardTop:  { flexDirection:"row", alignItems:"center", gap:6 },
  locationCardTitle:{ fontSize:13, fontWeight:"700", color:TEXT1 },
  locationAddr:     { fontSize:15, fontWeight:"700", color:ORANGE, paddingLeft:26 },
  locationDivider:  { height:1, backgroundColor:BORDER, marginVertical:6 },
  locationPerson:   { fontSize:15, fontWeight:"700", color:BLUE, paddingLeft:26 },
  locationHint:     { fontSize:12, color:TEXT2, paddingLeft:26, lineHeight:17 },

  recordHintCard:  { flexDirection:"row", alignItems:"flex-start", gap:8, backgroundColor:BLUE_L, borderRadius:14, padding:12 },
  recordHintText:  { fontSize:13, color:TEXT2, flex:1, lineHeight:18 },

  micArea:     { alignItems:"center", gap:12, paddingVertical:10 },
  micOuter:    { width:100, height:100, borderRadius:50, backgroundColor:"rgba(224,112,48,0.12)", alignItems:"center", justifyContent:"center" },
  micInner:    { width:80, height:80, borderRadius:40, alignItems:"center", justifyContent:"center" },
  micLabel:    { fontSize:14, fontWeight:"600", color:TEXT1 },
  recordingDots:  { flexDirection:"row", gap:5 },
  recordingDot:   { width:8, height:8, borderRadius:4, backgroundColor:ORANGE },

  successCard:         { borderRadius:20, padding:20, alignItems:"center", gap:12 },
  successIconWrap:     { marginBottom:4 },
  successIcon:         { width:72, height:72, borderRadius:36, alignItems:"center", justifyContent:"center" },
  successTitle:        { fontSize:22, fontWeight:"800", color:GREEN },
  successRegion:       { fontSize:13, color:TEXT2 },
  successTermBox:      { alignItems:"center", gap:4 },
  successTerm:         { fontSize:36, fontWeight:"900", color:TEXT1 },
  successPinyin:       { fontSize:15, color:TEXT2 },
  successPointsRow:    { flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"#FFF9EC", borderRadius:20, paddingHorizontal:14, paddingVertical:7 },
  successPoints:       { fontSize:15, fontWeight:"700", color:GOLD },

  /* Win modal */
  modalBackdrop: { flex:1, backgroundColor:"rgba(0,0,0,0.55)", alignItems:"center", justifyContent:"center", padding:24 },
  winModal:      { backgroundColor:CARD, borderRadius:28, padding:28, alignItems:"center", gap:12, width:"100%" },
  winIcon:       { width:72, height:72, borderRadius:36, alignItems:"center", justifyContent:"center", marginBottom:4 },
  winTitle:      { fontSize:22, fontWeight:"800", color:TEXT1 },
  winDesc:       { fontSize:14, color:TEXT2, textAlign:"center", lineHeight:20 },
  winPointsRow:  { flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"#FFF9EC", borderRadius:20, paddingHorizontal:16, paddingVertical:8 },
  winPoints:     { fontSize:16, fontWeight:"700", color:"#E09020" },
  winBtn:        { backgroundColor:ORANGE, borderRadius:18, paddingHorizontal:32, paddingVertical:13, marginTop:4 },
  winBtnText:    { fontSize:16, fontWeight:"700", color:"#fff" },

  /* 声音寻觅 screen */
  soundProgressArea: { padding:16, paddingBottom:0, gap:6 },
  soundRoundText:    { fontSize:13, color:TEXT2, textAlign:"right" },

  soundPlayerCard:  { backgroundColor:CARD, margin:16, borderRadius:20, padding:16, gap:12, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:8, elevation:1 },
  soundPlayerTop:   { flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  soundPlayerLabel: { flexDirection:"row", alignItems:"center", gap:5 },
  soundPlayerLabelText:{ fontSize:13, fontWeight:"700", color:BLUE },
  soundDialectReveal:  { alignItems:"flex-end" },
  soundDialectWord:    { fontSize:18, fontWeight:"800", color:TEXT1 },
  soundDialectHidden:  { fontSize:12, color:TEXT3 },
  soundPlayArea:   { alignItems:"center", gap:10 },
  sWaveRow:        { flexDirection:"row", alignItems:"center", gap:5, height:36 },
  sWaveBar:        { width:6, borderRadius:3 },
  soundPlayBtn:    { alignItems:"center", justifyContent:"center" },
  soundPlayHint:   { fontSize:13, color:TEXT2 },
  soundPlayPrompt: { flexDirection:"row", alignItems:"center", gap:5, backgroundColor:BLUE_L, borderRadius:10, padding:8 },
  soundPlayPromptText:{ fontSize:12, color:BLUE, flex:1 },

  optionsTitle: { fontSize:15, fontWeight:"700", color:TEXT1, paddingHorizontal:16, marginBottom:8 },
  optionsGrid:  { flexDirection:"row", flexWrap:"wrap", paddingHorizontal:16, gap:10 },
  optionCard:   { width:"47%", borderRadius:20, padding:16, alignItems:"center", gap:8, minHeight:130, borderWidth:2, borderColor:"transparent", justifyContent:"center" },
  optionCorrect:{ borderColor:GREEN, backgroundColor:"#F0FFF8" },
  optionWrong:  { borderColor:"#D04040", backgroundColor:"#FFF0F0" },
  optionDisabled:{ opacity:0.6 },
  optionEmoji:  { fontSize:46 },
  optionName:   { fontSize:14, fontWeight:"700", color:TEXT1, textAlign:"center" },
  optionFeedback:{ position:"absolute", top:8, right:8 },
  optionLock:   { position:"absolute", top:8, right:8, opacity:0.5 },

  soundResultCard: { borderRadius:24, overflow:"hidden" },
  soundResultGrad: { padding:32, alignItems:"center", gap:10 },
  soundResultTitle:{ fontSize:26, fontWeight:"800", color:"#fff" },
  soundResultScore:{ fontSize:18, fontWeight:"700", color:"rgba(255,255,255,0.9)" },
  soundResultMsg:  { fontSize:14, color:"rgba(255,255,255,0.8)", textAlign:"center" },
  soundResultPointsRow:{ flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"rgba(255,255,255,0.2)", borderRadius:20, paddingHorizontal:14, paddingVertical:7, marginTop:4 },
  soundResultPoints:   { fontSize:15, fontWeight:"700", color:"#fff" },
  soundRetryBtn:  { backgroundColor:"#fff", borderRadius:16, paddingHorizontal:28, paddingVertical:12, marginTop:8 },
  soundRetryText: { fontSize:15, fontWeight:"700", color:BLUE },

  /* Rewards */
  pointsHeader:    { alignItems:"center", backgroundColor:"#A060E8", paddingVertical:24, gap:4 },
  pointsHeaderNum: { fontSize:40, fontWeight:"900", color:"#fff" },
  pointsHeaderLabel:{ fontSize:14, color:"rgba(255,255,255,0.8)" },
  rewardTabs:       { flexDirection:"row", backgroundColor:CARD, borderBottomWidth:1, borderBottomColor:BORDER },
  rewardTab:        { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:4, paddingVertical:12 },
  rewardTabActive:  { borderBottomWidth:2.5, borderBottomColor:"#A060E8" },
  rewardTabText:    { fontSize:13, color:TEXT3 },
  rewardTabTextActive:{ color:"#A060E8", fontWeight:"700" },
  rewardGrid:   { flexDirection:"row", flexWrap:"wrap", gap:12 },
  rewardItem:   { width:"47%", backgroundColor:CARD, borderRadius:18, padding:14, gap:6, shadowColor:"#000", shadowOpacity:0.04, shadowRadius:6, elevation:1 },
  rewardIcon:   { fontSize:32 },
  rewardName:   { fontSize:14, fontWeight:"700", color:TEXT1 },
  rewardDesc:   { fontSize:11, color:TEXT2, lineHeight:16 },
  rewardBottom: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginTop:4 },
  rewardCostRow:{ flexDirection:"row", alignItems:"center", gap:3 },
  rewardCost:   { fontSize:13, fontWeight:"700", color:"#E09020" },
  redeemBtn:    { backgroundColor:"#A060E8", borderRadius:12, paddingHorizontal:10, paddingVertical:5 },
  redeemBtnDone:{ backgroundColor:"#F0EBE3" },
  redeemBtnDisabled:{ backgroundColor:"#F0EBE3" },
  redeemBtnText:{ fontSize:12, fontWeight:"700", color:"#fff" },
  badgeGrid:    { flexDirection:"row", flexWrap:"wrap", gap:12 },
  badgeItem:    { width:"47%", backgroundColor:CARD, borderRadius:18, padding:14, gap:4, alignItems:"center", shadowColor:"#000", shadowOpacity:0.04, shadowRadius:6, elevation:1 },
  badgeItemUnlocked:{ backgroundColor:"#FFF8F0", borderWidth:1.5, borderColor:GOLD },
  badgeCheck:   { position:"absolute", top:10, right:10, backgroundColor:GREEN, borderRadius:10, width:20, height:20, alignItems:"center", justifyContent:"center" },
  badgeIcon:    { fontSize:32, marginBottom:4 },
  badgeName:    { fontSize:13, fontWeight:"700", color:TEXT1, textAlign:"center" },
  badgeNameUnlocked:{ color:ORANGE },
  badgeDesc:    { fontSize:11, color:TEXT2, textAlign:"center" },
  badgeLock:    { fontSize:11, color:TEXT3, marginTop:2 },
  skinGrid:     { flexDirection:"row", flexWrap:"wrap", gap:12 },
  skinItem:     { width:"47%", backgroundColor:CARD, borderRadius:18, padding:14, gap:6, alignItems:"center", shadowColor:"#000", shadowOpacity:0.04, shadowRadius:6, elevation:1 },
  skinItemActive:{ borderWidth:2, borderColor:"#A060E8" },
  skinActiveBadge:   { position:"absolute", top:8, right:8, backgroundColor:"#A060E8", borderRadius:8, paddingHorizontal:6, paddingVertical:2 },
  skinActiveBadgeText:{ fontSize:10, color:"#fff", fontWeight:"700" },
  skinPreview:  { fontSize:40, marginBottom:4 },
  skinName:     { fontSize:13, fontWeight:"700", color:TEXT1 },
  skinBtn:      { backgroundColor:"#F0EBE3", borderRadius:12, paddingHorizontal:14, paddingVertical:6 },
  skinBtnActive:{ backgroundColor:"#A060E8" },
  skinBtnText:  { fontSize:12, fontWeight:"700", color:TEXT2 },

  toast: { position:"absolute", bottom:40, left:32, right:32, backgroundColor:"rgba(20,20,30,0.88)", borderRadius:20, flexDirection:"row", alignItems:"center", gap:8, paddingVertical:12, paddingHorizontal:16 },
  toastText: { color:"#fff", fontSize:14, fontWeight:"600" },

  /* Achievements */
  trophyHero:       { borderRadius:24, padding:28, alignItems:"center", marginBottom:16 },
  trophyHeroCenter: { alignItems:"center", gap:12 },
  trophyHeroOuter:  { width:90, height:90, borderRadius:45, backgroundColor:"rgba(255,255,255,0.2)", alignItems:"center", justifyContent:"center", position:"relative" },
  trophyHeroInner:  { width:76, height:76, borderRadius:38, alignItems:"center", justifyContent:"center" },
  trophyHeroBadge:  { position:"absolute", top:-4, right:-4, backgroundColor:ORANGE, width:24, height:24, borderRadius:12, alignItems:"center", justifyContent:"center", borderWidth:2, borderColor:"rgba(255,255,255,0.3)" },
  trophyHeroBadgeNum:{ fontSize:12, fontWeight:"800", color:"#fff" },
  trophyHeroLabel:  { fontSize:13, color:"rgba(255,255,255,0.7)" },
  trophyHeroSub:    { fontSize:18, fontWeight:"800", color:"#fff" },
  badgeHeroGrid:    { borderRadius:20, overflow:"hidden" },
  badgeHeroInner:   { flexDirection:"row", flexWrap:"wrap", padding:16, gap:12 },
  badgeHeroItem:    { width:"44%", alignItems:"center", gap:6 },
  badgeHeroIconWrap:{ width:60, height:60, borderRadius:30, backgroundColor:"rgba(255,255,255,0.15)", alignItems:"center", justifyContent:"center" },
  badgeHeroIconLocked:{ backgroundColor:"rgba(255,255,255,0.05)" },
  badgeHeroIcon:    { fontSize:30 },
  badgeHeroName:    { fontSize:13, fontWeight:"700", color:"#fff" },
  badgeHeroDesc:    { fontSize:11, color:"rgba(180,200,255,0.7)", textAlign:"center" },
});
