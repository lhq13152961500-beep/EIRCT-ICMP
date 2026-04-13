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
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const BG      = "#F5EFE6";
const CARD_BG = "#FFFFFF";
const ORANGE  = "#E07030";
const ORANGE_L = "#FFF3EB";
const TEXT1   = "#1A1A2E";
const TEXT2   = "#666880";
const TEXT3   = "#9B9BB0";
const BORDER  = "#F0EBE3";
const GOLD    = "#F5A623";

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
    name: "李春花",
    location: "黄山古村",
    avatarBg: "#FDDCB5",
    avatarInitial: "李",
    isVerified: true,
    tags: [
      { label: "徽州文化", bg: "#FFF0E8", color: "#E07030" },
      { label: "传统手工艺", bg: "#E8F5EE", color: "#3A9060" },
      { label: "古建筑讲解", bg: "#E8EEFF", color: "#4060D0" },
    ],
    serviceTypes: ["文化讲解", "手工艺体验"],
    rating: 4.9,
    reviewCount: 128,
    serviceCount: 245,
    bio: "土生土长的徽州人，熟知每一处古宅背后的故事，擅长传统竹编与版画艺术，曾多次受邀参加非遗展演。",
    priceMin: 200,
    priceUnit: "天",
  },
  {
    id: "2",
    name: "王大山",
    location: "西江千户苗寨",
    avatarBg: "#C8E6C9",
    avatarInitial: "王",
    isVerified: true,
    tags: [
      { label: "苗族文化", bg: "#F0E8FF", color: "#8050C0" },
      { label: "民俗体验", bg: "#FFF0E8", color: "#E07030" },
      { label: "山野徒步", bg: "#E8F5EE", color: "#3A9060" },
    ],
    serviceTypes: ["文化讲解", "手工艺体验"],
    rating: 4.8,
    reviewCount: 96,
    serviceCount: 178,
    bio: "苗寨第八代传人，精通苗绣与银饰锻造，带你走进最真实的苗族生活，聆听千年歌谣。",
    priceMin: 180,
    priceUnit: "天",
  },
  {
    id: "3",
    name: "陈梅芳",
    location: "婺源篁岭",
    avatarBg: "#FFCDD2",
    avatarInitial: "陈",
    isVerified: true,
    tags: [
      { label: "风光摄影", bg: "#E8EEFF", color: "#4060D0" },
      { label: "茶文化", bg: "#E8F5EE", color: "#3A9060" },
      { label: "晒秋体验", bg: "#FFF0E8", color: "#E07030" },
    ],
    serviceTypes: ["摄影预约", "文化讲解"],
    rating: 4.7,
    reviewCount: 64,
    serviceCount: 92,
    bio: "深耕婺源摄影十年，精通晨雾梯田、晒秋民居等场景，为每位游客捕捉最美的乡村瞬间。",
    priceMin: 250,
    priceUnit: "次",
  },
  {
    id: "4",
    name: "张老汉",
    location: "乌镇西栅",
    avatarBg: "#B3E5FC",
    avatarInitial: "张",
    isVerified: false,
    tags: [
      { label: "水乡文化", bg: "#E8EEFF", color: "#4060D0" },
      { label: "历史故事", bg: "#FFF0E8", color: "#E07030" },
    ],
    serviceTypes: ["文化讲解"],
    rating: 4.6,
    reviewCount: 212,
    serviceCount: 320,
    bio: "在乌镇生活了六十余年，走过每一条石板路，讲得出每一座桥的前世今生。",
    priceMin: 150,
    priceUnit: "天",
  },
];

