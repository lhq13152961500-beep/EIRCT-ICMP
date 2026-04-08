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
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useLocation } from "@/contexts/LocationContext";
import Colors from "@/constants/colors";

const { width: SW } = Dimensions.get("window");
const PRIMARY = Colors.light.primary;
const ACCENT = Colors.light.accent;

/* ── POI dataset ───────────────────────────────────────────────── */
type Poi = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  image: ReturnType<typeof require>;
  story: string;
  cultural: string;
  mandarinScript: string;
  dialectScript: string;
  tagColor: string;
  tagBg: string;
};

const POIS: Poi[] = [
  {
    id: "1",
    name: "古村牌坊",
    lat: 42.8605, lng: 89.5973,
    image: require("@/assets/images/home_banner3.png"),
    story: "相传这座牌坊是当年村中状元归乡时皇帝所赐，历经风雨仍屹立不倒",
    cultural: "展现了徽派建筑的精湛工艺与宗族文化的深厚底蕴",
    mandarinScript: "古村牌坊建于清代，是村落标志性建筑，承载着村落百年历史与荣耀，见证了无数乡亲的悲欢离合。",
    dialectScript: "这个牌坊，老辈人都说是出了大官儿回来立的，风吹日晒几百年，还是好好儿的。",
    tagColor: "#3A68D8", tagBg: "#DDE8FF",
  },
  {
    id: "2",
    name: "老街茶馆",
    lat: 42.8612, lng: 89.5966,
    image: require("@/assets/images/home_banner1.png"),
    story: "百年老茶馆是村里最古老的商铺，曾是过往商旅和村民聚集交流的中心",
    cultural: "保存完好的明清古街，青石板路见证了几代人的生活变迁",
    mandarinScript: "老街茶馆已有两百余年历史，青砖黛瓦，古朴典雅。昔日商贾云集，今日仍是村民休憩叙话之处。",
    dialectScript: "这茶馆啊，俺爷爷的爷爷就在这儿喝茶，那时候的茶钱才几文铜板呢。",
    tagColor: "#2E9E6B", tagBg: "#D6F0E3",
  },
  {
    id: "3",
    name: "祠堂广场",
    lat: 42.8598, lng: 89.5980,
    image: require("@/assets/images/home_banner2.png"),
    story: "祠堂是村落精神的核心，每逢节庆，全村老幼聚于此处祭祖祈福",
    cultural: "村落的精神中心，每逢节庆便会举行传统仪式",
    mandarinScript: "祠堂广场是全村最重要的公共空间，承载着祭祖敬宗的传统礼仪，也是村民共同记忆的载体。",
    dialectScript: "到了清明冬至，大家都会到祠堂磕头烧香，拜老祖宗，这规矩几百年都没断过。",
    tagColor: "#9B59B6", tagBg: "#F0EDF8",
  },
  {
    id: "4",
    name: "石桥流水",
    lat: 42.8590, lng: 89.5968,
    image: require("@/assets/images/route-thumb-1.png"),
    story: "村中的三孔石桥据说建于明代，历经数百年洪涝仍完好无损",
    cultural: "跨越小溪的三孔石桥，桥下流水潺潺，两岸杨柳依依",
    mandarinScript: "石桥以当地青石砌成，三孔拱形，结构精巧。桥下溪水常年不断，是村落重要的水源与景观节点。",
    dialectScript: "小时候我们就爱在桥上玩，夏天把脚伸进溪水里，凉快得很！",
    tagColor: "#E07830", tagBg: "#FFE4CC",
  },
  {
    id: "5",
    name: "葡萄晾房",
    lat: 42.8618, lng: 89.5975,
    image: require("@/assets/images/route-thumb-2.png"),
    story: "吐峪沟的葡萄晾房是当地独特的农业建筑，利用自然通风将葡萄晾制成葡萄干",
    cultural: "千年葡萄种植文化的见证，展示了先民因地制宜的农业智慧",
    mandarinScript: "葡萄晾房以土坯建造，四壁镂空，借助吐鲁番盆地的干热风将葡萄自然风干，是当地最具代表性的农业遗产。",
    dialectScript: "每年秋天，房子里全是葡萄的香气，晒出来的葡萄干又甜又大，城里买不到这种味道。",
    tagColor: "#2E9E6B", tagBg: "#D6F0E3",
  },
  {
    id: "6",
    name: "烽火台遗址",
    lat: 42.8625, lng: 89.5960,
    image: require("@/assets/images/diary-thumb-1.png"),
    story: "汉代烽火台是古丝绸之路上的军事信息传递站，见证了千年边疆历史",
    cultural: "丝绸之路重要的历史遗迹，诉说着古代东西方文明交流的故事",
    mandarinScript: "烽火台建于汉代，是丝绸之路上的军事预警系统。狼烟一起，数百里外的驻军便可得到警报，见证了边疆的烽火岁月。",
    dialectScript: "俺小时候就听老人说，这台子上以前点火报信，那时候没有手机，全靠烟火传消息。",
    tagColor: "#E05A3A", tagBg: "#FFE8E2",
  },
];

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m: number) {
  return m < 1000 ? `${Math.round(m)} 米` : `${(m / 1000).toFixed(1)} 公里`;
}

