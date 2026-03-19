import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_FULL = SCREEN_HEIGHT * 0.74;

const haptic = (style: "light" | "medium" = "light") => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(
      style === "medium"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    );
  }
};

type FilterKey = "全部" | "建筑" | "展览" | "美食" | "特产" | "卫生间";

interface PoiItem {
  id: string;
  label: string;
  emoji: string;
  category: Exclude<FilterKey, "全部">;
  x: number;
  y: number;
  desc?: string;
}

const CATEGORY_COLORS: Record<Exclude<FilterKey, "全部">, { bg: string; dot: string; text: string }> = {
  建筑: { bg: "#FFF4E6", dot: "#E88A2E", text: "#B8681E" },
  展览: { bg: "#EEF2FF", dot: "#6B7FD4", text: "#4A5CB8" },
  美食: { bg: "#FFF0F0", dot: "#E8514A", text: "#C0392B" },
  特产: { bg: "#F0FFF4", dot: "#3DAA6F", text: "#2D8A55" },
  卫生间: { bg: "#F5F5FF", dot: "#8B8EC8", text: "#6B6EAA" },
};

const FILTER_TABS: FilterKey[] = ["全部", "建筑", "展览", "美食", "特产", "卫生间"];

const POI_ITEMS: PoiItem[] = [
  { id: "1",  label: "风车坊",   emoji: "🏗️", category: "建筑", x: 0.13, y: 0.10, desc: "百年历史风车遗址" },
  { id: "2",  label: "古戏台",   emoji: "🏛️", category: "建筑", x: 0.58, y: 0.06, desc: "明清戏台建筑" },
  { id: "3",  label: "宗族祠堂", emoji: "🏠", category: "建筑", x: 0.74, y: 0.24, desc: "李氏家族祠堂" },
  { id: "4",  label: "碉楼旧址", emoji: "🗼", category: "建筑", x: 0.07, y: 0.46, desc: "民国时期防御建筑" },
  { id: "5",  label: "法式特展", emoji: "🖼️", category: "展览", x: 0.52, y: 0.17, desc: "法国印象派艺术展" },
  { id: "6",  label: "非遗馆",   emoji: "🎨", category: "展览", x: 0.32, y: 0.54, desc: "国家非遗项目展示" },
  { id: "7",  label: "法棍工坊", emoji: "🥖", category: "美食", x: 0.40, y: 0.20, desc: "现烤法式面包" },
  { id: "8",  label: "甜品铺",   emoji: "🍰", category: "美食", x: 0.64, y: 0.50, desc: "手工甜品与咖啡" },
  { id: "9",  label: "奶酪坊",   emoji: "🧀", category: "美食", x: 0.16, y: 0.38, desc: "本地特色奶酪" },
  { id: "10", label: "茶咖屋",   emoji: "☕", category: "美食", x: 0.20, y: 0.65, desc: "山间野生茶饮" },
  { id: "11", label: "苹果园",   emoji: "🍎", category: "特产", x: 0.72, y: 0.62, desc: "高山有机苹果" },
  { id: "12", label: "竹编馆",   emoji: "🎋", category: "特产", x: 0.46, y: 0.74, desc: "传统竹编工艺品" },
  { id: "13", label: "WC",       emoji: "🚻", category: "卫生间", x: 0.84, y: 0.38, desc: "公共卫生间" },
  { id: "14", label: "WC",       emoji: "🚻", category: "卫生间", x: 0.28, y: 0.84, desc: "公共卫生间" },
];

interface RouteItem {
  id: string;
  title: string;
  desc: string;
  buildings: number;
  distance: string;
  duration: string;
  color: string;
  accent: string;
  icon: string;
  tags: string[];
}

