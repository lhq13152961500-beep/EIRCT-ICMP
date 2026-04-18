import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { setPendingCustomRoute } from "@/lib/itinerary-store";

const haptic = (style: "light" | "medium" = "light") => {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(
      style === "medium"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    );
  }
};

type FilterKey = "全部" | "建筑" | "展览" | "美食" | "特产";

interface PoiItem {
  id: string;
  name: string;
  emoji: string;
  category: Exclude<FilterKey, "全部">;
  desc: string;
  duration: number;
  distance: number;
}

const CATEGORY_COLORS: Record<Exclude<FilterKey, "全部">, { bg: string; dot: string; text: string }> = {
  建筑: { bg: "#FFF4E6", dot: "#E88A2E", text: "#B8681E" },
  展览: { bg: "#EEF2FF", dot: "#6B7FD4", text: "#4A5CB8" },
  美食: { bg: "#FFF0F0", dot: "#E8514A", text: "#C0392B" },
  特产: { bg: "#F0FFF4", dot: "#3DAA6F", text: "#2D8A55" },
};

const FILTER_TABS: FilterKey[] = ["全部", "建筑", "展览", "美食", "特产"];

const ALL_POIS: PoiItem[] = [
  { id: "1",  name: "景区入口大门", emoji: "🚪", category: "建筑", desc: "吐峪沟大峡谷景区正门，古朴石砌拱门", duration: 10, distance: 0 },
  { id: "2",  name: "麻扎村",       emoji: "🕌", category: "建筑", desc: "千年维吾尔族古村落，保留完整的生土建筑群", duration: 30, distance: 0.3 },
  { id: "3",  name: "吐峪沟清真寺", emoji: "⛩️", category: "建筑", desc: "历史悠久的伊斯兰建筑，精美木雕装饰", duration: 20, distance: 0.2 },
  { id: "4",  name: "千年洞窟",     emoji: "⛰️", category: "建筑", desc: "公元4世纪佛教石窟群，壁画保存完好", duration: 40, distance: 0.5 },
  { id: "5",  name: "古麻扎遗址",   emoji: "🏛️", category: "建筑", desc: "伊斯兰圣祠遗址，新疆最古老的麻扎之一", duration: 25, distance: 0.4 },
  { id: "12", name: "游客服务中心", emoji: "ℹ️",  category: "建筑", desc: "提供景区导览、租赁、急救等综合服务", duration: 10, distance: 0.1 },
  { id: "6",  name: "非遗文化馆",   emoji: "🎨", category: "展览", desc: "展示维吾尔族非遗，含木卡姆、都它尔等", duration: 45, distance: 0.2 },
  { id: "7",  name: "民俗体验馆",   emoji: "🖼️", category: "展览", desc: "传统手工艺展示与互动体验", duration: 35, distance: 0.2 },
  { id: "8",  name: "葡萄晾房",     emoji: "🍇", category: "特产", desc: "传统土坯晾房，秋季满室葡萄干香气", duration: 20, distance: 0.3 },
  { id: "9",  name: "特产集市",     emoji: "🎁", category: "特产", desc: "葡萄干、无花果、馕饼等吐峪沟特色农产品", duration: 30, distance: 0.2 },
  { id: "10", name: "烤馕馆",       emoji: "🫓", category: "美食", desc: "现烤坑炉馕饼，外脆内软，当地最具特色主食", duration: 20, distance: 0.1 },
  { id: "11", name: "瓜果长廊",     emoji: "🍈", category: "美食", desc: "种植哈密瓜、白杏等特色瓜果，可现场品尝", duration: 25, distance: 0.3 },
];

