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
  Platform,
  ActivityIndicator,
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
const PRIMARY  = Colors.light.primary;
const ACCENT   = Colors.light.accent;

/* ── Sheet snap positions ───────────────────────────── */
const SHEET_PEEK   = 152;           // collapsed: just mini-player visible
const SHEET_FULL   = SH * 0.82;    // expanded: full content

/* ── POI content mirror (same as HTML, for React rendering) */
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
const CAT_COLOR: Record<string, { bg: string; text: string }> = {
  "建筑": { bg: "#FFF4E6", text: "#E88A2E" },
  "展览": { bg: "#EEF2FF", text: "#6B7FD4" },
  "特产": { bg: "#F0FFF4", text: "#3DAA6F" },
  "美食": { bg: "#FFF0F0", text: "#E8514A" },
};

/* ── Stable map URL ─────────────────────────────────── */
const MAP_URL = (() => {
  try { return new URL("api/map-voice-guide", getApiUrl()).href; } catch { return ""; }
})();
const MAP_SOURCE = MAP_URL ? { uri: MAP_URL } : undefined;

/* ── Animated sound wave ────────────────────────────── */
function SoundWave({ playing, color }: { playing: boolean; color: string }) {
  const bars = [0.4, 0.75, 1.0, 0.6, 0.85, 0.5, 0.9, 0.65, 1.0, 0.7, 0.45, 0.8];
  const anims = useRef(bars.map(h => new Animated.Value(h))).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (playing) {
      loopRef.current = Animated.loop(Animated.stagger(55, anims.map((a, i) =>
        Animated.sequence([
          Animated.timing(a, { toValue: 0.15 + Math.random() * 0.85, duration: 260 + i * 18, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          Animated.timing(a, { toValue: bars[i], duration: 260 + i * 18, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        ])
      )));
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      anims.forEach((a, i) => Animated.timing(a, { toValue: bars[i], duration: 200, useNativeDriver: false }).start());
    }
    return () => loopRef.current?.stop();
  }, [playing]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 26 }}>
      {anims.map((anim, i) => (
        <Animated.View key={i} style={{
          width: 3, borderRadius: 2, backgroundColor: color,
          height: anim.interpolate({ inputRange: [0, 1], outputRange: [3, 22] }),
        }} />
      ))}
    </View>
  );
}