function StarRating({ rating }: { rating: number }) {
  const full  = Math.floor(rating);
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
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
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
          <Text style={styles.headerTitle}>真人伴游</Text>
          <Text style={styles.headerSub}>与在地村民深度连接</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.iconBtn} onPress={haptic}>
            <Ionicons name="search-outline" size={22} color={TEXT1} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={haptic}>
            <Ionicons name="options-outline" size={22} color={TEXT1} />
          </Pressable>
        </View>
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
              style={[
                styles.tag,
                activeType === t && styles.tagActive,
              ]}
            >
              <Text style={[styles.tagText, activeType === t && styles.tagTextActive]}>
                {t}
              </Text>
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
          <Pressable onPress={haptic} style={styles.mapBtn}>
            <Ionicons name="map-outline" size={14} color={ORANGE} />
            <Text style={styles.mapBtnText}>查看地图</Text>
          </Pressable>
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
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: guide.avatarBg }]}>
                  <Text style={styles.avatarText}>{guide.avatarInitial}</Text>
                </View>

                {/* Info */}
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

                  {/* Tags */}
                  <View style={styles.tagPills}>
                    {guide.tags.map((tag) => (
                      <View key={tag.label} style={[styles.pill, { backgroundColor: tag.bg }]}>
                        <Text style={[styles.pillText, { color: tag.color }]}>{tag.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Rating + service count */}
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
                <Pressable
                  style={styles.bookBtn}
                  onPress={() => { haptic(); }}
                >
                  <Text style={styles.bookBtnText}>立即预约</Text>
                  <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          ))
        )}

        {/* ── Become a Guide CTA ── */}
        <View style={styles.ctaCard}>
          <View style={styles.ctaLeft}>
            <View style={styles.ctaIconWrap}>
              <Ionicons name="person-add-outline" size={26} color={ORANGE} />
            </View>
            <View style={styles.ctaTextWrap}>
              <Text style={styles.ctaTitle}>成为认证向导</Text>
              <Text style={styles.ctaDesc}>将您的生活智慧变成可分享的服务</Text>
            </View>
          </View>
          <Pressable style={styles.ctaBtn} onPress={haptic}>
            <Text style={styles.ctaBtnText}>立即申请</Text>
          </Pressable>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT1,
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 12,
    color: TEXT2,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: "row",
    gap: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  /* Tags */
  tagScroll: {
    marginBottom: 14,
  },
  tagRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 8,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tagActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  tagText: {
    fontSize: 13,
    color: TEXT2,
    fontWeight: "500",
  },
  tagTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  /* Mission banner */
  missionCard: {
    backgroundColor: ORANGE_L,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#F5D8C3",
  },
  missionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  missionTextWrap: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT1,
    marginBottom: 5,
  },
  missionDesc: {
    fontSize: 12,
    color: TEXT2,
    lineHeight: 18,
  },

  /* Count row */
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  countText: {
    fontSize: 13,
    color: TEXT2,
  },
  countNum: {
    color: TEXT1,
    fontWeight: "600",
  },
  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  mapBtnText: {
    fontSize: 13,
    color: ORANGE,
    fontWeight: "500",
  },

  /* Guide card */
  guideCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  guideTop: {
    flexDirection: "row",
    marginBottom: 10,
  },

  /* Avatar */
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Guide info */
  guideInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  guideName: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT1,
  },
  certBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#3DAA6F",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  certText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 6,
  },
  locationText: {
    fontSize: 12,
    color: TEXT3,
  },
  tagPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 7,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "500",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingNum: {
    fontSize: 12,
    fontWeight: "700",
    color: GOLD,
  },
  reviewCount: {
    fontSize: 11,
    color: TEXT3,
  },
  separator: {
    fontSize: 11,
    color: TEXT3,
    marginHorizontal: 2,
  },
  serviceCount: {
    fontSize: 11,
    color: TEXT3,
  },
  serviceCountNum: {
    color: TEXT1,
    fontWeight: "600",
  },

  /* Bio */
  guidebio: {
    fontSize: 12,
    color: TEXT2,
    lineHeight: 18,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 10,
  },

  /* Bottom */
  guideBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 10,
    color: TEXT3,
    marginBottom: 1,
  },
  price: {
    fontSize: 20,
    fontWeight: "800",
    color: ORANGE,
  },
  priceSymbol: {
    fontSize: 13,
    fontWeight: "600",
  },
  priceUnit: {
    fontSize: 12,
    fontWeight: "400",
    color: TEXT2,
  },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ORANGE,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 2,
  },
  bookBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  /* CTA */
  ctaCard: {
    backgroundColor: "#FFF8F3",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#F5D8C3",
  },
  ctaLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  ctaIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: ORANGE_L,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  ctaTextWrap: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT1,
    marginBottom: 3,
  },
  ctaDesc: {
    fontSize: 12,
    color: TEXT2,
  },
  ctaBtn: {
    backgroundColor: ORANGE,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  ctaBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Empty */
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: TEXT3,
  },
});