const ROUTES: RouteItem[] = [
  {
    id: "1",
    title: "快速游览推荐路线",
    desc: "涵盖核心建筑与美食打卡点，适合半日游",
    buildings: 12,
    distance: "2.3",
    duration: "约2小时",
    color: "#E88A2E",
    accent: "#FFF4E6",
    icon: "⚡",
    tags: ["热门", "建筑", "美食"],
  },
  {
    id: "2",
    title: "深度文化游览路线",
    desc: "深入了解历史文化与非遗传承，适合全日游",
    buildings: 17,
    distance: "3.5",
    duration: "约4小时",
    color: "#3DAA6F",
    accent: "#F0FFF4",
    icon: "🎯",
    tags: ["精华", "文化", "非遗"],
  },
  {
    id: "3",
    title: "温馨赏花路线",
    desc: "春季限定，沿途花海如画，浪漫氛围满满",
    buildings: 6,
    distance: "10.2",
    duration: "约3小时",
    color: "#C06BAD",
    accent: "#FDF0F9",
    icon: "🌸",
    tags: ["季节限定", "摄影", "浪漫"],
  },
];

function PoiMarker({
  item, mapW, mapH, isActive, onPress,
}: {
  item: PoiItem; mapW: number; mapH: number; isActive: boolean; onPress: (item: PoiItem) => void;
}) {
  const colors = CATEGORY_COLORS[item.category];
  return (
    <Pressable
      style={[styles.poiWrap, { left: item.x * mapW - 24, top: item.y * mapH - 48 }]}
      onPress={() => { haptic(); onPress(item); }}
    >
      <Animated.View style={[
        styles.poiBubble,
        { backgroundColor: isActive ? colors.dot : "#fff", shadowColor: colors.dot },
      ]}>
        <Text style={styles.poiEmoji}>{item.emoji}</Text>
      </Animated.View>
      <View style={[styles.poiTag, { backgroundColor: isActive ? colors.dot : "rgba(255,255,255,0.92)" }]}>
        <Text style={[styles.poiTagText, { color: isActive ? "#fff" : colors.text }]} numberOfLines={1}>
          {item.label}
        </Text>
      </View>
      <View style={[styles.poiPin, { backgroundColor: isActive ? colors.dot : colors.dot + "99" }]} />
    </Pressable>
  );
}

