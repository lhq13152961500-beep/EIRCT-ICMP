"use no memo";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { useLocation } from "@/contexts/LocationContext";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

const { width: SW, height: SH } = Dimensions.get("window");
const PRIMARY = Colors.light.primary;
const ACCENT  = Colors.light.accent;

/* Mini player bar height */
const MINI_H    = 72;
/* Detail sheet snap heights */
const DETAIL_H  = SH * 0.88;

type PoiDetail = {
  id: string; name: string; emoji: string; cat: string;
  intro: string; story: string; cultural: string;
};

const ALL_POIS: PoiDetail[] = [
  {id:"1",name:"景区入口大门",emoji:"🚪",cat:"建筑",
   intro:"吐峪沟大峡谷景区正门，古朴石砌拱门，始建于清代，是进入峡谷的第一道历史门槛。",
   story:"相传清代一位维吾尔族商人为感谢神灵庇佑捐建此门，百年来过往行人皆在此驻足祈福。",
   cultural:"石砌拱门融合了中原与西域建筑风格，是丝路文化交融的实物见证。"},
  {id:"2",name:"麻扎村",emoji:"🕌",cat:"建筑",
   intro:"千年维吾尔族古村落，保留完整的生土建筑群，村内巷道迷宫般蜿蜒，至今居民生活其中。",
   story:"村中老人说，麻扎村已有1500年历史，曾是丝绸之路上的重要驿站，商旅、僧侣皆在此歇脚。",
   cultural:"生土建筑冬暖夏凉，是人类与干旱气候和谐共处的智慧结晶，被列入世界文化遗产预备名录。"},
  {id:"3",name:"吐峪沟清真寺",emoji:"⛩️",cat:"建筑",
   intro:"历史悠久的伊斯兰建筑，精美木雕装饰令人叹为观止，是新疆保存最完好的古清真寺之一。",
   story:"传说寺中有一口古井，千年来从未干涸，当地人称之为「圣水井」，每逢斋月香客云集。",
   cultural:"礼拜大殿的木雕花纹融合了波斯与汉式纹样，是伊斯兰东传与本土文化融合的珍贵遗存。"},
  {id:"4",name:"千年洞窟",emoji:"⛰️",cat:"建筑",
   intro:"公元4世纪佛教石窟群，壁画保存完好，是新疆早期佛教传播的重要遗址。",
   story:"据史书记载，东晋高僧法显西行取经时曾途经此地，留下「谷中有僧千余人」的记述。",
   cultural:"石窟壁画兼具犍陀罗与龟兹风格，呈现了佛教艺术东传过程中的演变轨迹。"},
  {id:"5",name:"古麻扎遗址",emoji:"🏛️",cat:"建筑",
   intro:"伊斯兰圣祠遗址，是新疆最古老的麻扎之一，每年吸引众多穆斯林朝拜。",
   story:"麻扎供奉的是伊斯兰传教先贤，民间传说其圣人能治愈百病，故世代受到敬仰。",
   cultural:"麻扎文化是中亚伊斯兰信仰的重要组成部分，体现了宗教与民间信仰的融合。"},
  {id:"6",name:"非遗文化馆",emoji:"🎨",cat:"展览",
   intro:"集中展示维吾尔族非物质文化遗产，含木卡姆、都它尔等项目，定时有现场演出。",
   story:"馆内珍藏的一把都它尔据说有200年历史，是一位盲人艺人毕生演奏的挚爱之物。",
   cultural:"木卡姆被联合国列入人类非物质文化遗产代表作名录，承载着维吾尔族的精神与记忆。"},
  {id:"7",name:"民俗体验馆",emoji:"🖼️",cat:"展览",
   intro:"原汁原味的维吾尔族传统手工艺展示与互动体验，可亲手尝试土陶制作与地毯编织。",
   story:"体验馆的老师傅已年过七旬，十二岁便跟随父亲学艺，一生守护这门即将失传的手艺。",
   cultural:"手工艺不仅是生计，更是文化的活态传承，每一件作品都蕴含着世代相传的生活智慧。"},
  {id:"8",name:"葡萄晾房",emoji:"🍇",cat:"特产",
   intro:"传统土坯晾房，四壁镂空以引入干热风，将鲜葡萄自然风干为葡萄干，是吐鲁番独特农业遗产。",
   story:"老辈人说，判断葡萄干好坏要看晾房朝向，朝北的晾房风大、晾出的葡萄干最甜最香。",
   cultural:"晾房建筑是吐鲁番先民因地制宜的农业智慧，将极端气候转化为独特的生产资源。"},
  {id:"9",name:"特产集市",emoji:"🎁",cat:"特产",
   intro:"葡萄干、无花果、馕饼等吐峪沟特色农产品集散地，可以直接从农户手中购买。",
   story:"集市每逢周五「巴扎日」最为热闹，方圆百里的村民带着自家农产品赶来交易，延续千年传统。",
   cultural:"巴扎是维吾尔族经济与社会交流的中心，承载着古丝路集市贸易文化的活态记忆。"},
  {id:"10",name:"烤馕馆",emoji:"🫓",cat:"美食",
   intro:"现烤坑炉馕饼，外脆内软，是当地最具特色的主食，制作工艺已传承数百年。",
   story:"馕师傅说，烤好一个馕需要掌握火候、面团发酵和贴炉手法，学徒通常要学三年才能出师。",
   cultural:"馕是维吾尔族饮食文化的核心，「宁可三日无肉，不可一日无馕」道出了它在生活中的地位。"},
  {id:"11",name:"瓜果长廊",emoji:"🍈",cat:"美食",
   intro:"种植哈密瓜、白杏等特色瓜果，葡萄架绵延百米，夏秋季节果香扑鼻，可现场品尝。",
   story:"长廊主人的曾祖父将葡萄种子从苏联带回，如今这个品种只有这一家还在种植。",
   cultural:"吐鲁番的极端干热气候造就了含糖量极高的瓜果，是大自然与人类共同创造的风土作品。"},
  {id:"12",name:"游客服务中心",emoji:"ℹ️",cat:"建筑",
   intro:"提供景区导览、租赁、急救等综合服务，内有休息区与电子导览设备。",
   story:"服务中心原是一座百年老宅，改建时保留了原有的土坯墙与木格窗，新旧融合别有韵味。",
   cultural:"将历史建筑活化为公共服务空间，是文化遗产保护与可持续利用的有益探索。"},
];