/* ── Waveform animation ──────────────────────────────────────── */
function SoundWave({ playing, color }: { playing: boolean; color: string }) {
  const bars = [0.4, 0.7, 1.0, 0.7, 0.4, 0.85, 0.5, 0.9, 0.6, 1.0, 0.75, 0.5];
  const anims = useRef(bars.map((h) => new Animated.Value(h))).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (playing) {
      loopRef.current = Animated.loop(
        Animated.stagger(
          60,
          anims.map((a, i) =>
            Animated.sequence([
              Animated.timing(a, { toValue: 0.2 + Math.random() * 0.8, duration: 280 + i * 20, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
              Animated.timing(a, { toValue: bars[i], duration: 280 + i * 20, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
            ])
          )
        )
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      anims.forEach((a, i) => Animated.timing(a, { toValue: bars[i], duration: 200, useNativeDriver: false }).start());
    }
    return () => loopRef.current?.stop();
  }, [playing]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 28 }}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3, borderRadius: 2, backgroundColor: color,
            height: anim.interpolate({ inputRange: [0, 1], outputRange: [3, 24] }),
          }}
        />
      ))}
    </View>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function VoiceGuide() {
  const insets = useSafeAreaInsets();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const isDemo = demo === "1";
  const { locationStatus } = useLocation();

  /* current POI index and language */
  const [currentPoiId, setCurrentPoiId] = useState<string>("1");
  const [lang, setLang] = useState<"mandarin" | "dialect">("mandarin");
  const [playing, setPlaying] = useState(false);
  const [autoLocked, setAutoLocked] = useState(false);

  /* Distances to each POI */
  const [distances, setDistances] = useState<Record<string, number>>({});

  useEffect(() => {
    if (locationStatus.state !== "located") return;
    const { lat, lng } = locationStatus;
    const dists: Record<string, number> = {};
    let nearestId = POIS[0].id;
    let nearestDist = Infinity;

    POIS.forEach((p) => {
      const d = haversineM(lat, lng, p.lat, p.lng);
      dists[p.id] = d;
      if (d < nearestDist) {
        nearestDist = d;
        nearestId = p.id;
      }
    });

    setDistances(dists);
    if (!autoLocked) {
      setCurrentPoiId(nearestId);
    }
  }, [locationStatus, autoLocked]);

  /* In demo mode use fixed location showing POI 1 nearest */
  useEffect(() => {
    if (isDemo) {
      const dists: Record<string, number> = {};
      POIS.forEach((p, i) => { dists[p.id] = 50 + i * 80; });
      setDistances(dists);
    }
  }, [isDemo]);

  const currentPoi = POIS.find((p) => p.id === currentPoiId) ?? POIS[0];
  const nearbyPois = [...POIS]
    .filter((p) => p.id !== currentPoiId)
    .sort((a, b) => (distances[a.id] ?? 9999) - (distances[b.id] ?? 9999));

  const selectPoi = (id: string) => {
    if (id === currentPoiId) return;
    setAutoLocked(true);
    setCurrentPoiId(id);
    setPlaying(false);
  };

  const togglePlay = () => setPlaying((p) => !p);

  const script = lang === "mandarin" ? currentPoi.mandarinScript : currentPoi.dialectScript;

  return (
    <View style={styles.root}>
      {/* ── Header ─────────────────────────────────── */}
      <LinearGradient
        colors={["#FEFAF6", "#FFF8F0"]}
        style={[styles.headerGrad, { paddingTop: insets.top + 4 }]}
        pointerEvents="box-none"
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={styles.headerBadge}>
              <Ionicons name="radio-outline" size={12} color={ACCENT} />
              <Text style={styles.headerBadgeText}>智能语音导览系统</Text>
            </View>
            <Text style={styles.headerTitle}>语伴导游</Text>
          </View>
          {isDemo && (
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>演示</Text>
            </View>
          )}
          {!isDemo && (
            <Pressable style={styles.lockBtn} onPress={() => setAutoLocked((v) => !v)}>
              <Ionicons name={autoLocked ? "lock-closed-outline" : "locate-outline"} size={18} color={autoLocked ? ACCENT : PRIMARY} />
            </Pressable>
          )}
        </View>

        {/* Language toggle */}
        <View style={styles.langToggle}>
          <Pressable
            style={[styles.langBtn, lang === "mandarin" && styles.langBtnActive]}
            onPress={() => { setLang("mandarin"); setPlaying(false); }}
          >
            <Ionicons name="mic-outline" size={14} color={lang === "mandarin" ? "#fff" : "#888"} />
            <Text style={[styles.langBtnText, lang === "mandarin" && styles.langBtnTextActive]}>普通话</Text>
          </Pressable>
          <Pressable
            style={[styles.langBtn, lang === "dialect" && styles.langBtnActive]}
            onPress={() => { setLang("dialect"); setPlaying(false); }}
          >
            <Ionicons name="chatbubble-outline" size={14} color={lang === "dialect" ? "#fff" : "#888"} />
            <Text style={[styles.langBtnText, lang === "dialect" && styles.langBtnTextActive]}>方言版</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* ── Current POI card ──────────────────────── */}
        <View style={styles.currentCard}>
          <Image source={currentPoi.image} style={styles.currentImage} resizeMode="cover" />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.72)"]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* POI name overlay */}
          <View style={styles.currentOverlay}>
            <View style={[styles.poiTag, { backgroundColor: currentPoi.tagBg }]}>
              <Text style={[styles.poiTagText, { color: currentPoi.tagColor }]}>当前景点</Text>
            </View>
            <Text style={styles.currentName}>{currentPoi.name}</Text>
            {distances[currentPoi.id] != null && (
              <Text style={styles.currentDist}>
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.7)" />
                {" "}{fmtDist(distances[currentPoi.id])}
              </Text>
            )}
          </View>
        </View>

        {/* ── Audio player ──────────────────────────── */}
        <View style={styles.playerCard}>
          <View style={styles.playerTop}>
            <View style={styles.playerInfo}>
              <Text style={styles.playerLabel}>{lang === "mandarin" ? "普通话讲解" : "方言讲解"}</Text>
              <Text style={styles.playerSub}>
                {lang === "dialect" ? "由本地村民录制" : "标准普通话版本"}
              </Text>
            </View>
            <Pressable style={[styles.playBtn, playing && styles.playBtnActive]} onPress={togglePlay}>
              <Ionicons name={playing ? "pause" : "play"} size={22} color="#fff" />
            </Pressable>
          </View>
          <SoundWave playing={playing} color={playing ? ACCENT : "#CCCCCC"} />
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: playing ? "35%" : "0%" }]} />
          </View>
        </View>

        {/* ── Transcript ────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.scriptText}>{script}</Text>
        </View>

        {/* ── Story ─────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: ACCENT }]} />
            <Text style={[styles.sectionTitle, { color: ACCENT }]}>流传故事</Text>
          </View>
          <Text style={styles.sectionBody}>{currentPoi.story}</Text>
        </View>

        {/* ── Cultural value ────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: PRIMARY }]} />
            <Text style={[styles.sectionTitle, { color: PRIMARY }]}>文化价值</Text>
          </View>
          <Text style={styles.sectionBody}>{currentPoi.cultural}</Text>
        </View>

        {/* ── Nearby POIs ───────────────────────────── */}
        <View style={styles.nearbyHeader}>
          <Text style={styles.nearbyTitle}>附近景点</Text>
          {autoLocked && !isDemo && (
            <Pressable onPress={() => setAutoLocked(false)}>
              <Text style={styles.autoText}>自动切换</Text>
            </Pressable>
          )}
        </View>

        {nearbyPois.map((poi) => (
          <Pressable key={poi.id} style={styles.nearbyRow} onPress={() => selectPoi(poi.id)}>
            <Image source={poi.image} style={styles.nearbyThumb} resizeMode="cover" />
            {/* Pulsing dot = currently playing (nearby with audio) */}
            <View style={styles.nearbyContent}>
              <View style={styles.nearbyTopRow}>
                <Text style={styles.nearbyName}>{poi.name}</Text>
                <View style={styles.nearbyDistBadge}>
                  <Ionicons name="location-outline" size={11} color="#888" />
                  <Text style={styles.nearbyDist}>
                    {distances[poi.id] != null ? fmtDist(distances[poi.id]) : "—"}
                  </Text>
                </View>
              </View>
              <Text style={styles.nearbyDesc} numberOfLines={2}>{poi.story}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAFAFA" },

  headerGrad: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  headerBadgeText: { fontSize: 11, color: ACCENT, fontWeight: "600" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#1A1A1A" },
  demoBadge: {
    backgroundColor: ACCENT + "22", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  demoBadgeText: { fontSize: 11, color: ACCENT, fontWeight: "700" },
  lockBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },

  langToggle: {
    flexDirection: "row", backgroundColor: "#F0F0F0",
    borderRadius: 12, padding: 3, alignSelf: "center",
  },
  langBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10,
  },
  langBtnActive: { backgroundColor: ACCENT },
  langBtnText: { fontSize: 13, fontWeight: "600", color: "#888" },
  langBtnTextActive: { color: "#fff" },

  /* Current POI hero */
  currentCard: {
    marginHorizontal: 16, marginTop: 14, borderRadius: 18,
    overflow: "hidden", height: 220,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  currentImage: { width: "100%", height: "100%" },
  currentOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16 },
  poiTag: {
    alignSelf: "flex-start", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6,
  },
  poiTagText: { fontSize: 11, fontWeight: "700" },
  currentName: { fontSize: 22, fontWeight: "800", color: "#fff" },
  currentDist: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 },

  /* Audio player */
  playerCard: {
    marginHorizontal: 16, marginTop: 14, backgroundColor: "#fff",
    borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  playerTop: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  playerInfo: { flex: 1 },
  playerLabel: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  playerSub: { fontSize: 12, color: "#999", marginTop: 2 },
  playBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#CCCCCC",
    alignItems: "center", justifyContent: "center",
  },
  playBtnActive: { backgroundColor: ACCENT },
  progressBar: {
    height: 3, backgroundColor: "#F0F0F0", borderRadius: 2, marginTop: 10,
  },
  progressFill: { height: 3, backgroundColor: ACCENT, borderRadius: 2 },

  /* Script / info sections */
  section: {
    marginHorizontal: 16, marginTop: 14, backgroundColor: "#fff",
    borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  sectionDot: { width: 4, height: 16, borderRadius: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "700" },
  sectionBody: { fontSize: 14, color: "#444", lineHeight: 22 },
  scriptText: { fontSize: 14, color: "#333", lineHeight: 24 },

  /* Nearby list */
  nearbyHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 16, marginTop: 20, marginBottom: 10,
  },
  nearbyTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  autoText: { fontSize: 13, color: PRIMARY, fontWeight: "600" },
  nearbyRow: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 10,
    backgroundColor: "#fff", borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  nearbyThumb: { width: 80, height: 80 },
  nearbyContent: { flex: 1, padding: 12 },
  nearbyTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  nearbyName: { fontSize: 14, fontWeight: "700", color: "#1A1A1A", flex: 1, marginRight: 8 },
  nearbyDistBadge: { flexDirection: "row", alignItems: "center", gap: 2 },
  nearbyDist: { fontSize: 12, color: "#888" },
  nearbyDesc: { fontSize: 12, color: "#666", lineHeight: 18 },
});
