"use no memo";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const BG       = "#F5EFE6";
const CARD_BG  = "#FFFFFF";
const ORANGE   = "#E07030";
const ORANGE_L = "#FFF3EB";
const TEXT1    = "#1A1A2E";
const TEXT2    = "#666880";
const TEXT3    = "#9B9BB0";
const BORDER   = "#F0EBE3";
const GOLD     = "#F5A623";

type ServiceType = "全部服务" | "文化讲解" | "手工艺体验" | "摄影预约";

const SERVICE_TYPES: ServiceType[] = ["全部服务", "文化讲解", "手工艺体验", "摄影预约"];

interface Guide {
  id: string;
  name: string;
  location: string;
  avatarBg: string;
  avatarInitial: string;
  isVerified: boolean;
  tags: { label: string; bg: string; color: string }[];
  serviceTypes: ServiceType[];
  rating: number;
  reviewCount: number;
  serviceCount: number;
  bio: string;
  priceMin: number;
  priceUnit: string;
}

const GUIDES: Guide[] = [
  {
    id: "1",
    name: "阿依古丽",
    location: "吐峪沟麻扎村",
    avatarBg: "#FDDCB5",
    avatarInitial: "阿",
    isVerified: true,
    tags: [
      { label: "维吾尔文化", bg: "#FFF0E8", color: "#E07030" },
      { label: "民俗讲解",   bg: "#E8F5EE", color: "#3A9060" },
      { label: "古村历史",   bg: "#E8EEFF", color: "#4060D0" },
    ],
    serviceTypes: ["文化讲解", "手工艺体验"],
    rating: 4.9,
    reviewCount: 112,
    serviceCount: 203,
    bio: "土生土长的吐峪沟村民，精通维吾尔族传统民俗与古村历史，带你走进千年洞窟民居，感受最真实的西域乡土生活。",
    priceMin: 88,
    priceUnit: "天",
  },
  {
    id: "2",
    name: "吐尔逊",
    location: "吐峪沟老街",
    avatarBg: "#C8E6C9",
    avatarInitial: "吐",
    isVerified: true,
    tags: [
      { label: "馕坑烤馕",   bg: "#FFF0E8", color: "#E07030" },
      { label: "传统手工艺", bg: "#F0E8FF", color: "#8050C0" },
      { label: "民居体验",   bg: "#E8F5EE", color: "#3A9060" },
    ],
    serviceTypes: ["手工艺体验", "文化讲解"],
    rating: 4.8,
    reviewCount: 78,
    serviceCount: 156,
    bio: "家中世代以制馕为业，手把手教你在传统馕坑中烤出金黄馕饼，还可体验葡萄干晾晒与土陶制作等非遗技艺。",
    priceMin: 68,
    priceUnit: "次",
  },
  {
    id: "3",
    name: "卡德尔·老爷爷",
    location: "吐峪沟北区",
    avatarBg: "#B3E5FC",
    avatarInitial: "卡",
    isVerified: true,
    tags: [
      { label: "故事传说", bg: "#E8EEFF", color: "#4060D0" },
      { label: "坎儿井文化", bg: "#E8F5EE", color: "#3A9060" },
      { label: "历史讲解",   bg: "#FFF0E8", color: "#E07030" },
    ],
    serviceTypes: ["文化讲解"],
    rating: 4.9,
    reviewCount: 54,
    serviceCount: 89,
    bio: "在吐峪沟生活了七十余年，亲历了古村的变迁，能讲述坎儿井灌溉、圣人麻扎朝圣等鲜为人知的百年故事。",
    priceMin: 60,
    priceUnit: "天",
  },
  {
    id: "4",
    name: "米日古丽",
    location: "吐峪沟景区",
    avatarBg: "#FFCDD2",
    avatarInitial: "米",
    isVerified: false,
    tags: [
      { label: "风光摄影",   bg: "#E8EEFF", color: "#4060D0" },
      { label: "葡萄沟采摘", bg: "#E8F5EE", color: "#3A9060" },
    ],
    serviceTypes: ["摄影预约"],
    rating: 4.7,
    reviewCount: 43,
    serviceCount: 67,
    bio: "擅长捕捉吐峪沟黄昏古巷与晨雾洞窟的光影之美，熟知景区最佳拍摄机位，为每位游客留下专属纪念影像。",
    priceMin: 80,
    priceUnit: "次",
  },
];

function StarRating({ rating }: { rating: number }) {
  const full    = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }).map((_, i) => {
        const name =
          i < full ? "star" : i === full && hasHalf ? "star-half" : "star-outline";
        return (
          <Ionicons key={i} name={name as any} size={13} color={GOLD} style={{ marginRight: 1 }} />
        );
      })}
    </View>
  );
}