const CAT_IMG: Record<string, ReturnType<typeof require>> = {
  "建筑": require("@/assets/images/home_banner3.png"),
  "展览": require("@/assets/images/home_banner1.png"),
  "特产": require("@/assets/images/home_banner2.png"),
  "美食": require("@/assets/images/route-thumb-1.png"),
};
const CAT_COLOR: Record<string, { bg: string; text: string; accent: string }> = {
  "建筑": { bg: "#FFF4E6", text: "#E88A2E", accent: "#E88A2E" },
  "展览": { bg: "#EEF2FF", text: "#6B7FD4", accent: "#6B7FD4" },
  "特产": { bg: "#F0FFF4", text: "#3DAA6F", accent: "#3DAA6F" },
  "美食": { bg: "#FFF0F0", text: "#E8514A", accent: "#E8514A" },
};

const MAP_URL = (() => {
  try { return new URL("api/map-voice-guide", getApiUrl()).href; } catch { return ""; }
})();
const MAP_SOURCE = MAP_URL ? { uri: MAP_URL } : undefined;

/* ── Animated sound wave bars ───────────────────────── */
function SoundWave({ playing, color, barCount = 18, height = 28 }: {
  playing: boolean; color: string; barCount?: number; height?: number;
}) {
  const baseHeights = Array.from({ length: barCount }, (_, i) =>
    0.25 + 0.75 * Math.abs(Math.sin(i * 0.72))
  );
  const anims = useRef(baseHeights.map(h => new Animated.Value(h))).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (playing) {
      loopRef.current = Animated.loop(
        Animated.stagger(40, anims.map((a, i) =>
          Animated.sequence([
            Animated.timing(a, {
              toValue: 0.1 + Math.random() * 0.9,
              duration: 200 + i * 15,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
            }),
            Animated.timing(a, {
              toValue: baseHeights[i],
              duration: 200 + i * 15,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: false,
            }),
          ])
        ))
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      anims.forEach((a, i) =>
        Animated.timing(a, { toValue: baseHeights[i], duration: 180, useNativeDriver: false }).start()
      );
    }
    return () => loopRef.current?.stop();
  }, [playing]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, height }}>
      {anims.map((anim, i) => (
        <Animated.View key={i} style={{
          width: 2.5, borderRadius: 2, backgroundColor: color,
          height: anim.interpolate({ inputRange: [0, 1], outputRange: [3, height * 0.85] }),
        }} />
      ))}
    </View>
  );
}

