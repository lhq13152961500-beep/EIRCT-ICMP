"use no memo";
import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Platform, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

// ── Theme ────────────────────────────────────────────────────────────────────
const BG      = "#F5EFE6";
const CARD    = "#FFFFFF";
const ORANGE  = "#E07030";
const ORANGE_L = "#FFF0E8";
const TEXT1   = "#1A1A2E";
const TEXT2   = "#666880";
const TEXT3   = "#9B9BB0";
const BORDER  = "#F0EBE3";
const GOLD    = "#F5A623";
const GREEN   = "#3A9060";

// ── Types ────────────────────────────────────────────────────────────────────
type Screen = "main" | "all-hot" | "all-potential" | "store";

type Category = "全部" | "干果蜜饯" | "工艺手办" | "织物刺绣" | "美食特产" | "农产品";

interface Product {
  id: string;
  name: string;
  emoji: string;
  price: number;
  rating: number;
  sold: number;
  category: Exclude<Category, "全部">;
  storeId: string;
  isNew?: boolean;
}

interface Store {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  avatarBg: string;
  rating: number;
  reviewCount: number;
  monthlySales: number;
  productCount: number;
  rank: number;
  reviews: { user: string; avatar: string; stars: number; date: string; content: string }[];
}

// ── Data ─────────────────────────────────────────────────────────────────────
const CATEGORIES: Category[] = ["全部", "干果蜜饯", "工艺手办", "织物刺绣", "美食特产", "农产品"];

const HOT_PRODUCTS: Product[] = [
  { id: "h1",  name: "吐峪沟特级葡萄干",   emoji: "🍇", price: 68,  rating: 4.9, sold: 3218, category: "干果蜜饯", storeId: "s1" },
  { id: "h2",  name: "馕坑传统馕饼礼盒",   emoji: "🫓", price: 45,  rating: 4.8, sold: 2156, category: "美食特产", storeId: "s4" },
  { id: "h3",  name: "维吾尔手工刺绣包",   emoji: "👜", price: 188, rating: 4.9, sold: 1893, category: "织物刺绣", storeId: "s2" },
  { id: "h4",  name: "土陶花纹茶杯套装",   emoji: "🏺", price: 128, rating: 4.8, sold: 1654, category: "工艺手办", storeId: "s3" },
  { id: "h5",  name: "和田红枣特级礼盒",   emoji: "🍮", price: 88,  rating: 4.7, sold: 1432, category: "干果蜜饯", storeId: "s1" },
  { id: "h6",  name: "巴旦木原味500g",     emoji: "🥜", price: 58,  rating: 4.7, sold: 1376, category: "干果蜜饯", storeId: "s4" },
  { id: "h7",  name: "沙漠蜂巢蜂蜜",       emoji: "🍯", price: 98,  rating: 4.8, sold: 1298, category: "农产品",   storeId: "s5" },
  { id: "h8",  name: "手工羊毛地毯小件",   emoji: "🪆", price: 268, rating: 4.6, sold: 987,  category: "工艺手办", storeId: "s3" },
  { id: "h9",  name: "无花果干礼包",       emoji: "🍑", price: 52,  rating: 4.7, sold: 921,  category: "干果蜜饯", storeId: "s4" },
  { id: "h10", name: "维吾尔民族刺绣围巾", emoji: "🧣", price: 148, rating: 4.8, sold: 876,  category: "织物刺绣", storeId: "s2" },
  { id: "h11", name: "核桃仁精选礼盒",     emoji: "🫘", price: 72,  rating: 4.6, sold: 812,  category: "干果蜜饯", storeId: "s1" },
  { id: "h12", name: "桑葚干200g",         emoji: "🫐", price: 38,  rating: 4.5, sold: 754,  category: "干果蜜饯", storeId: "s4" },
  { id: "h13", name: "沙棘汁原浆礼盒",     emoji: "🧃", price: 118, rating: 4.7, sold: 698,  category: "美食特产", storeId: "s5" },
  { id: "h14", name: "民族风花帽",         emoji: "🎩", price: 158, rating: 4.8, sold: 643,  category: "工艺手办", storeId: "s2" },
  { id: "h15", name: "手工土陶酒壶",       emoji: "🫙", price: 198, rating: 4.9, sold: 589,  category: "工艺手办", storeId: "s3" },
];