/* ── Main screen ────────────────────────────────────── */
export default function VoiceGuide() {
  const insets = useSafeAreaInsets();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const isDemo = demo === "1";
  const { locationStatus } = useLocation();

  /* Current POI */
  const [currentPoi, setCurrentPoi] = useState<PoiDetail>(ALL_POIS[0]);
  const [lang, setLang]   = useState<"mandarin" | "dialect">("mandarin");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [zoneAlert, setZoneAlert] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  /* Bottom sheet */
  const sheetY    = useRef(new Animated.Value(SH - SHEET_PEEK)).current;
  const sheetYVal = useRef(SH - SHEET_PEEK);
  const [expanded, setExpanded] = useState(false);

  const snapTo = useCallback((open: boolean) => {
    const toY = open ? SH - SHEET_FULL : SH - SHEET_PEEK;
    setExpanded(open);
    Animated.spring(sheetY, { toValue: toY, useNativeDriver: true, tension: 65, friction: 12 }).start();
    sheetYVal.current = toY;
  }, [sheetY]);

  /* PanResponder for drag */
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
    onPanResponderMove: (_, g) => {
      const newY = Math.max(SH - SHEET_FULL, Math.min(SH - SHEET_PEEK, sheetYVal.current + g.dy));
      sheetY.setValue(newY);
    },
    onPanResponderRelease: (_, g) => {
      const curY = sheetYVal.current + g.dy;
      const openThresh = SH - (SHEET_PEEK + (SHEET_FULL - SHEET_PEEK) * 0.4);
      snapTo(curY < openThresh || g.vy < -0.5);
    },
  })).current;

  sheetY.addListener(({ value }) => { sheetYVal.current = value; });

  /* WebView ref */
  const webViewRef = useRef<WebView>(null);

  const injectJs = useCallback((js: string) => {
    webViewRef.current?.injectJavaScript(`(function(){${js}})(); true;`);
  }, []);

  /* Sync location to map */
  useEffect(() => {
    if (!mapReady || locationStatus.state !== "located") return;
    const { lat, lng } = locationStatus;
    injectJs(`window.setMyLocation&&window.setMyLocation(${lng},${lat});`);
  }, [locationStatus, mapReady, injectJs]);

  /* Handle map → RN messages */
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
            setTimeout(() => setZoneAlert(false), 3000);
          }
          if (!expanded) snapTo(false);
        }
      }
    } catch { /* ignore */ }
  }, [expanded, snapTo]);

  /* Pan to poi on map when currentPoi changes */
  useEffect(() => {
    if (!mapReady) return;
    injectJs(`window.panToPoi&&window.panToPoi(${JSON.stringify(currentPoi.id)});`);
  }, [currentPoi.id, mapReady, injectJs]);

  /* Fake progress ticker */
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setProgress(p => p >= 100 ? (setPlaying(false), 0) : p + 0.4), 100);
    return () => clearInterval(t);
  }, [playing]);

  const catColor = CAT_COLOR[currentPoi.cat] ?? { bg: "#F5F5F5", text: "#888" };
  const catImg   = CAT_IMG[currentPoi.cat]   ?? require("@/assets/images/hero-landscape.png");
  const otherPois = ALL_POIS.filter(p => p.id !== currentPoi.id).slice(0, 4);

  /* Sheet content translucency */
  const sheetExpand = sheetY.interpolate({ inputRange: [SH - SHEET_FULL, SH - SHEET_PEEK], outputRange: [1, 0] });

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

      {/* ── Header overlay ───────────────────────────── */}
      <LinearGradient
        colors={["rgba(0,0,0,0.42)", "transparent"]}
        style={[styles.headerGrad, { paddingTop: insets.top + 4 }]}
        pointerEvents="box-none"
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={styles.headerBadge}>
              <Ionicons name="radio-outline" size={12} color={ACCENT} />
              <Text style={styles.headerBadgeTxt}>智能语音导览系统</Text>
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

      {/* ── Zone enter alert ─────────────────────────── */}
      {zoneAlert && (
        <Animated.View style={[styles.zoneAlert, { top: insets.top + 76 }]}>
          <Ionicons name="radio-outline" size={16} color="#fff" />
          <Text style={styles.zoneAlertTxt}>已进入 {currentPoi.name} 讲解区域，正在播放…</Text>
        </Animated.View>
      )}

      {/* ── Draggable bottom sheet ───────────────────── */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={styles.dragArea}>
          <View style={styles.dragHandle} />
        </View>

        {/* ── MINI PLAYER (always visible) ───────────── */}
        <View style={styles.miniPlayer}>
          <View style={styles.miniPoiInfo}>
            <View style={[styles.miniEmoji, { backgroundColor: catColor.bg }]}>
              <Text style={{ fontSize: 20 }}>{currentPoi.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniPoiName} numberOfLines={1}>{currentPoi.name}</Text>
              <Text style={styles.miniPoiCat}>{currentPoi.cat}</Text>
            </View>
          </View>

          {/* Language toggle */}
          <View style={styles.langToggle}>
            <Pressable
              style={[styles.langBtn, lang === "mandarin" && styles.langBtnActive]}
              onPress={() => { setLang("mandarin"); setPlaying(false); setProgress(0); }}
            >
              <Text style={[styles.langBtnTxt, lang === "mandarin" && styles.langBtnTxtActive]}>普通话</Text>
            </Pressable>
            <Pressable
              style={[styles.langBtn, lang === "dialect" && styles.langBtnActive]}
              onPress={() => { setLang("dialect"); setPlaying(false); setProgress(0); }}
            >
              <Text style={[styles.langBtnTxt, lang === "dialect" && styles.langBtnTxtActive]}>方言</Text>
            </Pressable>
          </View>

          {/* Play button */}
          <Pressable style={[styles.playBtn, playing && styles.playBtnActive]} onPress={() => setPlaying(p => !p)}>
            <Ionicons name={playing ? "pause" : "play"} size={20} color="#fff" />
          </Pressable>

          {/* Expand arrow */}
          <Pressable style={styles.expandBtn} onPress={() => snapTo(!expanded)}>
            <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={20} color="#999" />
          </Pressable>
        </View>

        {/* Progress bar */}
        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
          </View>
          <SoundWave playing={playing} color={playing ? ACCENT : "#D0D0D0"} />
        </View>

        {/* ── EXPANDED CONTENT ─────────────────────── */}
        <Animated.View style={{ flex: 1, opacity: sheetExpand }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            scrollEnabled={expanded}
          >
            {/* Hero image */}
            <View style={styles.heroWrap}>
              <Image source={catImg} style={styles.heroImg} resizeMode="cover" />
              <LinearGradient colors={["transparent", "rgba(0,0,0,0.6)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={[styles.catTag, { backgroundColor: catColor.bg }]}>
                <Text style={[styles.catTagTxt, { color: catColor.text }]}>{currentPoi.cat}</Text>
              </View>
              <Text style={styles.heroName}>{currentPoi.name}</Text>
            </View>

            {/* Intro section */}
            <View style={styles.section}>
              <View style={styles.secHeader}>
                <View style={[styles.secDot, { backgroundColor: "#6B7FD4" }]} />
                <Text style={[styles.secTitle, { color: "#6B7FD4" }]}>景点介绍</Text>
              </View>
              <Text style={styles.secBody}>{currentPoi.intro}</Text>
            </View>

            {/* Story section */}
            <View style={styles.section}>
              <View style={styles.secHeader}>
                <View style={[styles.secDot, { backgroundColor: ACCENT }]} />
                <Text style={[styles.secTitle, { color: ACCENT }]}>流传故事</Text>
              </View>
              <Text style={styles.secBody}>{currentPoi.story}</Text>
            </View>

            {/* Cultural value */}
            <View style={styles.section}>
              <View style={styles.secHeader}>
                <View style={[styles.secDot, { backgroundColor: PRIMARY }]} />
                <Text style={[styles.secTitle, { color: PRIMARY }]}>文化价值</Text>
              </View>
              <Text style={styles.secBody}>{currentPoi.cultural}</Text>
            </View>

            {/* Nearby POIs */}
            <Text style={styles.nearbyTitle}>其他景点</Text>
            {otherPois.map(poi => {
              const cc = CAT_COLOR[poi.cat] ?? { bg: "#F5F5F5", text: "#888" };
              return (
                <Pressable key={poi.id} style={styles.nearbyRow} onPress={() => {
                  setCurrentPoi(poi); setPlaying(false); setProgress(0);
                  injectJs(`window.activatePoi&&window.activatePoi(${JSON.stringify(poi.id)});`);
                  injectJs(`window.panToPoi&&window.panToPoi(${JSON.stringify(poi.id)});`);
                  snapTo(false);
                }}>
                  <View style={[styles.nearbyEmoji, { backgroundColor: cc.bg }]}>
                    <Text style={{ fontSize: 22 }}>{poi.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.nearbyName}>{poi.name}</Text>
                      <View style={[styles.nearbyTag, { backgroundColor: cc.bg }]}>
                        <Text style={[styles.nearbyTagTxt, { color: cc.text }]}>{poi.cat}</Text>
                      </View>
                    </View>
                    <Text style={styles.nearbyDesc} numberOfLines={1}>{poi.intro}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#CCC" />
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#E8DCC8" },
  map: { flex: 1 },
  mapFallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mapFallbackTxt: { fontSize: 14, color: "#888" },

  /* Header */
  headerGrad: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 28,
    zIndex: 10,
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

  /* Zone alert toast */
  zoneAlert: {
    position: "absolute", left: 16, right: 16, zIndex: 20,
    backgroundColor: "rgba(61,170,111,0.92)", borderRadius: 12,
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  zoneAlertTxt: { fontSize: 13, color: "#fff", fontWeight: "600", flex: 1 },

  /* Bottom sheet */
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    height: SHEET_FULL + 24,
    backgroundColor: "#fff",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 }, elevation: 20,
  },
  dragArea: {
    paddingVertical: 10, alignItems: "center",
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: "#DCDCDC",
  },

  /* Mini player */
  miniPlayer: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, gap: 10, marginBottom: 8,
  },
  miniEmoji: {
    width: 42, height: 42, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  miniPoiInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  miniPoiName: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  miniPoiCat: { fontSize: 11, color: "#999", marginTop: 1 },

  langToggle: {
    flexDirection: "row", backgroundColor: "#F0F0F0",
    borderRadius: 10, padding: 2,
  },
  langBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  langBtnActive: { backgroundColor: ACCENT },
  langBtnTxt: { fontSize: 12, fontWeight: "600", color: "#888" },
  langBtnTxtActive: { color: "#fff" },

  playBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#CCC", alignItems: "center", justifyContent: "center",
  },
  playBtnActive: { backgroundColor: ACCENT },
  expandBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center",
  },

  /* Progress */
  progressWrap: {
    paddingHorizontal: 16, gap: 8, marginBottom: 10,
  },
  progressBg: { height: 3, backgroundColor: "#F0F0F0", borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: ACCENT, borderRadius: 2 },

  /* Expanded content */
  heroWrap: {
    marginHorizontal: 16, borderRadius: 16, overflow: "hidden",
    height: 160, marginBottom: 14,
    shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  heroImg: { width: "100%", height: "100%" },
  catTag: {
    position: "absolute", top: 12, left: 12,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  catTagTxt: { fontSize: 11, fontWeight: "700" },
  heroName: {
    position: "absolute", bottom: 12, left: 12,
    fontSize: 20, fontWeight: "800", color: "#fff",
  },

  section: {
    marginHorizontal: 16, backgroundColor: "#FAFAFA",
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  secHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  secDot: { width: 4, height: 15, borderRadius: 2 },
  secTitle: { fontSize: 13, fontWeight: "700" },
  secBody: { fontSize: 14, color: "#444", lineHeight: 22 },

  nearbyTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginHorizontal: 16, marginBottom: 10 },
  nearbyRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: "#FAFAFA", borderRadius: 14,
    padding: 12, gap: 12,
  },
  nearbyEmoji: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  nearbyName: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  nearbyTag: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  nearbyTagTxt: { fontSize: 11, fontWeight: "600" },
  nearbyDesc: { fontSize: 12, color: "#666", marginTop: 2, lineHeight: 17 },
});
