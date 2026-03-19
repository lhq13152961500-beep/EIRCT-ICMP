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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MAP_HEIGHT = SCREEN_HEIGHT * 0.62;
const SHEET_COLLAPSED = 0;
const SHEET_PEEK = 320;
const SHEET_FULL = SCREEN_HEIGHT * 0.72;

const haptic = (style: "light" | "medium" = "light") => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(
      style === "medium"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    );
  }
};

type FilterKey = "建筑" | "展览" | "美食" | "特产" | "卫生间";

interface PoiItem {
  id: string;
  label: string;
  emoji: string;
  category: FilterKey;
  x: number;
  y: number;
}

const POI_ITEMS: PoiItem[] = [
  { id: "1",  label: "风车坊",   emoji: "🏗️", category: "建筑", x: 0.15, y: 0.12 },
  { id: "2",  label: "古戏台",   emoji: "🏛️", category: "建筑", x: 0.60, y: 0.08 },
  { id: "3",  label: "祠堂",     emoji: "🏠", category: "建筑", x: 0.72, y: 0.25 },
  { id: "4",  label: "碉楼",     emoji: "🗼", category: "建筑", x: 0.08, y: 0.44 },
  { id: "5",  label: "法式展",   emoji: "🖼️", category: "展览", x: 0.55, y: 0.18 },
  { id: "6",  label: "非遗展",   emoji: "🎨", category: "展览", x: 0.35, y: 0.52 },
  { id: "7",  label: "法棍店",   emoji: "🥖", category: "美食", x: 0.42, y: 0.20 },
  { id: "8",  label: "甜品铺",   emoji: "🍰", category: "美食", x: 0.62, y: 0.48 },
  { id: "9",  label: "奶酪坊",   emoji: "🧀", category: "美食", x: 0.18, y: 0.40 },
  { id: "10", label: "咖啡屋",   emoji: "☕", category: "美食", x: 0.22, y: 0.62 },
  { id: "11", label: "苹果园",   emoji: "🍎", category: "特产", x: 0.70, y: 0.60 },
  { id: "12", label: "竹编坊",   emoji: "🎋", category: "特产", x: 0.48, y: 0.72 },
  { id: "13", label: "卫生间",   emoji: "🚻", category: "卫生间", x: 0.82, y: 0.40 },
  { id: "14", label: "卫生间",   emoji: "🚻", category: "卫生间", x: 0.30, y: 0.82 },
];

const FILTER_TABS: FilterKey[] = ["建筑", "展览", "美食", "特产", "卫生间"];

interface RouteItem {
  id: string;
  title: string;
  desc: string;
  buildings: number;
  distance: string;
  color: string;
  duration: string;
}

const ROUTES: RouteItem[] = [
  {
    id: "1",
    title: "快速游览推荐路线",
    desc: "涵盖核心建筑与美食，适合半日游",
    buildings: 12,
    distance: "2.3",
    duration: "约2小时",
    color: "#F5974E",
  },
  {
    id: "2",
    title: "深度游览推荐路线",
    desc: "深入了解历史文化，适合全日游",
    buildings: 17,
    distance: "3.5",
    duration: "约4小时",
    color: "#3DAA6F",
  },
  {
    id: "3",
    title: "温馨赏花路线",
    desc: "春季限定，沿途花海如画",
    buildings: 6,
    distance: "10.2",
    duration: "约3小时",
    color: "#9B8EC4",
  },
];

function PoiMarker({
  item,
  mapW,
  mapH,
  onPress,
}: {
  item: PoiItem;
  mapW: number;
  mapH: number;
  onPress: (item: PoiItem) => void;
}) {
  return (
    <Pressable
      style={[
        styles.poiMarker,
        {
          left: item.x * mapW - 22,
          top: item.y * mapH - 36,
        },
      ]}
      onPress={() => { haptic(); onPress(item); }}
    >
      <View style={styles.poiEmojiBubble}>
        <Text style={styles.poiEmoji}>{item.emoji}</Text>
      </View>
      <View style={styles.poiLabelBubble}>
        <Text style={styles.poiLabel}>{item.label}</Text>
      </View>
      <View style={styles.poiDot} />
    </Pressable>
  );
}