/* ── Main ───────────────────────────────────────────── */
export default function VoiceGuide() {
  const insets = useSafeAreaInsets();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const isDemo = demo === "1";
  const { locationStatus } = useLocation();

  const [currentPoi, setCurrentPoi] = useState<PoiDetail>(ALL_POIS[0]);
  const [lang, setLang]     = useState<"mandarin" | "dialect">("mandarin");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [zoneAlert, setZoneAlert] = useState(false);
  const [mapReady, setMapReady]   = useState(false);
  const [mapError, setMapError]   = useState(false);

  /* Detail sheet open/close */
  const sheetTranslateY  = useRef(new Animated.Value(DETAIL_H)).current;
  const backdropOpacity  = useRef(new Animated.Value(0)).current;
  const sheetYVal        = useRef(DETAIL_H);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = useCallback(() => {
    setDetailOpen(true);
    Animated.parallel([
      Animated.spring(sheetTranslateY, {
        toValue: 0, useNativeDriver: true, tension: 70, friction: 13,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1, duration: 220, useNativeDriver: true,
      }),
    ]).start();
    sheetYVal.current = 0;
  }, [sheetTranslateY, backdropOpacity]);

  const closeDetail = useCallback(() => {
    Animated.parallel([
      Animated.spring(sheetTranslateY, {
        toValue: DETAIL_H, useNativeDriver: true, tension: 70, friction: 13,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0, duration: 200, useNativeDriver: true,
      }),
    ]).start(() => setDetailOpen(false));
    sheetYVal.current = DETAIL_H;
  }, [sheetTranslateY, backdropOpacity]);

  /* PanResponder on detail sheet drag handle */
  const detailPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
    onPanResponderMove: (_, g) => {
      const newY = Math.max(0, g.dy);
      sheetTranslateY.setValue(newY);
      /* fade backdrop as sheet drags down */
      backdropOpacity.setValue(Math.max(0, 1 - newY / DETAIL_H));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.6) {
        closeDetail();
      } else {
        /* snap back — restore backdrop */
        Animated.parallel([
          Animated.spring(sheetTranslateY, {
            toValue: 0, useNativeDriver: true, tension: 70, friction: 13,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 1, duration: 180, useNativeDriver: true,
          }),
        ]).start();
        sheetYVal.current = 0;
      }
    },
  })).current;

  /* WebView */
  const webViewRef = useRef<WebView>(null);
  const injectJs = useCallback((js: string) => {
    webViewRef.current?.injectJavaScript(`(function(){${js}})(); true;`);
  }, []);

  /* Sync location */
  useEffect(() => {
    if (!mapReady || locationStatus.state !== "located") return;
    const { lat, lng } = locationStatus;
    const acc = (locationStatus as any).accuracy ?? 0;
    injectJs(`window.setMyLocation&&window.setMyLocation(${lng},${lat},${acc});`);
  }, [locationStatus, mapReady, injectJs]);

  /* Map messages */
  const onMapMessage = useCallback((e: any) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === "ready") { setMapReady(true); return; }
      if (data.type === "poiClick" || data.type === "zoneEnter") {
        const found = ALL_POIS.find(p => p.id === data.id);
        if (found) {
          setCurrentPoi(found);
          setPlaying(false);
          setProgress(0);
          if (data.type === "zoneEnter") {
            setZoneAlert(true);
            setTimeout(() => setZoneAlert(false), 3200);
          }
        }
      }
    } catch { /* ignore */ }
  }, []);

  /* Pan map to poi */
  useEffect(() => {
    if (!mapReady) return;
    injectJs(`window.panToPoi&&window.panToPoi(${JSON.stringify(currentPoi.id)});`);
  }, [currentPoi.id, mapReady, injectJs]);

  /* Fake progress */
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() =>
      setProgress(p => p >= 100 ? (setPlaying(false), 0) : p + 0.4),
    100);
    return () => clearInterval(t);
  }, [playing]);

  const catColor = CAT_COLOR[currentPoi.cat] ?? { bg: "#F5F5F5", text: "#888", accent: "#888" };
  const catImg   = CAT_IMG[currentPoi.cat]   ?? require("@/assets/images/hero-landscape.png");
  const miniBarBottom = insets.bottom + 12;

  return (
    <View style={styles.root}>
      {/* ── Full-screen map ──────────────────────────── */}
      <View style={StyleSheet.absoluteFill}>
        {!mapError && MAP_SOURCE ? (
          <WebView
            ref={webViewRef}
            source={MAP_SOURCE}
            style={styles.map}
            javaScriptEnabled
            onMessage={onMapMessage}
            onLoadEnd={() => setMapReady(true)}
            onError={() => setMapError(true)}
            cacheEnabled
            androidLayerType="hardware"
            scrollEnabled={false}
            bounces={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.mapFallback}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.mapFallbackTxt}>地图加载中…</Text>
          </View>
        )}
      </View>

      {/* ── Header gradient ───────────────────────────── */}
      <LinearGradient
        colors={["rgba(0,0,0,0.48)", "transparent"]}
        style={[styles.headerGrad, { paddingTop: insets.top + 4 }]}
        pointerEvents="box-none"
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={styles.headerBadge}>
              <Ionicons name="radio-outline" size={11} color={ACCENT} />
              <Text style={styles.headerBadgeTxt}>智能语音导览</Text>
            </View>
            <Text style={styles.headerTitle}>语伴导游</Text>
          </View>
          {isDemo ? (
            <View style={styles.demoBadge}><Text style={styles.demoBadgeTxt}>演示</Text></View>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>
      </LinearGradient>

      {/* ── Zone enter alert toast ───────────────────── */}
      {zoneAlert && (
        <View style={[styles.zoneAlert, { top: insets.top + 72 }]}>
          <View style={styles.zoneAlertDot} />
          <Text style={styles.zoneAlertTxt}>已进入 {currentPoi.name} 讲解区域</Text>
          <Ionicons name="volume-high-outline" size={14} color="#fff" />
        </View>
      )}

      {/* ── QQ Music style mini player bar ───────────── */}
      <Pressable
        style={[styles.miniBar, { bottom: miniBarBottom }]}
        onPress={openDetail}
        android_ripple={null}
      >
        {/* Left: cover + info */}
        <View style={styles.miniLeft}>
          <View style={[styles.miniCover, { backgroundColor: catColor.bg }]}>
            <Text style={styles.miniEmoji}>{currentPoi.emoji}</Text>
            {playing && (
              <View style={styles.miniPlayingDot} />
            )}
          </View>
          <View style={styles.miniInfo}>
            <Text style={styles.miniName} numberOfLines={1}>{currentPoi.name}</Text>
            <Text style={styles.miniSub} numberOfLines={1}>
              {lang === "mandarin" ? "普通话讲解" : "方言讲解"} · {currentPoi.cat}
            </Text>
          </View>
        </View>

        {/* Center: waveform */}
        <View style={styles.miniWave}>
          <SoundWave playing={playing} color={playing ? catColor.accent : "#C8C8C8"} barCount={14} height={24} />
        </View>

        {/* Right: controls */}
        <View style={styles.miniRight}>
          {/* Language tap-to-toggle */}
          <Pressable
            style={[styles.langPill, { borderColor: catColor.accent }]}
            onPress={(e) => {
              e.stopPropagation?.();
              setLang(l => l === "mandarin" ? "dialect" : "mandarin");
              setPlaying(false);
              setProgress(0);
            }}
            hitSlop={8}
          >
            <Text style={[styles.langPillTxt, { color: catColor.accent }]}>
              {lang === "mandarin" ? "普" : "方"}
            </Text>
          </Pressable>

          {/* Play / pause */}
          <Pressable
            style={[styles.playBtn, { backgroundColor: catColor.accent }]}
            onPress={(e) => {
              e.stopPropagation?.();
              setPlaying(p => !p);
            }}
            hitSlop={4}
          >
            <Ionicons name={playing ? "pause" : "play"} size={18} color="#fff" />
          </Pressable>

          {/* Expand hint */}
          <Pressable onPress={openDetail} hitSlop={8}>
            <Ionicons name="chevron-up" size={18} color="#AAAAAA" />
          </Pressable>
        </View>
      </Pressable>

      {/* Progress bar above mini player */}
      <View style={[styles.progressBar, { bottom: miniBarBottom + MINI_H - 2 }]}>
        <View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: catColor.accent }]} />
      </View>

      {/* ── Detail sheet (slides up) ─────────────────── */}
      <Animated.View
        style={[
          styles.detailSheet,
          { height: DETAIL_H, transform: [{ translateY: sheetTranslateY }] },
        ]}
        pointerEvents={detailOpen ? "auto" : "none"}
      >
        {/* Drag handle row */}
        <View {...detailPan.panHandlers} style={styles.dragArea}>
          <View style={styles.dragHandle} />
        </View>

        {/* Close button */}
        <Pressable style={styles.closeBtn} onPress={closeDetail}>
          <Ionicons name="chevron-down" size={22} color="#888" />
        </Pressable>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        >
          {/* Hero image */}
          <View style={styles.heroWrap}>
            <Image source={catImg} style={styles.heroImg} resizeMode="cover" />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.72)"]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={[styles.catTag, { backgroundColor: catColor.bg }]}>
              <Text style={[styles.catTagTxt, { color: catColor.text }]}>{currentPoi.cat}</Text>
            </View>
            {/* Language + play controls over hero */}
            <View style={styles.heroControls}>
              <Pressable
                style={[styles.heroLangPill, { borderColor: "rgba(255,255,255,0.7)" }]}
                onPress={() => {
                  setLang(l => l === "mandarin" ? "dialect" : "mandarin");
                  setPlaying(false); setProgress(0);
                }}
              >
                <Ionicons name="swap-horizontal-outline" size={12} color="#fff" />
                <Text style={styles.heroLangTxt}>
                  {lang === "mandarin" ? "普通话" : "方言"}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.heroPlayBtn, { backgroundColor: catColor.accent }]}
                onPress={() => setPlaying(p => !p)}
              >
                <Ionicons name={playing ? "pause" : "play"} size={20} color="#fff" />
                <Text style={styles.heroPlayTxt}>{playing ? "暂停" : "播放讲解"}</Text>
              </Pressable>
            </View>
            <Text style={styles.heroName}>{currentPoi.name}</Text>
          </View>

          {/* Progress under hero */}
          {playing && (
            <View style={styles.detailProgressWrap}>
              <View style={styles.detailProgressBg}>
                <View style={[styles.detailProgressFill, { width: `${progress}%` as any, backgroundColor: catColor.accent }]} />
              </View>
              <SoundWave playing={playing} color={catColor.accent} barCount={22} height={32} />
            </View>
          )}

          {/* Intro */}
          <View style={styles.section}>
            <View style={styles.secHeader}>
              <View style={[styles.secDot, { backgroundColor: "#6B7FD4" }]} />
              <Text style={[styles.secTitle, { color: "#6B7FD4" }]}>景点介绍</Text>
            </View>
            <Text style={styles.secBody}>{currentPoi.intro}</Text>
          </View>

          {/* Story */}
          <View style={styles.section}>
            <View style={styles.secHeader}>
              <View style={[styles.secDot, { backgroundColor: ACCENT }]} />
              <Text style={[styles.secTitle, { color: ACCENT }]}>流传故事</Text>
            </View>
            <Text style={styles.secBody}>{currentPoi.story}</Text>
          </View>

          {/* Cultural */}
          <View style={styles.section}>
            <View style={styles.secHeader}>
              <View style={[styles.secDot, { backgroundColor: PRIMARY }]} />
              <Text style={[styles.secTitle, { color: PRIMARY }]}>文化价值</Text>
            </View>
            <Text style={styles.secBody}>{currentPoi.cultural}</Text>
          </View>
        </ScrollView>
      </Animated.View>

      {/* ── Detail sheet backdrop (animated fade) ────────── */}
      {detailOpen && (
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents={detailOpen ? "auto" : "none"}
        >
          <Pressable style={{ flex: 1 }} onPress={closeDetail} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#E8DCC8" },
  map:  { flex: 1 },
  mapFallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mapFallbackTxt: { fontSize: 14, color: "#888" },

  /* Header */
  headerGrad: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 32, zIndex: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  headerBadgeTxt: { fontSize: 11, color: ACCENT, fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  demoBadge: { backgroundColor: ACCENT + "33", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  demoBadgeTxt: { fontSize: 11, color: ACCENT, fontWeight: "700" },

  /* Zone alert */
  zoneAlert: {
    position: "absolute", left: 16, right: 16, zIndex: 20,
    backgroundColor: "rgba(40,160,100,0.93)", borderRadius: 12,
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  zoneAlertDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#7FFFC0",
  },
  zoneAlertTxt: { flex: 1, fontSize: 13, color: "#fff", fontWeight: "600" },

  /* ── QQ Music mini player bar ─────────────────────── */
  miniBar: {
    position: "absolute", left: 14, right: 14,
    height: MINI_H,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, gap: 10,
    zIndex: 30,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 18,
    ...(Platform.OS === "ios" ? {} : {}),
  },

  miniLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  miniCover: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  miniEmoji: { fontSize: 22 },
  miniPlayingDot: {
    position: "absolute", bottom: 3, right: 3,
    width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT,
    borderWidth: 1.5, borderColor: "#fff",
  },
  miniInfo: { flex: 1, minWidth: 0 },
  miniName: { fontSize: 14, fontWeight: "700", color: "#1A1A1A", marginBottom: 2 },
  miniSub:  { fontSize: 11, color: "#999" },

  miniWave: { alignItems: "center", justifyContent: "center", width: 50 },

  miniRight: { flexDirection: "row", alignItems: "center", gap: 8 },

  langPill: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
  },
  langPillTxt: { fontSize: 12, fontWeight: "800" },

  playBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 6, elevation: 4,
  },

  /* Progress bar above mini player */
  progressBar: {
    position: "absolute", left: 14, right: 14,
    height: 2.5, backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 2, overflow: "hidden", zIndex: 29,
  },
  progressFill: { height: "100%", borderRadius: 2 },

  /* ── Detail sheet ─────────────────────────────────── */
  detailSheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    zIndex: 40,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 }, elevation: 24,
  },
  dragArea: {
    paddingTop: 12, paddingBottom: 6, alignItems: "center",
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0",
  },
  closeBtn: {
    position: "absolute", top: 10, right: 16, zIndex: 2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#F2F2F2",
    alignItems: "center", justifyContent: "center",
  },

  /* Hero */
  heroWrap: {
    marginHorizontal: 16, borderRadius: 20, overflow: "hidden",
    height: 200, marginBottom: 14, marginTop: 8,
  },
  heroImg: { width: "100%", height: "100%" },
  catTag: {
    position: "absolute", top: 14, left: 14,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  catTagTxt: { fontSize: 11, fontWeight: "700" },
  heroName: {
    position: "absolute", bottom: 56, left: 14, right: 14,
    fontSize: 22, fontWeight: "800", color: "#fff",
    textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  heroControls: {
    position: "absolute", bottom: 14, left: 14, right: 14,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  heroLangPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  heroLangTxt: { fontSize: 12, color: "#fff", fontWeight: "600" },
  heroPlayBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 38, borderRadius: 19,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
  heroPlayTxt: { fontSize: 14, color: "#fff", fontWeight: "700" },

  /* Detail progress */
  detailProgressWrap: {
    marginHorizontal: 16, marginBottom: 14, gap: 6,
  },
  detailProgressBg: {
    height: 3, backgroundColor: "#F0F0F0", borderRadius: 2, overflow: "hidden",
  },
  detailProgressFill: { height: "100%", borderRadius: 2 },

  /* Sections */
  section: {
    marginHorizontal: 16, backgroundColor: "#FAFAFA",
    borderRadius: 16, padding: 16, marginBottom: 10,
  },
  secHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 9 },
  secDot: { width: 4, height: 16, borderRadius: 2 },
  secTitle: { fontSize: 14, fontWeight: "700" },
  secBody: { fontSize: 14, color: "#444", lineHeight: 22 },

  /* Backdrop */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    zIndex: 35,
  },
});