const POTENTIAL_PRODUCTS: Product[] = [
  { id: "p1", name: "玫瑰花茶礼盒",       emoji: "🌹", price: 62,  rating: 4.6, sold: 234, category: "美食特产", storeId: "s5", isNew: true },
  { id: "p2", name: "手工织锦抱枕套",     emoji: "🛋️", price: 145, rating: 4.7, sold: 189, category: "织物刺绣", storeId: "s2", isNew: true },
  { id: "p3", name: "迷你土陶摆件",       emoji: "🏺", price: 88,  rating: 4.5, sold: 167, category: "工艺手办", storeId: "s3", isNew: true },
  { id: "p4", name: "沙漠玫瑰干花束",     emoji: "🌸", price: 55,  rating: 4.6, sold: 143, category: "农产品",   storeId: "s5", isNew: true },
  { id: "p5", name: "芝麻酱特色礼包",     emoji: "🥫", price: 42,  rating: 4.4, sold: 121, category: "美食特产", storeId: "s4", isNew: true },
  { id: "p6", name: "刺绣香囊挂件",       emoji: "🎀", price: 35,  rating: 4.5, sold: 98,  category: "织物刺绣", storeId: "s2", isNew: true },
  { id: "p7", name: "吐峪沟景区伴手礼",   emoji: "🎁", price: 128, rating: 4.7, sold: 87,  category: "工艺手办", storeId: "s3", isNew: true },
  { id: "p8", name: "驼毛保暖袜两双装",   emoji: "🧦", price: 68,  rating: 4.6, sold: 72,  category: "织物刺绣", storeId: "s2", isNew: true },
];