function IllustratedMap({
  activeFilter, mapW, mapH, selectedPoi, onPoiPress,
}: {
  activeFilter: FilterKey; mapW: number; mapH: number; selectedPoi: PoiItem | null; onPoiPress: (p: PoiItem) => void;
}) {
  const visiblePois = POI_ITEMS.filter(
    (p) => activeFilter === "全部" || p.category === activeFilter
  );

  return (
    <View style={{ width: mapW, height: mapH }}>
      {/* Sky gradient base */}
      <LinearGradient
        colors={["#4ECDC4", "#2BAB9E", "#1A9688"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Island blob */}
      <View style={[styles.islandBlob, { width: mapW * 0.88, height: mapH * 0.9, left: mapW * 0.06, top: mapH * 0.04 }]} />

      {/* Inner island detail */}
      <View style={[styles.islandInner, { width: mapW * 0.75, height: mapH * 0.76, left: mapW * 0.12, top: mapH * 0.11 }]} />

      {/* Roads */}
      {[
        { t: "27%", l: "8%",  w: "58%", h: 10, r: "-7deg" },
        { t: "42%", l: "28%", w: "52%", h: 10, r: "6deg" },
        { t: "58%", l: "12%", w: "62%", h: 10, r: "-4deg" },
        { t: "17%", l: "38%", w: 10, h: "50%", r: "7deg" },
        { t: "32%", l: "63%", w: 10, h: "32%", r: "-6deg" },
      ].map((r, i) => (
        <View key={i} style={[styles.road, { top: r.t as any, left: r.l as any, width: r.w as any, height: r.h as any, transform: [{ rotate: r.r }] }]} />
      ))}

      {/* Road outlines */}
      {[
        { t: "27%", l: "8%",  w: "58%", h: 14, r: "-7deg" },
        { t: "42%", l: "28%", w: "52%", h: 14, r: "6deg" },
        { t: "58%", l: "12%", w: "62%", h: 14, r: "-4deg" },
        { t: "17%", l: "38%", w: 14, h: "50%", r: "7deg" },
        { t: "32%", l: "63%", w: 14, h: "32%", r: "-6deg" },
      ].map((r, i) => (
        <View key={`border-${i}`} style={[styles.roadBorder, { top: r.t as any, left: r.l as any, width: r.w as any, height: r.h as any, transform: [{ rotate: r.r }] }]} />
      ))}

      {/* Decorative trees */}
      {[
        [0.08, 0.06], [0.24, 0.04], [0.44, 0.03], [0.78, 0.09],
        [0.88, 0.18], [0.92, 0.48], [0.85, 0.72], [0.64, 0.88],
        [0.38, 0.90], [0.14, 0.80], [0.04, 0.60], [0.04, 0.32],
        [0.55, 0.33], [0.30, 0.30],
      ].map(([x, y], i) => (
        <Text key={i} style={[styles.treeEmoji, { left: x * mapW - 10, top: y * mapH - 10 }]}>
          {i % 3 === 0 ? "🌲" : i % 3 === 1 ? "🌳" : "🌴"}
        </Text>
      ))}

      {/* Small pond decoration */}
      <View style={[styles.pond, { left: mapW * 0.46, top: mapH * 0.43, width: 28, height: 20 }]} />

      {/* POI Markers */}
      {visiblePois.map((poi) => (
        <PoiMarker
          key={poi.id}
          item={poi}
          mapW={mapW}
          mapH={mapH}
          isActive={selectedPoi?.id === poi.id}
          onPress={onPoiPress}
        />
      ))}

      {/* My location dot */}
      <View style={[styles.myLocWrap, { left: mapW * 0.35, top: mapH * 0.68 }]}>
        <View style={styles.myLocPulse} />
        <View style={styles.myLocDot} />
      </View>
    </View>
  );
}

export default function MapGuideScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom;

  const [activeFilter, setActiveFilter] = useState<FilterKey>("全部");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedPoi, setSelectedPoi] = useState<PoiItem | null>(null);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const sheetAnim = useRef(new Animated.Value(0)).current;

  const mapW = SCREEN_WIDTH;
  const mapH = SCREEN_HEIGHT * 0.6;

  const openSheet = useCallback(() => {
    haptic("medium");
    setSelectedPoi(null);
    setSheetOpen(true);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: false,
      tension: 52,
      friction: 9,
    }).start();
  }, [sheetAnim]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 240,
      useNativeDriver: false,
    }).start(() => setSheetOpen(false));
  }, [sheetAnim]);

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_FULL + 40, 0],
  });

  const handleAiSubmit = () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setTimeout(() => {
      setAiResponse(
        `根据您的需求「${aiQuery}」，为您量身规划：\n\n` +
        `📍 出发点：村口广场\n` +
        `🏛️ 第一站：古戏台（约15分钟）\n` +
        `🥖 第二站：法棍工坊品尝特色（约20分钟）\n` +
        `🎨 第三站：非遗馆（约30分钟）\n` +
        `🍰 第四站：甜品铺小憩（约20分钟）\n` +
        `🏠 终点：宗族祠堂（约15分钟）\n\n` +
        `⏱ 预计耗时约1.5小时\n📏 全程约1.8公里`
      );
      setAiLoading(false);
    }, 1500);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <StatusBar barStyle="dark-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => { haptic(); router.back(); }}>
          <View style={styles.backCircle}>
            <Ionicons name="chevron-back" size={20} color={Colors.light.text} />
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>地图导览</Text>
        <View style={styles.backBtn} />
      </View>

      {/* ── Filter row ── */}
      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_TABS.map((key) => {
            const isActive = activeFilter === key;
            const catColor = key !== "全部" ? CATEGORY_COLORS[key as Exclude<FilterKey, "全部">].dot : Colors.light.primary;
            return (
              <Pressable
                key={key}
                style={[
                  styles.filterChip,
                  isActive && { backgroundColor: catColor, borderColor: catColor },
                ]}
                onPress={() => { haptic(); setActiveFilter(key); setSelectedPoi(null); }}
              >
                {key !== "全部" && (
                  <Text style={styles.filterEmoji}>
                    {key === "建筑" ? "🏛️" : key === "展览" ? "🖼️" : key === "美食" ? "🍽️" : key === "特产" ? "🎁" : "🚻"}
                  </Text>
                )}
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{key}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Location bar ── */}
      <View style={styles.locationBar}>
        <View style={styles.locationLeft}>
          <View style={styles.locationDot} />
          <Text style={styles.locationText}>当前位置：</Text>
          <Text style={styles.locationName}>香花村口</Text>
        </View>
        <View style={styles.locationRight}>
          <Ionicons name="navigate" size={12} color={Colors.light.primary} />
          <Text style={styles.locationAccuracy}>定位精度 ±30m</Text>
        </View>
      </View>

      {/* ── Map ── */}
      <View style={styles.mapContainer}>
        <ScrollView scrollEnabled showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
          <IllustratedMap
            activeFilter={activeFilter}
            mapW={mapW}
            mapH={mapH}
            selectedPoi={selectedPoi}
            onPoiPress={setSelectedPoi}
          />
        </ScrollView>

        {/* Zoom */}
        <View style={styles.zoomBox}>
          <Pressable style={styles.zoomBtn} onPress={() => haptic()}>
            <Ionicons name="add" size={20} color={Colors.light.text} />
          </Pressable>
          <View style={styles.zoomLine} />
          <Pressable style={styles.zoomBtn} onPress={() => haptic()}>
            <Ionicons name="remove" size={20} color={Colors.light.text} />
          </Pressable>
        </View>

        {/* POI popup */}
        {selectedPoi && (
          <Pressable style={styles.poiPopupOuter} onPress={() => setSelectedPoi(null)}>
            <View style={styles.poiPopup} onStartShouldSetResponder={() => true}>
              <View style={[styles.poiPopupIcon, { backgroundColor: CATEGORY_COLORS[selectedPoi.category].bg }]}>
                <Text style={{ fontSize: 22 }}>{selectedPoi.emoji}</Text>
              </View>
              <View style={styles.poiPopupBody}>
                <Text style={styles.poiPopupName}>{selectedPoi.label}</Text>
                <Text style={styles.poiPopupDesc}>{selectedPoi.desc}</Text>
                <View style={[styles.poiPopupTag, { backgroundColor: CATEGORY_COLORS[selectedPoi.category].bg }]}>
                  <Text style={[styles.poiPopupTagText, { color: CATEGORY_COLORS[selectedPoi.category].text }]}>
                    {selectedPoi.category}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.poiPopupNav}
                onPress={() => { haptic(); setSelectedPoi(null); }}
              >
                <Ionicons name="navigate" size={16} color="#fff" />
              </Pressable>
            </View>
          </Pressable>
        )}
      </View>

      {/* ── Route button ── */}
      <View style={[styles.routeBtnArea, { paddingBottom: bottomPad + 12 }]}>
        <Pressable style={styles.routeBtn} onPress={openSheet}>
          <LinearGradient
            colors={["#8B5E3C", "#6B4228"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.routeBtnGradient}
          >
            <MaterialCommunityIcons name="map-marker-path" size={20} color="#fff" />
            <Text style={styles.routeBtnText}>游览路线</Text>
            <View style={styles.routeBtnBadge}>
              <Text style={styles.routeBtnBadgeText}>{ROUTES.length}</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </View>

      {/* ── Route Bottom Sheet ── */}
      {sheetOpen && (
        <>
          <Pressable style={styles.sheetOverlay} onPress={closeSheet} />
          <Animated.View
            style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}
          >
            {/* Sheet header gradient */}
            <LinearGradient
              colors={["#8B5E3C", "#6B4228"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sheetHeaderGrad}
            >
              <View style={styles.sheetHandleWrap}>
                <View style={styles.sheetHandleLight} />
              </View>
              <View style={styles.sheetHeaderRow}>
                <View>
                  <Text style={styles.sheetTitleWhite}>游览路线</Text>
                  <Text style={styles.sheetSubWhite}>为你推荐 {ROUTES.length} 条游览路线</Text>
                </View>
                <Pressable style={styles.sheetCloseBtn} onPress={closeSheet}>
                  <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
                </Pressable>
              </View>
            </LinearGradient>

            <ScrollView
              style={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: bottomPad + 100, paddingTop: 12 }}
            >
              {ROUTES.map((route) => (
                <Pressable
                  key={route.id}
                  style={({ pressed }) => [styles.routeCard, pressed && styles.routeCardPressed]}
                  onPress={() => { haptic("medium"); closeSheet(); }}
                >
                  <View style={[styles.routeCardTop, { backgroundColor: route.accent }]}>
                    <View style={styles.routeCardTopLeft}>
                      <Text style={styles.routeCardIcon}>{route.icon}</Text>
                      <View style={styles.routeCardTitleWrap}>
                        <Text style={styles.routeCardTitle}>{route.title}</Text>
                        <Text style={styles.routeCardDesc}>{route.desc}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.routeCardBottom}>
                    <View style={styles.routeCardStats}>
                      <View style={styles.routeStat}>
                        <Ionicons name="business-outline" size={13} color={Colors.light.textSecondary} />
                        <Text style={styles.routeStatText}>{route.buildings}个景点</Text>
                      </View>
                      <View style={styles.routeStatDivider} />
                      <View style={styles.routeStat}>
                        <Ionicons name="footsteps-outline" size={13} color={Colors.light.textSecondary} />
                        <Text style={styles.routeStatText}>{route.distance}公里</Text>
                      </View>
                      <View style={styles.routeStatDivider} />
                      <View style={styles.routeStat}>
                        <Ionicons name="time-outline" size={13} color={Colors.light.textSecondary} />
                        <Text style={styles.routeStatText}>{route.duration}</Text>
                      </View>
                    </View>
                    <View style={styles.routeCardTagRow}>
                      {route.tags.map((t) => (
                        <View key={t} style={[styles.routeTag, { backgroundColor: route.color + "18" }]}>
                          <Text style={[styles.routeTagText, { color: route.color }]}>{t}</Text>
                        </View>
                      ))}
                    </View>
                    <Pressable
                      style={[styles.startBtn, { backgroundColor: route.color }]}
                      onPress={() => { haptic("medium"); closeSheet(); }}
                    >
                      <Ionicons name="play" size={14} color="#fff" />
                      <Text style={styles.startBtnText}>开始游览</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            {/* Sheet footer */}
            <View style={[styles.sheetFooter, { paddingBottom: bottomPad + 16 }]}>
              <Text style={styles.sheetFooterLabel}>没有合适的路线？</Text>
              <View style={styles.sheetFooterBtns}>
                <Pressable
                  style={styles.createBtn}
                  onPress={() => { haptic(); closeSheet(); }}
                >
                  <Ionicons name="add-circle-outline" size={16} color={Colors.light.text} />
                  <Text style={styles.createBtnText}>创建我的行程</Text>
                </Pressable>
                <Pressable
                  style={styles.aiBtn}
                  onPress={() => { haptic("medium"); setAiModalVisible(true); }}
                >
                  <LinearGradient
                    colors={[Colors.light.primary, Colors.light.primaryLight]}
                    style={styles.aiBtnGrad}
                  >
                    <Text style={styles.aiBtnText}>✨ AI</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </>
      )}

      {/* ── AI Modal ── */}
      <Modal visible={aiModalVisible} transparent animationType="slide" onRequestClose={() => { setAiModalVisible(false); setAiResponse(""); setAiQuery(""); }}>
        <View style={styles.aiOverlay}>
          <View style={[styles.aiModal, { paddingBottom: bottomPad + 20 }]}>
            <LinearGradient colors={[Colors.light.primary, "#2D8A55"]} style={styles.aiModalHeader}>
              <View>
                <Text style={styles.aiModalTitle}>✨ AI 智能路线规划</Text>
                <Text style={styles.aiModalSub}>描述你的偏好，AI 为你定制专属路线</Text>
              </View>
              <Pressable onPress={() => { setAiModalVisible(false); setAiResponse(""); setAiQuery(""); }}>
                <Ionicons name="close-circle" size={26} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </LinearGradient>

            <View style={styles.aiBody}>
              <TextInput
                style={styles.aiInput}
                placeholder="例如：我喜欢建筑历史，时间大概2小时..."
                placeholderTextColor={Colors.light.textSecondary}
                value={aiQuery}
                onChangeText={setAiQuery}
                multiline
                numberOfLines={3}
              />
              <Pressable
                style={[styles.aiSubmit, (!aiQuery.trim() || aiLoading) && styles.aiSubmitDisabled]}
                onPress={handleAiSubmit}
              >
                {aiLoading ? (
                  <Text style={styles.aiSubmitText}>🤔 AI 思考中...</Text>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#fff" />
                    <Text style={styles.aiSubmitText}>生成专属路线</Text>
                  </>
                )}
              </Pressable>

              {aiResponse ? (
                <View style={styles.aiResult}>
                  <View style={styles.aiResultHeader}>
                    <Text style={styles.aiResultTitle}>🎉 已为您规划路线</Text>
                  </View>
                  <Text style={styles.aiResultText}>{aiResponse}</Text>
                  <Pressable
                    style={styles.aiUseBtn}
                    onPress={() => { haptic("medium"); setAiModalVisible(false); setAiResponse(""); setAiQuery(""); }}
                  >
                    <Text style={styles.aiUseBtnText}>使用此路线出发</Text>
                    <Ionicons name="arrow-forward-circle" size={18} color="#fff" />
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F0E8" },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EAEAEA",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backCircle: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "#F5F5F5",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: Colors.light.text },

  // Filter
  filterWrap: { backgroundColor: "#fff", paddingBottom: 2 },
  filterRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#F2F2F5", borderWidth: 1.5, borderColor: "transparent",
  },
  filterEmoji: { fontSize: 13 },
  filterText: { fontSize: 13, fontWeight: "500", color: Colors.light.textSecondary },
  filterTextActive: { color: "#fff", fontWeight: "700" },

  // Location bar
  locationBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: "#fff", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EAEAEA",
  },
  locationLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.light.primary },
  locationText: { fontSize: 12, color: Colors.light.textSecondary },
  locationName: { fontSize: 13, fontWeight: "600", color: Colors.light.text },
  locationRight: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationAccuracy: { fontSize: 11, color: Colors.light.textSecondary },

  // Map
  mapContainer: { flex: 1, overflow: "hidden" },
  islandBlob: {
    position: "absolute", backgroundColor: "#58C4B8", borderRadius: 999,
  },
  islandInner: {
    position: "absolute", backgroundColor: "#66CBB8",
    borderRadius: 999, opacity: 0.8,
  },
  road: {
    position: "absolute", backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8, zIndex: 1,
  },
  roadBorder: {
    position: "absolute", backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 10, zIndex: 0,
  },
  treeEmoji: { position: "absolute", fontSize: 16, zIndex: 2 },
  pond: {
    position: "absolute", backgroundColor: "#2BA0C8",
    borderRadius: 999, opacity: 0.6, zIndex: 2,
  },

  // POI
  poiWrap: { position: "absolute", alignItems: "center", zIndex: 10 },
  poiBubble: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
  poiEmoji: { fontSize: 20 },
  poiTag: {
    maxWidth: 68, paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 6, marginTop: 2, alignItems: "center",
  },
  poiTagText: { fontSize: 9.5, fontWeight: "600" },
  poiPin: { width: 5, height: 5, borderRadius: 2.5, marginTop: 2 },

  // My location
  myLocWrap: { position: "absolute", zIndex: 12, alignItems: "center", justifyContent: "center" },
  myLocPulse: {
    position: "absolute", width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(61, 170, 111, 0.25)", borderWidth: 1.5, borderColor: "rgba(61,170,111,0.5)",
  },
  myLocDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.light.primary, borderWidth: 2.5, borderColor: "#fff",
    shadowColor: Colors.light.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 6,
  },

  // Zoom
  zoomBox: {
    position: "absolute", right: 14, bottom: 90,
    backgroundColor: "#fff", borderRadius: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5,
    overflow: "hidden",
  },
  zoomBtn: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  zoomLine: { height: StyleSheet.hairlineWidth, backgroundColor: "#E0E0E0", marginHorizontal: 8 },

  // POI popup
  poiPopupOuter: { position: "absolute", bottom: 16, left: 16, right: 16 },
  poiPopup: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 20, padding: 14, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
  },
  poiPopupIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  poiPopupBody: { flex: 1 },
  poiPopupName: { fontSize: 15, fontWeight: "700", color: Colors.light.text, marginBottom: 2 },
  poiPopupDesc: { fontSize: 12, color: Colors.light.textSecondary, marginBottom: 6 },
  poiPopupTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: "flex-start" },
  poiPopupTagText: { fontSize: 11, fontWeight: "600" },
  poiPopupNav: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.light.primary, alignItems: "center", justifyContent: "center",
  },

  // Route button area
  routeBtnArea: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 8,
  },
  routeBtn: { borderRadius: 28, overflow: "hidden", shadowColor: "#8B5E3C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  routeBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15 },
  routeBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  routeBtnBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center",
  },
  routeBtnBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  // Sheet
  sheetOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SHEET_FULL,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 20,
    overflow: "hidden",
  },
  sheetHeaderGrad: { paddingHorizontal: 20, paddingBottom: 18, paddingTop: 6 },
  sheetHandleWrap: { alignItems: "center", paddingVertical: 8 },
  sheetHandleLight: { width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.4)" },
  sheetHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  sheetTitleWhite: { fontSize: 20, fontWeight: "800", color: "#fff" },
  sheetSubWhite: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  sheetCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  sheetScroll: { flex: 1 },

  // Route card
  routeCard: {
    marginHorizontal: 16, marginVertical: 6,
    borderRadius: 18, backgroundColor: "#fff", overflow: "hidden",
    borderWidth: 1, borderColor: "#F0F0EC",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  routeCardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  routeCardTop: { padding: 16, flexDirection: "row", alignItems: "flex-start" },
  routeCardTopLeft: { flexDirection: "row", gap: 12, flex: 1 },
  routeCardIcon: { fontSize: 28, marginTop: 2 },
  routeCardTitleWrap: { flex: 1 },
  routeCardTitle: { fontSize: 15, fontWeight: "700", color: Colors.light.text, marginBottom: 4 },
  routeCardDesc: { fontSize: 12, color: Colors.light.textSecondary, lineHeight: 17 },
  routeCardBottom: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  routeCardStats: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeStatText: { fontSize: 12, color: Colors.light.textSecondary },
  routeStatDivider: { width: 1, height: 12, backgroundColor: "#E0E0E0" },
  routeCardTagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  routeTag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  routeTagText: { fontSize: 11, fontWeight: "600" },
  startBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 14,
  },
  startBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // Sheet footer
  sheetFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#F0F0F0",
    backgroundColor: "#fff",
  },
  sheetFooterLabel: { fontSize: 13, color: Colors.light.textSecondary },
  sheetFooterBtns: { flexDirection: "row", gap: 8, alignItems: "center" },
  createBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: "#F2F2F5",
  },
  createBtnText: { fontSize: 13, fontWeight: "600", color: Colors.light.text },
  aiBtn: { borderRadius: 20, overflow: "hidden" },
  aiBtnGrad: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  aiBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // AI Modal
  aiOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  aiModal: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  aiModalHeader: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    padding: 22, paddingTop: 24,
  },
  aiModalTitle: { fontSize: 19, fontWeight: "800", color: "#fff" },
  aiModalSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 3 },
  aiBody: { padding: 20, gap: 14 },
  aiInput: {
    backgroundColor: "#F8F8FA", borderRadius: 14, padding: 14,
    fontSize: 14, color: Colors.light.text, minHeight: 88, textAlignVertical: "top",
    borderWidth: 1.5, borderColor: "#EAEAF0",
  },
  aiSubmit: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.light.primary, paddingVertical: 14,
    borderRadius: 16,
  },
  aiSubmitDisabled: { opacity: 0.55 },
  aiSubmitText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  aiResult: {
    backgroundColor: "#F0FFF6", borderRadius: 16,
    borderLeftWidth: 3, borderLeftColor: Colors.light.primary,
    overflow: "hidden",
  },
  aiResultHeader: { backgroundColor: Colors.light.primary + "18", paddingHorizontal: 16, paddingVertical: 10 },
  aiResultTitle: { fontSize: 14, fontWeight: "700", color: Colors.light.primary },
  aiResultText: { fontSize: 13, color: Colors.light.text, lineHeight: 22, padding: 16 },
  aiUseBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: Colors.light.primary, paddingVertical: 13,
    marginHorizontal: 16, marginBottom: 16, borderRadius: 14,
  },
  aiUseBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