export default function VillagerCompanionPage() {
  console.log("[VillagerCompanion] page mounted");
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;
  const [activeType, setActiveType] = useState<ServiceType>("全部服务");

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const filteredGuides =
    activeType === "全部服务"
      ? GUIDES
      : GUIDES.filter((g) => g.serviceTypes.includes(activeType));

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => { haptic(); router.back(); }}>
          <Ionicons name="chevron-back" size={24} color={TEXT1} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>村民伴游</Text>
          <Text style={styles.headerSub}>与在地村民深度连接</Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={haptic}>
          <Ionicons name="search-outline" size={22} color={TEXT1} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Service Type Tags ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagRow}
          style={styles.tagScroll}
        >
          {SERVICE_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => { haptic(); setActiveType(t); }}
              style={[styles.tag, activeType === t && styles.tagActive]}
            >
              <Text style={[styles.tagText, activeType === t && styles.tagTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Mission Banner ── */}
        <View style={styles.missionCard}>
          <View style={styles.missionIconWrap}>
            <Ionicons name="ribbon-outline" size={22} color={ORANGE} />
          </View>
          <View style={styles.missionTextWrap}>
            <Text style={styles.missionTitle}>赋能乡村文化传承者</Text>
            <Text style={styles.missionDesc}>
              每一位向导都经过严格认证，他们将生活智慧与文化记忆转化为独特的体验，在分享中实现文化自信与经济增收。
            </Text>
          </View>
        </View>

        {/* ── Guide Count ── */}
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            推荐向导 · <Text style={styles.countNum}>共 {filteredGuides.length} 位</Text>
          </Text>
        </View>

        {/* ── Guide Cards ── */}
        {filteredGuides.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={48} color={TEXT3} />
            <Text style={styles.emptyText}>暂无该类型向导</Text>
          </View>
        ) : (
          filteredGuides.map((guide) => (
            <View key={guide.id} style={styles.guideCard}>
              {/* Top row: avatar + basic info */}
              <View style={styles.guideTop}>
                <View style={[styles.avatar, { backgroundColor: guide.avatarBg }]}>
                  <Text style={styles.avatarText}>{guide.avatarInitial}</Text>
                </View>

                <View style={styles.guideInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.guideName}>{guide.name}</Text>
                    {guide.isVerified && (
                      <View style={styles.certBadge}>
                        <Ionicons name="checkmark-circle" size={13} color="#FFFFFF" />
                        <Text style={styles.certText}>已认证</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={12} color={TEXT3} />
                    <Text style={styles.locationText}>{guide.location}</Text>
                  </View>

                  <View style={styles.tagPills}>
                    {guide.tags.map((tag) => (
                      <View key={tag.label} style={[styles.pill, { backgroundColor: tag.bg }]}>
                        <Text style={[styles.pillText, { color: tag.color }]}>{tag.label}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.ratingRow}>
                    <StarRating rating={guide.rating} />
                    <Text style={styles.ratingNum}>{guide.rating}</Text>
                    <Text style={styles.reviewCount}>({guide.reviewCount})</Text>
                    <Text style={styles.separator}>·</Text>
                    <Text style={styles.serviceCount}>
                      已服务 <Text style={styles.serviceCountNum}>{guide.serviceCount}</Text> 次
                    </Text>
                  </View>
                </View>
              </View>

              {/* Bio */}
              <Text style={styles.guidebio} numberOfLines={2}>{guide.bio}</Text>

              {/* Bottom row: price + book */}
              <View style={styles.guideBottom}>
                <View>
                  <Text style={styles.priceLabel}>起价</Text>
                  <Text style={styles.price}>
                    <Text style={styles.priceSymbol}>¥</Text>
                    {guide.priceMin}
                    <Text style={styles.priceUnit}> /{guide.priceUnit}</Text>
                  </Text>
                </View>
                <Pressable style={styles.bookBtn} onPress={haptic}>
                  <Text style={styles.bookBtnText}>立即预约</Text>
                  <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          ))
        )}

        {/* ── 成为认证向导 CTA ── */}
        <LinearGradient colors={["#F07828", "#D05018"]} style={styles.ctaCard}>
          <View style={styles.ctaDeco1} />
          <View style={styles.ctaDeco2} />
          <Text style={styles.ctaTitle}>成为认证向导</Text>
          <Text style={styles.ctaSub}>用你的生活智慧创造价值</Text>
          <Text style={styles.ctaDesc}>
            将你对吐峪沟的了解变成独特的文化体验服务，经过认证后即可接单，在陪伴游客的同时获得稳定收益。
          </Text>
          <Pressable style={styles.ctaBtn} onPress={haptic}>
            <Ionicons name="person-add-outline" size={16} color={ORANGE} />
            <Text style={styles.ctaBtnText}>立刻申请</Text>
          </Pressable>
        </LinearGradient>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  headerCenter: { flex: 1, marginLeft: 4 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: TEXT1, letterSpacing: 0.3 },
  headerSub:   { fontSize: 12, color: TEXT2, marginTop: 1 },
  iconBtn:     { width: 36, height: 36, justifyContent: "center", alignItems: "center" },

  /* Scroll */
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  /* Tags */
  tagScroll: { marginBottom: 14 },
  tagRow:    { flexDirection: "row", gap: 8, paddingRight: 8 },
  tag:       { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER },
  tagActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  tagText:   { fontSize: 13, color: TEXT2, fontWeight: "500" },
  tagTextActive: { color: "#FFFFFF", fontWeight: "600" },

  /* Mission banner */
  missionCard:     { backgroundColor: ORANGE_L, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "flex-start", marginBottom: 18, borderWidth: 1, borderColor: "#F5D8C3" },
  missionIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", marginRight: 12, flexShrink: 0 },
  missionTextWrap: { flex: 1 },
  missionTitle:    { fontSize: 14, fontWeight: "700", color: TEXT1, marginBottom: 5 },
  missionDesc:     { fontSize: 12, color: TEXT2, lineHeight: 18 },

  /* Count row */
  countRow:  { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  countText: { fontSize: 13, color: TEXT2 },
  countNum:  { color: TEXT1, fontWeight: "600" },

  /* Guide card */
  guideCard: { backgroundColor: CARD_BG, borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  guideTop:  { flexDirection: "row", marginBottom: 10 },

  /* Avatar */
  avatar:     { width: 62, height: 62, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 12, flexShrink: 0 },
  avatarText: { fontSize: 24, fontWeight: "700", color: "#FFFFFF" },

  /* Guide info */
  guideInfo:    { flex: 1 },
  nameRow:      { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  guideName:    { fontSize: 16, fontWeight: "700", color: TEXT1 },
  certBadge:    { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#3DAA6F", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  certText:     { fontSize: 10, color: "#FFFFFF", fontWeight: "600" },
  locationRow:  { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 6 },
  locationText: { fontSize: 12, color: TEXT3 },
  tagPills:     { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 7 },
  pill:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillText:     { fontSize: 11, fontWeight: "500" },
  ratingRow:    { flexDirection: "row", alignItems: "center", gap: 3 },
  starRow:      { flexDirection: "row", alignItems: "center" },
  ratingNum:    { fontSize: 12, fontWeight: "700", color: GOLD },
  reviewCount:  { fontSize: 11, color: TEXT3 },
  separator:    { fontSize: 11, color: TEXT3, marginHorizontal: 2 },
  serviceCount:    { fontSize: 11, color: TEXT3 },
  serviceCountNum: { color: TEXT1, fontWeight: "600" },

  /* Bio */
  guidebio: { fontSize: 12, color: TEXT2, lineHeight: 18, marginBottom: 12, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },

  /* Bottom */
  guideBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  priceLabel:  { fontSize: 10, color: TEXT3, marginBottom: 1 },
  price:       { fontSize: 20, fontWeight: "800", color: ORANGE },
  priceSymbol: { fontSize: 13, fontWeight: "600" },
  priceUnit:   { fontSize: 12, fontWeight: "400", color: TEXT2 },
  bookBtn:     { flexDirection: "row", alignItems: "center", backgroundColor: ORANGE, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, gap: 2 },
  bookBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  /* CTA — gradient card */
  ctaCard:  { borderRadius: 22, padding: 22, marginTop: 8, overflow: "hidden" },
  ctaDeco1: { position: "absolute", top: -36, right: 36, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.13)" },
  ctaDeco2: { position: "absolute", bottom: -28, right: -24, width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.10)" },
  ctaTitle: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 3 },
  ctaSub:   { fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: "600", marginBottom: 10 },
  ctaDesc:  { fontSize: 12, color: "rgba(255,255,255,0.82)", lineHeight: 19, marginBottom: 18 },
  ctaBtn:   { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 22, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  ctaBtnText: { fontSize: 14, fontWeight: "700", color: ORANGE },

  /* Empty */
  emptyWrap: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14, color: TEXT3 },
});