const STORES: Store[] = [
  {
    id: "s1", rank: 1,
    name: "吐峪沟葡萄干专卖", desc: "纯天然晾晒，百年传统工艺，每颗葡萄干都来自吐峪沟沙漠日晒",
    emoji: "🍇", avatarBg: "#7B3FA0",
    rating: 4.9, reviewCount: 2341, monthlySales: 12680, productCount: 8,
    reviews: [
      { user: "王", avatar: "#E07030", stars: 5, date: "2026-04-10", content: "葡萄干超甜，自然晒干的味道，包装也很精美，送礼很有面子！" },
      { user: "李", avatar: "#3A78E0", stars: 5, date: "2026-04-08", content: "正宗吐峪沟特产，买了好几次了，每次都很满意，强烈推荐！" },
      { user: "张", avatar: "#3A9060", stars: 4, date: "2026-04-05", content: "味道很好，就是快递有点慢，但品质完全在线。" },
    ],
  },
  {
    id: "s2", rank: 2,
    name: "维吾尔刺绣工坊", desc: "传承百年刺绣技艺，每件作品均为手工制作，独一无二",
    emoji: "🪡", avatarBg: "#D04080",
    rating: 4.8, reviewCount: 1923, monthlySales: 8934, productCount: 12,
    reviews: [
      { user: "陈", avatar: "#D04080", stars: 5, date: "2026-04-09", content: "刺绣包太漂亮了，做工精细，花纹真的很有民族特色，值得收藏！" },
      { user: "赵", avatar: "#E07030", stars: 5, date: "2026-04-07", content: "买了围巾和香囊，质量超好，手工细腻，会继续回购。" },
      { user: "钱", avatar: "#7B3FA0", stars: 5, date: "2026-04-03", content: "老板很热情，产品也非常有特色，旅游纪念品首选！" },
    ],
  },
  {
    id: "s3", rank: 3,
    name: "土陶艺术坊", desc: "吐峪沟非遗土陶制作，每件作品烧制于古窑，承载千年文化",
    emoji: "🏺", avatarBg: "#8B5020",
    rating: 4.8, reviewCount: 1456, monthlySales: 6723, productCount: 6,
    reviews: [
      { user: "孙", avatar: "#8B5020", stars: 5, date: "2026-04-11", content: "土陶茶杯太有质感了，用来泡茶特别有氛围，朋友也抢着要！" },
      { user: "周", avatar: "#3A9060", stars: 4, date: "2026-04-06", content: "工艺很好，就是有一个地方略有瑕疵，但瑕不掩瑜，整体很满意。" },
      { user: "吴", avatar: "#E07030", stars: 5, date: "2026-04-02", content: "老师傅亲手制作，有灵魂的作品，买回去摆在书架上超好看。" },
    ],
  },
  {
    id: "s4", rank: 4,
    name: "古道干果铺", desc: "丝路古道上的干果宝库，精选吐峪沟周边优质坚果蜜饯",
    emoji: "🥜", avatarBg: "#D07020",
    rating: 4.7, reviewCount: 3128, monthlySales: 15432, productCount: 15,
    reviews: [
      { user: "郑", avatar: "#D07020", stars: 5, date: "2026-04-10", content: "馕饼礼盒很实惠，包装很用心，味道正宗，买了送给父母很喜欢！" },
      { user: "王", avatar: "#3A78E0", stars: 4, date: "2026-04-07", content: "干果品质很好，巴旦木特别香脆，下次还会再来。" },
      { user: "李", avatar: "#3A9060", stars: 5, date: "2026-04-04", content: "店家服务很好，有问题及时回复，东西也货真价实！" },
    ],
  },
  {
    id: "s5", rank: 5,
    name: "沙漠蜂蜜铺", desc: "吐峪沟沙漠边的纯天然蜂蜜，零添加，来自野生百花",
    emoji: "🍯", avatarBg: "#E08020",
    rating: 4.6, reviewCount: 987, monthlySales: 4231, productCount: 5,
    reviews: [
      { user: "张", avatar: "#E08020", stars: 5, date: "2026-04-09", content: "蜂蜜很纯，没有任何添加，口感细腻，每天早上一勺，很好。" },
      { user: "赵", avatar: "#7B3FA0", stars: 5, date: "2026-04-05", content: "沙枣花蜂蜜是第一次尝到，香气特别，值得推荐！" },
      { user: "钱", avatar: "#D04080", stars: 4, date: "2026-04-01", content: "品质不错，就是量稍少，但味道无可挑剔。" },
    ],
  },
];