export default function CreateItineraryScreen() {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("全部");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredPois = activeFilter === "全部"
    ? ALL_POIS
    : ALL_POIS.filter(p => p.category === activeFilter);

  const selectedPois = selectedIds.map(id => ALL_POIS.find(p => p.id === id)!).filter(Boolean);

  const totalMinutes = selectedPois.reduce((s, p) => s + p.duration, 0);
  const totalDistance = selectedPois.reduce((s, p) => s + p.distance, 0);

  const togglePoi = useCallback((id: string) => {
    haptic();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    haptic();
    setSelectedIds(prev => {
      const arr = [...prev];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr;
    });
  }, []);

  const moveDown = useCallback((index: number) => {
    haptic();
    setSelectedIds(prev => {
      if (index >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      return arr;
    });
  }, []);

  const removePoi = useCallback((id: string) => {
    haptic();
    setSelectedIds(prev => prev.filter(x => x !== id));
  }, []);

  const handleStart = useCallback(() => {
    if (selectedIds.length === 0) return;
    haptic("medium");
    setPendingCustomRoute(selectedIds);
    router.back();
  }, [selectedIds]);

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `约${minutes}分钟`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `约${h}小时${m}分钟` : `约${h}小时`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={["#8B5E3C", "#6B4228"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <Pressable
          style={styles.backBtn}
          onPress={() => { haptic(); router.back(); }}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>创建我的行程</Text>
          <Text style={styles.headerSub}>选择景点，自由规划游览顺序</Text>
        </View>
        <View style={{ width: 38 }} />
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* Section 1: Select POIs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择景点</Text>
          <Text style={styles.sectionSub}>点击添加到你的行程</Text>

          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {FILTER_TABS.map(tab => (
              <Pressable
                key={tab}
                style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
                onPress={() => { haptic(); setActiveFilter(tab); }}
              >
                <Text style={[styles.filterTabText, activeFilter === tab && styles.filterTabTextActive]}>
                  {tab}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* POI List */}
          <View style={styles.poiList}>
            {filteredPois.map(poi => {
              const isSelected = selectedIds.includes(poi.id);
              const color = CATEGORY_COLORS[poi.category];
              return (
                <Pressable
                  key={poi.id}
                  style={({ pressed }) => [
                    styles.poiCard,
                    isSelected && styles.poiCardSelected,
                    pressed && styles.poiCardPressed,
                  ]}
                  onPress={() => togglePoi(poi.id)}
                >
                  <View style={[styles.poiEmojiBg, { backgroundColor: color.bg }]}>
                    <Text style={styles.poiEmoji}>{poi.emoji}</Text>
                  </View>
                  <View style={styles.poiBody}>
                    <Text style={styles.poiName}>{poi.name}</Text>
                    <Text style={styles.poiDesc} numberOfLines={1}>{poi.desc}</Text>
                    <View style={styles.poiMeta}>
                      <View style={[styles.poiTag, { backgroundColor: color.bg }]}>
                        <Text style={[styles.poiTagText, { color: color.text }]}>{poi.category}</Text>
                      </View>
                      <Text style={styles.poiDuration}>
                        <Ionicons name="time-outline" size={11} color={Colors.light.textSecondary} />
                        {" "}{poi.duration}分钟
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section 2: My Itinerary */}
        <View style={styles.section}>
          <View style={styles.itinHeader}>
            <Text style={styles.sectionTitle}>我的行程</Text>
            {selectedPois.length > 0 && (
              <Text style={styles.itinCount}>{selectedPois.length} 个景点</Text>
            )}
          </View>

          {selectedPois.length === 0 ? (
            <View style={styles.emptyItinerary}>
              <Text style={styles.emptyEmoji}>🗺️</Text>
              <Text style={styles.emptyText}>还没有选择景点</Text>
              <Text style={styles.emptySubText}>在上方勾选你感兴趣的景点</Text>
            </View>
          ) : (
            <View style={styles.itinList}>
              {selectedPois.map((poi, index) => (
                <View key={poi.id} style={styles.itinItem}>
                  {/* Route line connector */}
                  <View style={styles.itinLeft}>
                    <View style={styles.itinIndexBubble}>
                      <Text style={styles.itinIndexText}>{index + 1}</Text>
                    </View>
                    {index < selectedPois.length - 1 && (
                      <View style={styles.itinConnector} />
                    )}
                  </View>

                  <View style={styles.itinCardWrap}>
                    <View style={styles.itinCard}>
                      <Text style={styles.itinEmoji}>{poi.emoji}</Text>
                      <View style={styles.itinCardBody}>
                        <Text style={styles.itinCardName}>{poi.name}</Text>
                        <Text style={styles.itinCardDuration}>游览约 {poi.duration} 分钟</Text>
                      </View>
                      <View style={styles.itinActions}>
                        <Pressable
                          style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
                          onPress={() => moveUp(index)}
                          disabled={index === 0}
                        >
                          <Ionicons
                            name="chevron-up"
                            size={16}
                            color={index === 0 ? "#ccc" : Colors.light.textSecondary}
                          />
                        </Pressable>
                        <Pressable
                          style={[styles.arrowBtn, index === selectedPois.length - 1 && styles.arrowBtnDisabled]}
                          onPress={() => moveDown(index)}
                          disabled={index === selectedPois.length - 1}
                        >
                          <Ionicons
                            name="chevron-down"
                            size={16}
                            color={index === selectedPois.length - 1 ? "#ccc" : Colors.light.textSecondary}
                          />
                        </Pressable>
                        <Pressable
                          style={styles.removeBtn}
                          onPress={() => removePoi(poi.id)}
                        >
                          <Ionicons name="close" size={14} color="#E8514A" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {selectedPois.length > 0 && (
          <View style={styles.footerStats}>
            <View style={styles.footerStat}>
              <Ionicons name="location-outline" size={14} color={Colors.light.textSecondary} />
              <Text style={styles.footerStatText}>{selectedPois.length} 个景点</Text>
            </View>
            <View style={styles.footerDot} />
            <View style={styles.footerStat}>
              <Ionicons name="time-outline" size={14} color={Colors.light.textSecondary} />
              <Text style={styles.footerStatText}>{formatDuration(totalMinutes)}</Text>
            </View>
            <View style={styles.footerDot} />
            <View style={styles.footerStat}>
              <Ionicons name="footsteps-outline" size={14} color={Colors.light.textSecondary} />
              <Text style={styles.footerStatText}>{totalDistance.toFixed(1)} 公里</Text>
            </View>
          </View>
        )}
        <Pressable
          style={[styles.startBtn, selectedIds.length === 0 && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={selectedIds.length === 0}
        >
          <LinearGradient
            colors={selectedIds.length > 0 ? ["#E88A2E", "#C96F1A"] : ["#ccc", "#bbb"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startBtnGrad}
          >
            <Ionicons name="map-outline" size={18} color="#fff" />
            <Text style={styles.startBtnText}>
              {selectedIds.length === 0 ? "请先选择景点" : "生成路线，开始游览"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F5F0" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  scroll: { flex: 1 },

  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: Colors.light.text },
  sectionSub: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2, marginBottom: 12 },

  filterRow: { marginHorizontal: -16, marginBottom: 12 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#E8E0D5",
  },
  filterTabActive: { backgroundColor: "#8B5E3C", borderColor: "#8B5E3C" },
  filterTabText: { fontSize: 13, fontWeight: "600", color: Colors.light.textSecondary },
  filterTabTextActive: { color: "#fff" },

  poiList: { gap: 8 },
  poiCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#EEE8DF",
    gap: 10,
  },
  poiCardSelected: {
    borderColor: "#E88A2E",
    backgroundColor: "#FFFAF5",
  },
  poiCardPressed: { opacity: 0.85 },
  poiEmojiBg: {
    width: 44, height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  poiEmoji: { fontSize: 22 },
  poiBody: { flex: 1 },
  poiName: { fontSize: 14, fontWeight: "700", color: Colors.light.text, marginBottom: 2 },
  poiDesc: { fontSize: 11.5, color: Colors.light.textSecondary, marginBottom: 6 },
  poiMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  poiTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  poiTagText: { fontSize: 10.5, fontWeight: "600" },
  poiDuration: { fontSize: 11, color: Colors.light.textSecondary },
  checkCircle: {
    width: 24, height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#D0C8BE",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkCircleActive: { backgroundColor: "#E88A2E", borderColor: "#E88A2E" },

  itinHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  itinCount: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E88A2E",
    backgroundColor: "#FFF4E6",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },

  emptyItinerary: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#EEE8DF",
    borderStyle: "dashed",
  },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 14, fontWeight: "600", color: Colors.light.text },
  emptySubText: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 4 },

  itinList: { paddingTop: 8 },
  itinItem: { flexDirection: "row", gap: 8 },
  itinLeft: { alignItems: "center", width: 28 },
  itinIndexBubble: {
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: "#8B5E3C",
    alignItems: "center",
    justifyContent: "center",
  },
  itinIndexText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  itinConnector: {
    flex: 1,
    width: 2,
    backgroundColor: "#D9C9B5",
    marginVertical: 3,
    minHeight: 16,
  },
  itinCardWrap: { flex: 1, paddingBottom: 10 },
  itinCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEE8DF",
    gap: 10,
  },
  itinEmoji: { fontSize: 22, width: 30, textAlign: "center" },
  itinCardBody: { flex: 1 },
  itinCardName: { fontSize: 14, fontWeight: "700", color: Colors.light.text },
  itinCardDuration: { fontSize: 11.5, color: Colors.light.textSecondary, marginTop: 2 },
  itinActions: { flexDirection: "column", gap: 2, alignItems: "center" },
  arrowBtn: {
    width: 26, height: 26,
    borderRadius: 6,
    backgroundColor: "#F5F0EB",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowBtnDisabled: { backgroundColor: "#F5F5F5" },
  removeBtn: {
    width: 26, height: 26,
    borderRadius: 6,
    backgroundColor: "#FFF0F0",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  footer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEE8DF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  footerStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    gap: 8,
  },
  footerStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerStatText: { fontSize: 12.5, color: Colors.light.textSecondary, fontWeight: "500" },
  footerDot: {
    width: 3, height: 3,
    borderRadius: 1.5,
    backgroundColor: "#CCC",
  },
  startBtn: { borderRadius: 14, overflow: "hidden" },
  startBtnDisabled: { opacity: 0.7 },
  startBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  startBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