function IllustratedMap({
  activeFilter,
  mapW,
  mapH,
  onPoiPress,
}: {
  activeFilter: FilterKey | null;
  mapW: number;
  mapH: number;
  onPoiPress: (item: PoiItem) => void;
}) {
  const visiblePois = POI_ITEMS.filter(
    (p) => activeFilter === null || p.category === activeFilter
  );

  return (
    <View style={[styles.mapCanvas, { width: mapW, height: mapH }]}>
      {/* Map background */}
      <View style={[styles.mapBg, { width: mapW, height: mapH }]}>
        {/* Island shape using border radius trick */}
        <View style={styles.islandShape} />

        {/* Roads */}
        <View style={[styles.road, { top: "30%", left: "10%", width: "55%", height: 8, transform: [{ rotate: "-8deg" }] }]} />
        <View style={[styles.road, { top: "45%", left: "30%", width: "50%", height: 8, transform: [{ rotate: "5deg" }] }]} />
        <View style={[styles.road, { top: "60%", left: "15%", width: "60%", height: 8, transform: [{ rotate: "-3deg" }] }]} />
        <View style={[styles.road, { top: "20%", left: "40%", width: 8, height: "45%", transform: [{ rotate: "8deg" }] }]} />
        <View style={[styles.road, { top: "35%", left: "65%", width: 8, height: "30%", transform: [{ rotate: "-5deg" }] }]} />

        {/* Tree decorations */}
        {[
          [0.28, 0.09], [0.38, 0.06], [0.80, 0.12], [0.06, 0.28],
          [0.52, 0.38], [0.44, 0.58], [0.76, 0.72], [0.12, 0.75],
          [0.60, 0.82], [0.88, 0.55],
        ].map(([x, y], i) => (
          <Text
            key={i}
            style={[styles.treeEmoji, { left: x * mapW, top: y * mapH }]}
          >
            🌳
          </Text>
        ))}
      </View>

      {/* POI Markers */}
      {visiblePois.map((poi) => (
        <PoiMarker
          key={poi.id}
          item={poi}
          mapW={mapW}
          mapH={mapH}
          onPress={onPoiPress}
        />
      ))}
    </View>
  );
}

function RouteCard({ route, onStart }: { route: RouteItem; onStart: () => void }) {
  return (
    <View style={styles.routeCard}>
      <View style={styles.routeCardLeft}>
        <View style={[styles.routeColorBar, { backgroundColor: route.color }]} />
        <View style={styles.routeCardInfo}>
          <Text style={styles.routeCardTitle}>{route.title}</Text>
          <Text style={styles.routeCardDesc}>{route.desc}</Text>
          <Text style={styles.routeCardMeta}>
            {route.buildings}座建筑 · 全程{route.distance}公里 · {route.duration}
          </Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.startBtn,
          { backgroundColor: route.color },
          pressed && styles.startBtnPressed,
        ]}
        onPress={() => { haptic("medium"); onStart(); }}
      >
        <Text style={styles.startBtnText}>开始游览</Text>
      </Pressable>
    </View>
  );
}