// ── Star helper ───────────────────────────────────────────────────────────────
function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons key={i} name={i <= Math.floor(n) ? "star" : i - 0.5 <= n ? "star-half" : "star-outline"} size={size} color={GOLD} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LocalShopPage() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const haptic = () => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const [screen,      setScreen]      = useState<Screen>("main");
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [activeTab,   setActiveTab]   = useState<"products"|"reviews">("products");
  const [searchText,  setSearchText]  = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("全部");
  const [showCart,    setShowCart]    = useState(false);
  const [showOrders,  setShowOrders]  = useState(false);
  const [showCoupons, setShowCoupons] = useState(false);

  const openStore = (store: Store) => {
    haptic();
    setActiveStore(store);
    setActiveTab("products");
    setScreen("store");
  };

  // ── STORE DETAIL ──────────────────────────────────────────────────────────
  if (screen === "store" && activeStore) {
    const storeProducts = HOT_PRODUCTS.filter(p => p.storeId === activeStore.id)
      .concat(POTENTIAL_PRODUCTS.filter(p => p.storeId === activeStore.id));
    return (
      <View style={s.root}>
        {/* Header */}
        <View style={[s.storeHeader, { paddingTop: topPad + 4 }]}>
          <Pressable style={s.backBtn} onPress={() => { haptic(); setScreen("main"); }}>
            <Ionicons name="chevron-back" size={22} color={TEXT1} />
            <Text style={s.backText}>返回</Text>
          </Pressable>
          {activeStore.rank <= 3 && (
            <View style={s.storeRankBadge}>
              <Ionicons name="ribbon-outline" size={14} color={ORANGE} />
              <Text style={s.storeRankText}>本月排名第 {activeStore.rank}</Text>
            </View>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Store info card */}
          <View style={s.storeInfoCard}>
            <View style={[s.storeAvatar, { backgroundColor: activeStore.avatarBg }]}>
              <Text style={s.storeAvatarText}>{activeStore.emoji}</Text>
            </View>
            <View style={s.storeInfoRight}>
              <Text style={s.storeInfoName}>{activeStore.name}</Text>
              <Text style={s.storeInfoDesc}>{activeStore.desc}</Text>
              <View style={s.storeStatsRow}>
                <View style={s.storeStat}>
                  <Text style={s.storeStatLabel}>综合评分</Text>
                  <View style={s.storeStatValRow}>
                    <Ionicons name="star" size={14} color={GOLD} />
                    <Text style={s.storeStatVal}>{activeStore.rating}</Text>
                  </View>
                </View>
                <View style={s.storeStatDivider} />
                <View style={s.storeStat}>
                  <Text style={s.storeStatLabel}>累计评价</Text>
                  <Text style={s.storeStatVal}>{activeStore.reviewCount.toLocaleString()}</Text>
                </View>
                <View style={s.storeStatDivider} />
                <View style={s.storeStat}>
                  <Text style={s.storeStatLabel}>月度销量</Text>
                  <View style={s.storeStatValRow}>
                    <Ionicons name="trending-up" size={13} color={GREEN} />
                    <Text style={[s.storeStatVal, { color: GREEN }]}>{activeStore.monthlySales.toLocaleString()}</Text>
                  </View>
                </View>
                <View style={s.storeStatDivider} />
                <View style={s.storeStat}>
                  <Text style={s.storeStatLabel}>在售商品</Text>
                  <Text style={s.storeStatVal}>{activeStore.productCount}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Tabs */}
          <View style={s.storeTabs}>
            {(["products","reviews"] as const).map(tab => (
              <Pressable key={tab} style={[s.storeTab, activeTab === tab && s.storeTabActive]} onPress={() => { haptic(); setActiveTab(tab); }}>
                <Text style={[s.storeTabText, activeTab === tab && s.storeTabTextActive]}>
                  {tab === "products" ? "店铺商品" : "用户评价"}
                </Text>
              </Pressable>
            ))}
          </View>

          {activeTab === "products" ? (
            <View>
              <Text style={s.sectionTitle2}>店铺商品</Text>
              <View style={s.storeProductGrid}>
                {storeProducts.map(p => (
                  <Pressable key={p.id} style={s.storeProductCard} onPress={haptic}>
                    <View style={[s.storeProductImg, { backgroundColor: "#FFF4EC" }]}>
                      <Text style={s.storeProductEmoji}>{p.emoji}</Text>
                    </View>
                    <View style={s.storeProductInfo}>
                      <Text style={s.storeProductName} numberOfLines={2}>{p.name}</Text>
                      <Stars n={p.rating} />
                      <View style={s.storeProductBottom}>
                        <Text style={s.storeProductPrice}>¥{p.price}</Text>
                        <Text style={s.storeProductSold}>已售 {p.sold}</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View>
              <Text style={s.sectionTitle2}>用户评价</Text>
              {activeStore.reviews.map((rev, i) => (
                <View key={i} style={s.reviewItem}>
                  <View style={s.reviewTop}>
                    <View style={[s.reviewAvatar, { backgroundColor: rev.avatar }]}>
                      <Text style={s.reviewAvatarText}>{rev.user}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.reviewUser}>{rev.user}**</Text>
                      <Stars n={rev.stars} />
                    </View>
                    <Text style={s.reviewDate}>{rev.date}</Text>
                  </View>
                  <Text style={s.reviewContent}>{rev.content}</Text>
                  {i < activeStore.reviews.length - 1 && <View style={s.reviewDivider} />}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── ALL HOT PRODUCTS ──────────────────────────────────────────────────────
  if (screen === "all-hot") {
    const filtered = activeCategory === "全部" ? HOT_PRODUCTS : HOT_PRODUCTS.filter(p => p.category === activeCategory);
    return (
      <View style={s.root}>
        <View style={[s.storeHeader, { paddingTop: topPad + 4 }]}>
          <Pressable style={s.backBtn} onPress={() => { haptic(); setScreen("main"); }}>
            <Ionicons name="chevron-back" size={22} color={TEXT1} />
            <Text style={s.backText}>热销商品</Text>
          </Pressable>
        </View>
        <View style={s.catScrollWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScrollContent}>
            {CATEGORIES.map(c => (
              <Pressable key={c} style={[s.catChip, activeCategory === c && s.catChipActive]} onPress={() => { haptic(); setActiveCategory(c); }}>
                <Text style={[s.catChipText, activeCategory === c && s.catChipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <View style={s.allProductGrid}>
            {filtered.map(p => <ProductCard key={p.id} p={p} haptic={haptic} />)}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── ALL POTENTIAL PRODUCTS ────────────────────────────────────────────────
  if (screen === "all-potential") {
    return (
      <View style={s.root}>
        <View style={[s.storeHeader, { paddingTop: topPad + 4 }]}>
          <Pressable style={s.backBtn} onPress={() => { haptic(); setScreen("main"); }}>
            <Ionicons name="chevron-back" size={22} color={TEXT1} />
            <Text style={s.backText}>潜力新品</Text>
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }}>
          <View style={s.allProductGrid}>
            {POTENTIAL_PRODUCTS.map(p => <ProductCard key={p.id} p={p} haptic={haptic} />)}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── MAIN PAGE ─────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.mainHeader, { paddingTop: topPad + 4 }]}>
        <Pressable style={s.backBtnMain} onPress={() => { haptic(); router.back(); }}>
          <Ionicons name="chevron-back" size={24} color={TEXT1} />
        </Pressable>
        <Text style={s.mainTitle}>乡村特产礼品</Text>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={15} color={TEXT3} />
          <TextInput
            style={s.searchInput}
            placeholder="搜索特产、店铺"
            placeholderTextColor={TEXT3}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Quick actions */}
        <View style={s.quickRow}>
          {[
            { label: "我的订单", icon: "receipt-outline",   onPress: () => setShowOrders(true) },
            { label: "购物车",   icon: "cart-outline",      onPress: () => setShowCart(true) },
            { label: "优惠券",   icon: "pricetag-outline",  onPress: () => setShowCoupons(true) },
          ].map(item => (
            <Pressable key={item.label} style={s.quickBtn} onPress={() => { haptic(); item.onPress(); }}>
              <View style={s.quickIconWrap}>
                <Ionicons name={item.icon as any} size={22} color={ORANGE} />
              </View>
              <Text style={s.quickLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Categories */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>商品分类</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScrollContent} style={{ marginBottom: 18 }}>
          {CATEGORIES.map(c => (
            <Pressable key={c} style={[s.catChip, activeCategory === c && s.catChipActive]}
              onPress={() => { haptic(); setActiveCategory(c); setScreen("all-hot"); }}>
              <Ionicons
                name={c === "全部" ? "grid-outline" : c === "干果蜜饯" ? "leaf-outline" : c === "工艺手办" ? "brush-outline" : c === "织物刺绣" ? "color-palette-outline" : c === "美食特产" ? "restaurant-outline" : "flower-outline"}
                size={15}
                color={activeCategory === c ? "#fff" : TEXT2}
                style={{ marginBottom: 2 }}
              />
              <Text style={[s.catChipText, activeCategory === c && s.catChipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Hot products */}
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>🔥 热销商品</Text>
          <Pressable onPress={() => { haptic(); setScreen("all-hot"); }}>
            <Text style={s.moreText}>更多 &gt;</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScrollContent}>
          {HOT_PRODUCTS.slice(0, 6).map(p => (
            <Pressable key={p.id} style={s.hProductCard} onPress={haptic}>
              <View style={[s.hProductImg, { backgroundColor: "#FFF4EC" }]}>
                <Text style={s.hProductEmoji}>{p.emoji}</Text>
              </View>
              <Text style={s.hProductName} numberOfLines={2}>{p.name}</Text>
              <Stars n={p.rating} />
              <Text style={s.hProductPrice}>¥{p.price}</Text>
              <Text style={s.hProductSold}>已售 {p.sold}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Potential products */}
        <View style={[s.sectionRow, { marginTop: 8 }]}>
          <Text style={s.sectionTitle}>✨ 潜力新品</Text>
          <Pressable onPress={() => { haptic(); setScreen("all-potential"); }}>
            <Text style={s.moreText}>更多 &gt;</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScrollContent}>
          {POTENTIAL_PRODUCTS.slice(0, 6).map(p => (
            <Pressable key={p.id} style={s.hProductCard} onPress={haptic}>
              <View style={[s.hProductImg, { backgroundColor: "#F0F8FF" }]}>
                <Text style={s.hProductEmoji}>{p.emoji}</Text>
                <View style={s.newTag}><Text style={s.newTagText}>新品</Text></View>
              </View>
              <Text style={s.hProductName} numberOfLines={2}>{p.name}</Text>
              <Stars n={p.rating} />
              <Text style={s.hProductPrice}>¥{p.price}</Text>
              <Text style={s.hProductSold}>已售 {p.sold}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Top stores */}
        <View style={[s.sectionRow, { marginTop: 8 }]}>
          <Text style={s.sectionTitle}>🏆 本月优秀店铺</Text>
          <Text style={s.sectionSub}>综合评分前五</Text>
        </View>

        {STORES.map((store, idx) => (
          <Pressable key={store.id} style={s.storeCard} onPress={() => openStore(store)}>
            {/* Rank medal */}
            <View style={[s.storeRankNum, { backgroundColor: idx === 0 ? "#F5A623" : idx === 1 ? "#C0C0C0" : idx === 2 ? "#CD7F32" : "#F0EBE3" }]}>
              <Text style={[s.storeRankNumText, { color: idx < 3 ? "#fff" : TEXT2 }]}>{store.rank}</Text>
            </View>

            <View style={[s.storeCardAvatar, { backgroundColor: store.avatarBg }]}>
              <Text style={s.storeCardAvatarText}>{store.emoji}</Text>
            </View>

            <View style={s.storeCardInfo}>
              <Text style={s.storeCardName}>{store.name}</Text>
              <Text style={s.storeCardDesc} numberOfLines={1}>{store.desc}</Text>
              <View style={s.storeCardMeta}>
                <Stars n={store.rating} />
                <Text style={s.storeCardRating}>{store.rating}</Text>
                <Text style={s.storeCardReviews}>({store.reviewCount.toLocaleString()})</Text>
                <View style={s.storeCardSalesBadge}>
                  <Ionicons name="trending-up" size={11} color={GREEN} />
                  <Text style={s.storeCardSalesText}>{store.monthlySales.toLocaleString()}</Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={TEXT3} />
          </Pressable>
        ))}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerLine}>每一处乡村每一个景点都有属于自己的特色文化及特色产品</Text>
          <Text style={s.footerLine2}>连续2个月评分低于2.0星的店铺将暂停营业</Text>
        </View>
      </ScrollView>

      {/* Simple modal placeholders */}
      {[
        { visible: showOrders, onClose: () => setShowOrders(false), title: "我的订单", desc: "暂无订单记录", icon: "receipt-outline" },
        { visible: showCart,   onClose: () => setShowCart(false),   title: "购物车",   desc: "购物车是空的",   icon: "cart-outline" },
        { visible: showCoupons,onClose: () => setShowCoupons(false),title: "优惠券",   desc: "暂无可用优惠券", icon: "pricetag-outline" },
      ].map(modal => (
        <Modal key={modal.title} visible={modal.visible} transparent animationType="slide">
          <View style={s.modalBackdrop}>
            <View style={s.simpleModal}>
              <View style={s.simpleModalHeader}>
                <Text style={s.simpleModalTitle}>{modal.title}</Text>
                <Pressable onPress={() => { haptic(); modal.onClose(); }}>
                  <Ionicons name="close" size={22} color={TEXT2} />
                </Pressable>
              </View>
              <View style={s.simpleModalEmpty}>
                <Ionicons name={modal.icon as any} size={48} color={TEXT3} />
                <Text style={s.simpleModalDesc}>{modal.desc}</Text>
              </View>
            </View>
          </View>
        </Modal>
      ))}
    </View>
  );
}

// ── Product card (full list view) ────────────────────────────────────────────
function ProductCard({ p, haptic }: { p: Product; haptic: () => void }) {
  return (
    <Pressable style={s.allProductCard} onPress={haptic}>
      <View style={[s.allProductImg, { backgroundColor: p.isNew ? "#F0F8FF" : "#FFF4EC" }]}>
        <Text style={s.allProductEmoji}>{p.emoji}</Text>
        {p.isNew && <View style={s.newTag}><Text style={s.newTagText}>新品</Text></View>}
      </View>
      <Text style={s.allProductName} numberOfLines={2}>{p.name}</Text>
      <Stars n={p.rating} />
      <View style={s.allProductBottom}>
        <Text style={s.allProductPrice}>¥{p.price}</Text>
        <Text style={s.allProductSold}>已售{p.sold}</Text>
      </View>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  /* Main header */
  mainHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  backBtnMain: { width: 30, height: 30, alignItems: "center", justifyContent: "center", marginRight: 4 },
  mainTitle: { fontSize: 18, fontWeight: "800", color: TEXT1, flex: 1 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#F5F0EB", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, gap: 6, minWidth: 140 },
  searchInput: { fontSize: 13, color: TEXT1, flex: 1, padding: 0 },

  /* Store header */
  storeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: BORDER },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 15, color: TEXT1, fontWeight: "600" },
  storeRankBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: ORANGE_L, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  storeRankText: { fontSize: 12, color: ORANGE, fontWeight: "700" },

  /* Quick actions */
  quickRow: { flexDirection: "row", backgroundColor: CARD, paddingVertical: 16, paddingHorizontal: 24, gap: 0, justifyContent: "space-around", marginBottom: 8 },
  quickBtn: { alignItems: "center", gap: 6 },
  quickIconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: ORANGE_L, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 12, color: TEXT1, fontWeight: "500" },

  /* Category scroll */
  catScrollWrap: { backgroundColor: CARD, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  catScrollContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  catChip: { alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, gap: 2, minWidth: 68 },
  catChipActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  catChipText: { fontSize: 12, color: TEXT2, fontWeight: "500" },
  catChipTextActive: { color: "#fff", fontWeight: "700" },

  /* Section */
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: TEXT1 },
  sectionSub: { fontSize: 12, color: TEXT3 },
  moreText: { fontSize: 13, color: ORANGE, fontWeight: "600" },

  /* Horizontal product scroll */
  hScrollContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  hProductCard: { width: 130, backgroundColor: CARD, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  hProductImg: { width: "100%", height: 100, alignItems: "center", justifyContent: "center", position: "relative" },
  hProductEmoji: { fontSize: 40 },
  hProductName: { fontSize: 12, fontWeight: "600", color: TEXT1, padding: 8, paddingBottom: 4, lineHeight: 17 },
  hProductPrice: { fontSize: 15, fontWeight: "800", color: ORANGE, paddingHorizontal: 8 },
  hProductSold: { fontSize: 11, color: TEXT3, paddingHorizontal: 8, paddingBottom: 8, marginTop: 2 },

  newTag: { position: "absolute", top: 6, right: 6, backgroundColor: "#3A78E0", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  newTagText: { fontSize: 9, color: "#fff", fontWeight: "700" },

  /* Store cards */
  storeCard: { flexDirection: "row", alignItems: "center", backgroundColor: CARD, marginHorizontal: 16, marginBottom: 10, borderRadius: 18, padding: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, gap: 10 },
  storeRankNum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  storeRankNumText: { fontSize: 13, fontWeight: "800" },
  storeCardAvatar: { width: 50, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  storeCardAvatarText: { fontSize: 24 },
  storeCardInfo: { flex: 1 },
  storeCardName: { fontSize: 15, fontWeight: "700", color: TEXT1, marginBottom: 3 },
  storeCardDesc: { fontSize: 12, color: TEXT2, marginBottom: 5 },
  storeCardMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  storeCardRating: { fontSize: 12, fontWeight: "700", color: GOLD },
  storeCardReviews: { fontSize: 11, color: TEXT3 },
  storeCardSalesBadge: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#E8F5EE", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  storeCardSalesText: { fontSize: 11, color: GREEN, fontWeight: "600" },

  /* Footer */
  footer: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 24, gap: 10, backgroundColor: "#1A1A2E", marginTop: 16 },
  footerLine: { fontSize: 13, color: "rgba(255,255,255,0.7)", textAlign: "center", lineHeight: 20 },
  footerLine2: { fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center" },

  /* All products grid */
  allProductGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: 12 },
  allProductCard: { width: "47%", backgroundColor: CARD, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  allProductImg: { width: "100%", height: 110, alignItems: "center", justifyContent: "center" },
  allProductEmoji: { fontSize: 44 },
  allProductName: { fontSize: 13, fontWeight: "600", color: TEXT1, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4, lineHeight: 18 },
  allProductBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingBottom: 10, marginTop: 4 },
  allProductPrice: { fontSize: 16, fontWeight: "800", color: ORANGE },
  allProductSold: { fontSize: 11, color: TEXT3 },

  /* Store detail */
  storeInfoCard: { flexDirection: "row", backgroundColor: CARD, padding: 16, gap: 14, marginBottom: 8 },
  storeAvatar: { width: 80, height: 80, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  storeAvatarText: { fontSize: 36 },
  storeInfoRight: { flex: 1 },
  storeInfoName: { fontSize: 20, fontWeight: "800", color: TEXT1, marginBottom: 4 },
  storeInfoDesc: { fontSize: 12, color: TEXT2, lineHeight: 17, marginBottom: 12 },
  storeStatsRow: { flexDirection: "row", alignItems: "center" },
  storeStat: { flex: 1, alignItems: "center", gap: 3 },
  storeStatLabel: { fontSize: 10, color: TEXT3 },
  storeStatValRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  storeStatVal: { fontSize: 15, fontWeight: "700", color: TEXT1 },
  storeStatDivider: { width: 1, height: 28, backgroundColor: BORDER },
  storeTabs: { flexDirection: "row", backgroundColor: CARD, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  storeTab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  storeTabActive: { borderBottomWidth: 2, borderBottomColor: ORANGE },
  storeTabText: { fontSize: 14, color: TEXT3, fontWeight: "500" },
  storeTabTextActive: { color: ORANGE, fontWeight: "700" },
  sectionTitle2: { fontSize: 17, fontWeight: "800", color: TEXT1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  storeProductGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16 },
  storeProductCard: { width: "47%", backgroundColor: CARD, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: BORDER },
  storeProductImg: { width: "100%", height: 100, alignItems: "center", justifyContent: "center" },
  storeProductEmoji: { fontSize: 44 },
  storeProductInfo: { padding: 10 },
  storeProductName: { fontSize: 13, fontWeight: "600", color: TEXT1, marginBottom: 4, lineHeight: 18 },
  storeProductBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  storeProductPrice: { fontSize: 16, fontWeight: "800", color: ORANGE },
  storeProductSold: { fontSize: 11, color: TEXT3 },

  /* Reviews */
  reviewItem: { paddingHorizontal: 16 },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 14, marginBottom: 8 },
  reviewAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  reviewAvatarText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  reviewUser: { fontSize: 13, fontWeight: "600", color: TEXT1, marginBottom: 3 },
  reviewDate: { fontSize: 11, color: TEXT3 },
  reviewContent: { fontSize: 13, color: TEXT2, lineHeight: 20, paddingBottom: 14 },
  reviewDivider: { height: 1, backgroundColor: BORDER },

  /* Simple modals */
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  simpleModal: { backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  simpleModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: BORDER },
  simpleModalTitle: { fontSize: 17, fontWeight: "700", color: TEXT1 },
  simpleModalEmpty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  simpleModalDesc: { fontSize: 14, color: TEXT3 },
});