export default function MapGuideScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 0 : insets.bottom;

  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selectedPoi, setSelectedPoi] = useState<PoiItem | null>(null);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");

  const sheetAnim = useRef(new Animated.Value(0)).current;
  const sheetScrollRef = useRef<ScrollView>(null);

  const mapW = SCREEN_WIDTH;
  const mapH = MAP_HEIGHT * zoom;

  const openSheet = useCallback(() => {
    haptic("medium");
    setSheetOpen(true);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  }, [sheetAnim]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 260,
      useNativeDriver: false,
    }).start(() => setSheetOpen(false));
  }, [sheetAnim]);

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_PEEK + 60, 0],
  });

  const handleFilterPress = (key: FilterKey) => {
    haptic();
    setActiveFilter((prev) => (prev === key ? null : key));
  };

  const handleZoom = (delta: number) => {
    haptic();
    setZoom((z) => Math.min(2, Math.max(1, z + delta)));
  };

  const handleAiSubmit = () => {
    if (!aiQuery.trim()) return;
    setAiResponse(
      `根据您的需求"${aiQuery}"，为您规划以下路线：\n\n` +
      `📍 出发：村口广场\n` +
      `🏛️ 第一站：古戏台（约15分钟）\n` +
      `🥖 第二站：法棍店品尝特色（约20分钟）\n` +
      `🎨 第三站：非遗展览馆（约30分钟）\n` +
      `🍰 第四站：甜品铺休息（约20分钟）\n` +
      `🏠 终点：祠堂（约15分钟）\n\n` +
      `预计总耗时约1.5小时，全程约1.8公里。`
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => { haptic(); router.back(); }}>
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.headerTitle}>地图导览</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_TABS.map((key) => (
          <Pressable
            key={key}
            style={[
              styles.filterChip,
              activeFilter === key && styles.filterChipActive,
            ]}
            onPress={() => handleFilterPress(key)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === key && styles.filterChipTextActive,
              ]}
            >
              {key}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Current location bar */}
      <View style={styles.locationBar}>
        <Ionicons name="navigate" size={14} color={Colors.light.primary} />
        <Text style={styles.locationText}>当前位置：香花村口</Text>
      </View>

      {/* Map area */}
      <View style={styles.mapContainer}>
        <ScrollView
          scrollEnabled
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <IllustratedMap
            activeFilter={activeFilter}
            mapW={mapW}
            mapH={mapH}
            onPoiPress={setSelectedPoi}
          />
        </ScrollView>

        {/* Zoom controls */}
        <View style={styles.zoomControls}>
          <Pressable style={styles.zoomBtn} onPress={() => handleZoom(0.2)}>
            <Text style={styles.zoomBtnText}>+</Text>
          </Pressable>
          <View style={styles.zoomDivider} />
          <Pressable style={styles.zoomBtn} onPress={() => handleZoom(-0.2)}>
            <Text style={styles.zoomBtnText}>−</Text>
          </Pressable>
        </View>
      </View>

      {/* Route button */}
      <View style={[styles.routeBtnWrap, { paddingBottom: bottomPad + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.routeBtn, pressed && styles.routeBtnPressed]}
          onPress={openSheet}
        >
          <MaterialCommunityIcons name="map-marker-path" size={20} color="#fff" />
          <Text style={styles.routeBtnText}>游览路线</Text>
        </Pressable>
      </View>

      {/* POI detail popup */}
      {selectedPoi && (
        <Pressable style={styles.poiPopupOverlay} onPress={() => setSelectedPoi(null)}>
          <View style={styles.poiPopup}>
            <Text style={styles.poiPopupEmoji}>{selectedPoi.emoji}</Text>
            <View style={styles.poiPopupInfo}>
              <Text style={styles.poiPopupName}>{selectedPoi.label}</Text>
              <Text style={styles.poiPopupCategory}>{selectedPoi.category}</Text>
            </View>
            <Pressable style={styles.poiPopupClose} onPress={() => setSelectedPoi(null)}>
              <Ionicons name="close" size={16} color={Colors.light.textSecondary} />
            </Pressable>
          </View>
        </Pressable>
      )}

      {/* Route bottom sheet */}
      {sheetOpen && (
        <>
          <Pressable style={styles.sheetOverlay} onPress={closeSheet} />
          <Animated.View
            style={[
              styles.sheet,
              { bottom: 0, transform: [{ translateY: sheetTranslateY }] },
            ]}
          >
            {/* Sheet handle */}
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>游览路线</Text>
                <Text style={styles.sheetSubtitle}>推荐{ROUTES.length}条游览路线</Text>
              </View>
              <Pressable style={styles.sheetCloseBtn} onPress={closeSheet}>
                <Ionicons name="close" size={20} color={Colors.light.text} />
              </Pressable>
            </View>

            <ScrollView
              ref={sheetScrollRef}
              style={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
            >
              {ROUTES.map((route) => (
                <RouteCard key={route.id} route={route} onStart={closeSheet} />
              ))}
            </ScrollView>

            {/* Footer */}
            <View style={[styles.sheetFooter, { paddingBottom: bottomPad + 16 }]}>
              <Text style={styles.noRouteText}>没有合适的路线？</Text>
              <View style={styles.footerBtns}>
                <Pressable
                  style={styles.createTripBtn}
                  onPress={() => { haptic(); closeSheet(); }}
                >
                  <Text style={styles.createTripText}>创建我的行程</Text>
                </Pressable>
                <Pressable
                  style={styles.aiBtn}
                  onPress={() => { haptic("medium"); setAiModalVisible(true); }}
                >
                  <Text style={styles.aiBtnText}>AI</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </>
      )}

      {/* AI route modal */}
      <Modal
        visible={aiModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAiModalVisible(false)}
      >
        <View style={styles.aiModalOverlay}>
          <View style={[styles.aiModal, { paddingBottom: bottomPad + 16 }]}>
            <View style={styles.aiModalHeader}>
              <Text style={styles.aiModalTitle}>🤖 AI 智能规划路线</Text>
              <Pressable onPress={() => { setAiModalVisible(false); setAiResponse(""); setAiQuery(""); }}>
                <Ionicons name="close" size={22} color={Colors.light.text} />
              </Pressable>
            </View>
            <Text style={styles.aiModalDesc}>告诉 AI 你的偏好，它会为你定制专属路线</Text>

            <TextInput
              style={styles.aiInput}
              placeholder="例如：我想看古建筑，时间大概2小时..."
              placeholderTextColor={Colors.light.textSecondary}
              value={aiQuery}
              onChangeText={setAiQuery}
              multiline
              numberOfLines={3}
            />

            <Pressable
              style={[styles.aiSubmitBtn, !aiQuery.trim() && styles.aiSubmitBtnDisabled]}
              onPress={handleAiSubmit}
            >
              <Text style={styles.aiSubmitText}>生成路线</Text>
            </Pressable>

            {aiResponse ? (
              <View style={styles.aiResponseBox}>
                <Text style={styles.aiResponseText}>{aiResponse}</Text>
                <Pressable
                  style={styles.aiUseBtn}
                  onPress={() => { haptic("medium"); setAiModalVisible(false); setAiResponse(""); setAiQuery(""); }}
                >
                  <Text style={styles.aiUseBtnText}>使用此路线</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F5",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: Colors.light.text,
  },
  headerRight: {
    width: 36,
  },
  filterScroll: {
    backgroundColor: "#fff",
    maxHeight: 52,
  },
  filterRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F0F0F5",
  },
  filterChipActive: {
    backgroundColor: Colors.light.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.light.textSecondary,
  },
  filterChipTextActive: {
    color: "#fff",
  },
  locationBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F5",
  },
  locationText: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: "500",
  },
  mapContainer: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  mapCanvas: {
    position: "relative",
    overflow: "hidden",
  },
  mapBg: {
    backgroundColor: "#5DC8C8",
    position: "relative",
    overflow: "hidden",
  },
  islandShape: {
    position: "absolute",
    top: "3%",
    left: "5%",
    right: "5%",
    bottom: "3%",
    backgroundColor: "#4AB8A8",
    borderRadius: 999,
    opacity: 0.6,
  },
  road: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 6,
  },
  treeEmoji: {
    position: "absolute",
    fontSize: 18,
  },
  poiMarker: {
    position: "absolute",
    alignItems: "center",
  },
  poiEmojiBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  poiEmoji: {
    fontSize: 20,
  },
  poiLabelBubble: {
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  poiLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.light.text,
  },
  poiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.primary,
    marginTop: 2,
  },
  zoomControls: {
    position: "absolute",
    right: 16,
    bottom: 80,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  zoomBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomBtnText: {
    fontSize: 22,
    fontWeight: "300",
    color: Colors.light.text,
  },
  zoomDivider: {
    height: 1,
    backgroundColor: "#E8E8EE",
    marginHorizontal: 6,
  },
  routeBtnWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 10,
    backgroundColor: "transparent",
  },
  routeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#8B5E3C",
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 32,
    shadowColor: "#8B5E3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  routeBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  routeBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  poiPopupOverlay: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 16,
  },
  poiPopup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
  },
  poiPopupEmoji: {
    fontSize: 28,
  },
  poiPopupInfo: {
    flex: 1,
    gap: 3,
  },
  poiPopupName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
  },
  poiPopupCategory: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  poiPopupClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F0F0F5",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SHEET_FULL,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDD",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F5",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F0F5",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetScroll: {
    flex: 1,
    paddingTop: 8,
  },
  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: "#FAFAF8",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F0F0EC",
    gap: 12,
  },
  routeCardLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  routeColorBar: {
    width: 4,
    height: "100%",
    minHeight: 60,
    borderRadius: 2,
  },
  routeCardInfo: {
    flex: 1,
    gap: 4,
  },
  routeCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.text,
  },
  routeCardDesc: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 17,
  },
  routeCardMeta: {
    fontSize: 11,
    color: Colors.light.textLight,
    marginTop: 2,
  },
  startBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  startBtnPressed: {
    opacity: 0.85,
  },
  startBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  sheetFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F5",
    backgroundColor: "#fff",
  },
  noRouteText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  footerBtns: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  createTripBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F0F0F5",
  },
  createTripText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.text,
  },
  aiBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  aiBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  aiModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  aiModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 20,
  },
  aiModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  aiModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
  },
  aiModalDesc: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 16,
  },
  aiInput: {
    backgroundColor: "#F5F5F8",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: Colors.light.text,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  aiSubmitBtn: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  aiSubmitBtnDisabled: {
    opacity: 0.5,
  },
  aiSubmitText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  aiResponseBox: {
    backgroundColor: "#F0F8F4",
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.light.primary,
    gap: 12,
  },
  aiResponseText: {
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 20,
  },
  aiUseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.light.primary,
    paddingVertical: 11,
    borderRadius: 12,
  },
  aiUseBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
