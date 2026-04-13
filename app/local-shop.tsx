"use no memo";
import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  TextInput, Platform, Modal, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const { height: SCREEN_H } = Dimensions.get("window");

// ── Theme ────────────────────────────────────────────────────────────────────
const BG       = "#F5EFE6";
const CARD     = "#FFFFFF";
const ORANGE   = "#E07030";
const ORANGE_L = "#FFF0E8";
const TEXT1    = "#1A1A2E";
const TEXT2    = "#666880";
const TEXT3    = "#9B9BB0";
const BORDER   = "#F0EBE3";
const GOLD     = "#F5A623";
const GREEN    = "#3A9060";

type Screen    = "main" | "all-hot" | "all-potential" | "store";
type Category  = "全部" | "干果蜜饯" | "工艺手办" | "织物刺绣" | "美食特产" | "农产品";

interface Product {
  id: string; name: string; emoji: string; price: number;
  rating: number; sold: number; category: Exclude<Category,"全部">;
  storeId: string; isNew?: boolean;
}
interface Store {
  id: string; name: string; desc: string; emoji: string; avatarBg: string;
  rating: number; reviewCount: number; monthlySales: number; productCount: number; rank: number;
  reviews: { user: string; avatar: string; stars: number; date: string; content: string }[];
}

// ── Data ─────────────────────────────────────────────────────────────────────
const CATEGORIES: Category[] = ["全部","干果蜜饯","工艺手办","织物刺绣","美食特产","农产品"];

const HOT_PRODUCTS: Product[] = [
  { id:"h1",  name:"吐峪沟特级葡萄干",   emoji:"🍇", price:68,  rating:4.9, sold:3218, category:"干果蜜饯", storeId:"s1" },
  { id:"h2",  name:"馕坑传统馕饼礼盒",   emoji:"🫓", price:45,  rating:4.8, sold:2156, category:"美食特产", storeId:"s4" },
  { id:"h3",  name:"维吾尔手工刺绣包",   emoji:"👜", price:188, rating:4.9, sold:1893, category:"织物刺绣", storeId:"s2" },
  { id:"h4",  name:"土陶花纹茶杯套装",   emoji:"🏺", price:128, rating:4.8, sold:1654, category:"工艺手办", storeId:"s3" },
  { id:"h5",  name:"和田红枣特级礼盒",   emoji:"🍮", price:88,  rating:4.7, sold:1432, category:"干果蜜饯", storeId:"s1" },
  { id:"h6",  name:"巴旦木原味500g",     emoji:"🥜", price:58,  rating:4.7, sold:1376, category:"干果蜜饯", storeId:"s4" },
  { id:"h7",  name:"沙漠蜂巢蜂蜜",       emoji:"🍯", price:98,  rating:4.8, sold:1298, category:"农产品",   storeId:"s5" },
  { id:"h8",  name:"手工羊毛地毯小件",   emoji:"🪆", price:268, rating:4.6, sold:987,  category:"工艺手办", storeId:"s3" },
  { id:"h9",  name:"无花果干礼包",       emoji:"🍑", price:52,  rating:4.7, sold:921,  category:"干果蜜饯", storeId:"s4" },
  { id:"h10", name:"维吾尔民族刺绣围巾", emoji:"🧣", price:148, rating:4.8, sold:876,  category:"织物刺绣", storeId:"s2" },
  { id:"h11", name:"核桃仁精选礼盒",     emoji:"🫘", price:72,  rating:4.6, sold:812,  category:"干果蜜饯", storeId:"s1" },
  { id:"h12", name:"桑葚干200g",         emoji:"🫐", price:38,  rating:4.5, sold:754,  category:"干果蜜饯", storeId:"s4" },
  { id:"h13", name:"沙棘汁原浆礼盒",     emoji:"🧃", price:118, rating:4.7, sold:698,  category:"美食特产", storeId:"s5" },
  { id:"h14", name:"民族风花帽",         emoji:"🎩", price:158, rating:4.8, sold:643,  category:"工艺手办", storeId:"s2" },
  { id:"h15", name:"手工土陶酒壶",       emoji:"🫙", price:198, rating:4.9, sold:589,  category:"工艺手办", storeId:"s3" },
];

const POTENTIAL_PRODUCTS: Product[] = [
  { id:"p1", name:"玫瑰花茶礼盒",     emoji:"🌹", price:62,  rating:4.6, sold:234, category:"美食特产", storeId:"s5", isNew:true },
  { id:"p2", name:"手工织锦抱枕套",   emoji:"🪑", price:145, rating:4.7, sold:189, category:"织物刺绣", storeId:"s2", isNew:true },
  { id:"p3", name:"迷你土陶摆件",     emoji:"🏺", price:88,  rating:4.5, sold:167, category:"工艺手办", storeId:"s3", isNew:true },
  { id:"p4", name:"沙漠玫瑰干花束",   emoji:"🌸", price:55,  rating:4.6, sold:143, category:"农产品",   storeId:"s5", isNew:true },
  { id:"p5", name:"芝麻酱特色礼包",   emoji:"🥫", price:42,  rating:4.4, sold:121, category:"美食特产", storeId:"s4", isNew:true },
  { id:"p6", name:"刺绣香囊挂件",     emoji:"🎀", price:35,  rating:4.5, sold:98,  category:"织物刺绣", storeId:"s2", isNew:true },
  { id:"p7", name:"吐峪沟景区伴手礼", emoji:"🎁", price:128, rating:4.7, sold:87,  category:"工艺手办", storeId:"s3", isNew:true },
  { id:"p8", name:"驼毛保暖袜两双装", emoji:"🧦", price:68,  rating:4.6, sold:72,  category:"织物刺绣", storeId:"s2", isNew:true },
];

const STORES: Store[] = [
  { id:"s1", rank:1, name:"吐峪沟葡萄干专卖", desc:"纯天然晾晒，百年传统工艺", emoji:"🍇", avatarBg:"#7B3FA0",
    rating:4.9, reviewCount:2341, monthlySales:12680, productCount:8,
    reviews:[
      { user:"王", avatar:"#E07030", stars:5, date:"2026-04-10", content:"葡萄干超甜，自然晒干的味道，包装也很精美，送礼很有面子！" },
      { user:"李", avatar:"#3A78E0", stars:5, date:"2026-04-08", content:"正宗吐峪沟特产，买了好几次了，每次都很满意，强烈推荐！" },
      { user:"张", avatar:"#3A9060", stars:4, date:"2026-04-05", content:"味道很好，就是快递有点慢，但品质完全在线。" },
    ]},
  { id:"s2", rank:2, name:"维吾尔刺绣工坊", desc:"传承百年刺绣技艺，每件作品均为手工制作", emoji:"🪡", avatarBg:"#D04080",
    rating:4.8, reviewCount:1923, monthlySales:8934, productCount:12,
    reviews:[
      { user:"陈", avatar:"#D04080", stars:5, date:"2026-04-09", content:"刺绣包太漂亮了，做工精细，花纹真的很有民族特色！" },
      { user:"赵", avatar:"#E07030", stars:5, date:"2026-04-07", content:"买了围巾和香囊，质量超好，手工细腻，会继续回购。" },
      { user:"钱", avatar:"#7B3FA0", stars:5, date:"2026-04-03", content:"老板很热情，产品非常有特色，旅游纪念品首选！" },
    ]},
  { id:"s3", rank:3, name:"土陶艺术坊", desc:"吐峪沟非遗土陶，烧制于古窑，承载千年文化", emoji:"🏺", avatarBg:"#8B5020",
    rating:4.8, reviewCount:1456, monthlySales:6723, productCount:6,
    reviews:[
      { user:"孙", avatar:"#8B5020", stars:5, date:"2026-04-11", content:"土陶茶杯太有质感了，用来泡茶特别有氛围！" },
      { user:"周", avatar:"#3A9060", stars:4, date:"2026-04-06", content:"工艺很好，瑕不掩瑜，整体很满意。" },
      { user:"吴", avatar:"#E07030", stars:5, date:"2026-04-02", content:"老师傅亲手制作，有灵魂的作品，摆在书架上超好看。" },
    ]},
  { id:"s4", rank:4, name:"古道干果铺", desc:"丝路古道干果宝库，精选吐峪沟周边优质坚果", emoji:"🥜", avatarBg:"#D07020",
    rating:4.7, reviewCount:3128, monthlySales:15432, productCount:15,
    reviews:[
      { user:"郑", avatar:"#D07020", stars:5, date:"2026-04-10", content:"馕饼礼盒很实惠，包装用心，味道正宗！" },
      { user:"王", avatar:"#3A78E0", stars:4, date:"2026-04-07", content:"干果品质很好，巴旦木特别香脆，下次还会再来。" },
      { user:"李", avatar:"#3A9060", stars:5, date:"2026-04-04", content:"店家服务很好，货真价实！" },
    ]},
  { id:"s5", rank:5, name:"沙漠蜂蜜铺", desc:"吐峪沟沙漠边纯天然蜂蜜，零添加，来自野生百花", emoji:"🍯", avatarBg:"#E08020",
    rating:4.6, reviewCount:987, monthlySales:4231, productCount:5,
    reviews:[
      { user:"张", avatar:"#E08020", stars:5, date:"2026-04-09", content:"蜂蜜很纯，无任何添加，口感细腻，每天早上一勺。" },
      { user:"赵", avatar:"#7B3FA0", stars:5, date:"2026-04-05", content:"沙枣花蜂蜜第一次尝，香气特别，值得推荐！" },
      { user:"钱", avatar:"#D04080", stars:4, date:"2026-04-01", content:"品质不错，味道无可挑剔。" },
    ]},
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function RatingLine({ rating, sold }: { rating: number; sold: number }) {
  return (
    <View style={h.ratingLine}>
      <Ionicons name="star" size={12} color={GOLD} />
      <Text style={h.ratingNum}>{rating}</Text>
      <Text style={h.ratingDot}>·</Text>
      <Text style={h.ratingDot}>已售 {sold.toLocaleString()}</Text>
    </View>
  );
}

function StarFull({ n }: { n: number }) {
  return (
    <View style={{ flexDirection:"row", gap:1 }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons key={i} name={i<=Math.floor(n)?"star":i-0.5<=n?"star-half":"star-outline"} size={12} color={GOLD} />
      ))}
    </View>
  );
}

const h = StyleSheet.create({
  ratingLine:{ flexDirection:"row", alignItems:"center", gap:3 },
  ratingNum: { fontSize:12, fontWeight:"700", color:TEXT1 },
  ratingDot: { fontSize:11, color:TEXT2 },
});

// ── Product card (grid / fulllist) ────────────────────────────────────────────
function ProductCard({ p, haptic }: { p: Product; haptic: () => void }) {
  return (
    <Pressable style={s.gridCard} onPress={haptic}>
      <View style={[s.gridImg, { backgroundColor: p.isNew ? "#EEF6FF" : "#FFF4EC" }]}>
        <Text style={s.gridEmoji}>{p.emoji}</Text>
        {p.isNew && <View style={s.newBadge}><Text style={s.newBadgeText}>新品</Text></View>}
      </View>
      <View style={s.gridInfo}>
        <Text style={s.gridName} numberOfLines={2}>{p.name}</Text>
        <RatingLine rating={p.rating} sold={p.sold} />
        <Text style={s.gridPrice}>¥{p.price}</Text>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LocalShopPage() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;
  const haptic  = () => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const [screen,         setScreen]         = useState<Screen>("main");
  const [activeStore,    setActiveStore]    = useState<Store | null>(null);
  const [activeTab,      setActiveTab]      = useState<"products"|"reviews">("products");
  const [searchText,     setSearchText]     = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("全部");
  const [showOrders,  setShowOrders]  = useState(false);
  const [showCart,    setShowCart]    = useState(false);
  const [showCoupons, setShowCoupons] = useState(false);

  const openStore = (store: Store) => { haptic(); setActiveStore(store); setActiveTab("products"); setScreen("store"); };

  // ── Inner header ──────────────────────────────────────────────────────────
  const SubHeader = ({ title, right }: { title: string; right?: React.ReactNode }) => (
    <View style={[s.subHeader, { paddingTop: topPad + 4 }]}>
      <Pressable style={s.backRow} onPress={() => { haptic(); setScreen("main"); }}>
        <Ionicons name="chevron-back" size={22} color={TEXT1} />
        <Text style={s.backLabel}>返回</Text>
      </Pressable>
      <Text style={s.subHeaderTitle}>{title}</Text>
      <View style={{ minWidth: 60, alignItems:"flex-end" }}>{right}</View>
    </View>
  );

  // ── STORE DETAIL ──────────────────────────────────────────────────────────
  if (screen === "store" && activeStore) {
    const prods = HOT_PRODUCTS.filter(p => p.storeId === activeStore.id)
      .concat(POTENTIAL_PRODUCTS.filter(p => p.storeId === activeStore.id));
    return (
      <View style={s.root}>
        <View style={[s.subHeader, { paddingTop: topPad + 4 }]}>
          <Pressable style={s.backRow} onPress={() => { haptic(); setScreen("main"); }}>
            <Ionicons name="chevron-back" size={22} color={TEXT1} />
            <Text style={s.backLabel}>返回</Text>
          </Pressable>
          <Text style={s.subHeaderTitle}>{activeStore.name}</Text>
          {activeStore.rank <= 3 ? (
            <View style={s.rankBadge}>
              <Ionicons name="ribbon-outline" size={13} color={ORANGE} />
              <Text style={s.rankBadgeText}>本月第{activeStore.rank}</Text>
            </View>
          ) : <View style={{ minWidth:60 }} />}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
          {/* Store hero */}
          <LinearGradient colors={["#FFF8F3","#FFF0E4"]} style={s.storeHero}>
            <View style={[s.storeHeroAvatar, { backgroundColor: activeStore.avatarBg }]}>
              <Text style={s.storeHeroEmoji}>{activeStore.emoji}</Text>
            </View>
            <View style={s.storeHeroRight}>
              <Text style={s.storeHeroName}>{activeStore.name}</Text>
              <Text style={s.storeHeroDesc} numberOfLines={2}>{activeStore.desc}</Text>
              <View style={s.storeStatsRow}>
                {[
                  { label:"综合评分", val: activeStore.rating.toString(), icon:"star", iconColor: GOLD },
                  { label:"累计评价", val: activeStore.reviewCount.toLocaleString() },
                  { label:"月度销量", val: activeStore.monthlySales.toLocaleString(), green: true },
                  { label:"在售商品", val: activeStore.productCount.toString() },
                ].map((stat, i, arr) => (
                  <React.Fragment key={stat.label}>
                    <View style={s.storeStat}>
                      <Text style={s.storeStatLabel}>{stat.label}</Text>
                      <View style={s.storeStatValRow}>
                        {stat.icon && <Ionicons name={stat.icon as any} size={13} color={stat.iconColor} />}
                        {stat.green && <Ionicons name="trending-up" size={12} color={GREEN} />}
                        <Text style={[s.storeStatVal, stat.green && { color: GREEN }]}>{stat.val}</Text>
                      </View>
                    </View>
                    {i < arr.length - 1 && <View style={s.storeStatDiv} />}
                  </React.Fragment>
                ))}
              </View>
            </View>
          </LinearGradient>

          {/* Tabs */}
          <View style={s.tabs}>
            {(["products","reviews"] as const).map(tab => (
              <Pressable key={tab} style={[s.tab, activeTab===tab && s.tabActive]} onPress={() => { haptic(); setActiveTab(tab); }}>
                <Text style={[s.tabText, activeTab===tab && s.tabTextActive]}>{tab==="products" ? "店铺商品" : "用户评价"}</Text>
              </Pressable>
            ))}
          </View>

          {activeTab === "products" ? (
            <View style={s.gridWrap}>
              {prods.map(p => <ProductCard key={p.id} p={p} haptic={haptic} />)}
            </View>
          ) : (
            <View style={{ paddingTop: 8 }}>
              {activeStore.reviews.map((rev, i) => (
                <View key={i} style={s.reviewItem}>
                  <View style={s.reviewTop}>
                    <View style={[s.reviewAvatar, { backgroundColor: rev.avatar }]}>
                      <Text style={s.reviewAvatarTxt}>{rev.user}</Text>
                    </View>
                    <View style={{ flex:1 }}>
                      <Text style={s.reviewName}>{rev.user}**</Text>
                      <StarFull n={rev.stars} />
                    </View>
                    <Text style={s.reviewDate}>{rev.date}</Text>
                  </View>
                  <Text style={s.reviewContent}>{rev.content}</Text>
                  {i < activeStore.reviews.length - 1 && <View style={s.reviewDiv} />}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── ALL HOT ───────────────────────────────────────────────────────────────
  if (screen === "all-hot") {
    const filtered = activeCategory==="全部" ? HOT_PRODUCTS : HOT_PRODUCTS.filter(p=>p.category===activeCategory);
    return (
      <View style={s.root}>
        <SubHeader title="热销商品" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow} style={s.catBar}>
          {CATEGORIES.map(c => (
            <Pressable key={c} style={[s.catPill, activeCategory===c && s.catPillActive]} onPress={() => { haptic(); setActiveCategory(c); }}>
              <Text style={[s.catPillText, activeCategory===c && s.catPillTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:16, paddingTop:12, paddingBottom:40 }}>
          <View style={s.gridWrap}>{filtered.map(p => <ProductCard key={p.id} p={p} haptic={haptic} />)}</View>
        </ScrollView>
      </View>
    );
  }

  // ── ALL POTENTIAL ─────────────────────────────────────────────────────────
  if (screen === "all-potential") {
    return (
      <View style={s.root}>
        <SubHeader title="潜力新品" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:16, paddingTop:12, paddingBottom:40 }}>
          <View style={s.gridWrap}>{POTENTIAL_PRODUCTS.map(p => <ProductCard key={p.id} p={p} haptic={haptic} />)}</View>
        </ScrollView>
      </View>
    );
  }

  // ── MAIN ──────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.mainHeader, { paddingTop: topPad + 4 }]}>
        <Pressable style={s.mainBack} onPress={() => { haptic(); router.back(); }}>
          <Ionicons name="chevron-back" size={24} color={TEXT1} />
        </Pressable>
        <Text style={s.mainTitle}>乡村特产礼品</Text>
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={14} color={TEXT3} />
          <TextInput style={s.searchInput} placeholder="搜索特产、店铺" placeholderTextColor={TEXT3}
            value={searchText} onChangeText={setSearchText} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Quick actions */}
        <View style={s.quickRow}>
          {([
            { label:"我的订单", icon:"receipt-outline",  color:"#E07030", bg:"#FFF0E8", onPress:()=>setShowOrders(true) },
            { label:"购物车",   icon:"cart-outline",     color:"#3A78E0", bg:"#EEF3FF", onPress:()=>setShowCart(true) },
            { label:"优惠券",   icon:"pricetag-outline", color:"#3A9060", bg:"#E8F5EE", onPress:()=>setShowCoupons(true) },
          ] as const).map(item => (
            <Pressable key={item.label} style={s.quickBtn} onPress={() => { haptic(); item.onPress(); }}>
              <View style={[s.quickIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={s.quickLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Categories */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>商品分类</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.catRow, { paddingHorizontal:16 }]} style={{ marginBottom:20 }}>
          {CATEGORIES.map(c => (
            <Pressable key={c} style={[s.catPill, activeCategory===c && s.catPillActive]}
              onPress={() => { haptic(); setActiveCategory(c); setScreen("all-hot"); }}>
              <Ionicons
                name={c==="全部"?"grid-outline":c==="干果蜜饯"?"leaf-outline":c==="工艺手办"?"brush-outline":c==="织物刺绣"?"color-palette-outline":c==="美食特产"?"restaurant-outline":"flower-outline"}
                size={14} color={activeCategory===c?"#fff":TEXT2} />
              <Text style={[s.catPillText, activeCategory===c && s.catPillTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Hot products */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>🔥 热销商品</Text>
          <Pressable onPress={() => { haptic(); setScreen("all-hot"); }}>
            <Text style={s.moreBtn}>更多 &gt;</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
          {HOT_PRODUCTS.slice(0,6).map(p => (
            <Pressable key={p.id} style={s.hCard} onPress={haptic}>
              <View style={[s.hCardImg, { backgroundColor:"#FFF4EC" }]}>
                <Text style={s.hCardEmoji}>{p.emoji}</Text>
              </View>
              <View style={s.hCardInfo}>
                <Text style={s.hCardName} numberOfLines={2}>{p.name}</Text>
                <RatingLine rating={p.rating} sold={p.sold} />
                <Text style={s.hCardPrice}>¥{p.price}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Potential products */}
        <View style={[s.secRow, { marginTop:8 }]}>
          <Text style={s.secTitle}>✨ 潜力新品</Text>
          <Pressable onPress={() => { haptic(); setScreen("all-potential"); }}>
            <Text style={s.moreBtn}>更多 &gt;</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
          {POTENTIAL_PRODUCTS.slice(0,6).map(p => (
            <Pressable key={p.id} style={s.hCard} onPress={haptic}>
              <View style={[s.hCardImg, { backgroundColor:"#EEF6FF" }]}>
                <Text style={s.hCardEmoji}>{p.emoji}</Text>
                <View style={s.newBadge}><Text style={s.newBadgeText}>新品</Text></View>
              </View>
              <View style={s.hCardInfo}>
                <Text style={s.hCardName} numberOfLines={2}>{p.name}</Text>
                <RatingLine rating={p.rating} sold={p.sold} />
                <Text style={s.hCardPrice}>¥{p.price}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Top stores */}
        <View style={[s.secRow, { marginTop:8 }]}>
          <Text style={s.secTitle}>🏆 本月优秀店铺</Text>
          <Text style={s.secSub}>综合评分前五</Text>
        </View>
        {STORES.map((store, i) => (
          <Pressable key={store.id} style={s.storeCard} onPress={() => openStore(store)}>
            <View style={[s.storeMedal, { backgroundColor: i===0?"#F5A623":i===1?"#BABABA":i===2?"#CD7F32":"#F0EBE3" }]}>
              <Text style={[s.storeMedalTxt, { color: i<3?"#fff":TEXT2 }]}>{store.rank}</Text>
            </View>
            <View style={[s.storeCardAvatar, { backgroundColor: store.avatarBg }]}>
              <Text style={s.storeCardEmoji}>{store.emoji}</Text>
            </View>
            <View style={s.storeCardInfo}>
              <Text style={s.storeCardName}>{store.name}</Text>
              <Text style={s.storeCardDesc} numberOfLines={1}>{store.desc}</Text>
              <View style={s.storeCardMeta}>
                <Ionicons name="star" size={11} color={GOLD} />
                <Text style={s.storeCardRating}>{store.rating}</Text>
                <Text style={s.storeCardSep}>·</Text>
                <Ionicons name="trending-up" size={11} color={GREEN} />
                <Text style={s.storeCardSales}>{store.monthlySales.toLocaleString()}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={TEXT3} />
          </Pressable>
        ))}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerL1}>每一处乡村景点都有属于自己的特色文化与地域产品</Text>
          <Text style={s.footerL2}>连续2个月评分低于2.0星的店铺将暂停营业</Text>
        </View>
      </ScrollView>

      {/* Modals */}
      {([
        { key:"orders",  visible:showOrders,  close:()=>setShowOrders(false),  title:"我的订单", icon:"receipt-outline",  emptyTxt:"暂无订单记录", color:"#E07030" },
        { key:"cart",    visible:showCart,    close:()=>setShowCart(false),    title:"购物车",   icon:"cart-outline",     emptyTxt:"购物车还是空的", color:"#3A78E0" },
        { key:"coupons", visible:showCoupons, close:()=>setShowCoupons(false), title:"优惠券",   icon:"pricetag-outline", emptyTxt:"暂无可用优惠券", color:"#3A9060" },
      ] as const).map(m => (
        <Modal key={m.key} visible={m.visible} transparent animationType="slide">
          <Pressable style={s.modalOverlay} onPress={() => { haptic(); m.close(); }}>
            <Pressable style={s.modalSheet} onPress={e => e.stopPropagation()}>
              {/* Handle */}
              <View style={s.modalHandle} />
              {/* Header */}
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{m.title}</Text>
                <Pressable style={s.modalClose} onPress={() => { haptic(); m.close(); }}>
                  <Ionicons name="close" size={20} color={TEXT2} />
                </Pressable>
              </View>
              {/* Empty state */}
              <View style={s.modalEmpty}>
                <View style={[s.modalEmptyIcon, { backgroundColor: m.color + "18" }]}>
                  <Ionicons name={m.icon as any} size={36} color={m.color} />
                </View>
                <Text style={s.modalEmptyTxt}>{m.emptyTxt}</Text>
                <Text style={s.modalEmptyHint}>完成购买后，记录将显示在这里</Text>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex:1, backgroundColor:BG },

  /* Main header */
  mainHeader: { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingBottom:12, backgroundColor:CARD, borderBottomWidth:1, borderBottomColor:BORDER },
  mainBack:   { width:32, height:32, alignItems:"center", justifyContent:"center", marginRight:4 },
  mainTitle:  { fontSize:17, fontWeight:"800", color:TEXT1, flex:1 },
  searchWrap: { flexDirection:"row", alignItems:"center", backgroundColor:"#F5F0EB", borderRadius:20, paddingHorizontal:11, paddingVertical:7, gap:5, maxWidth:150 },
  searchInput:{ fontSize:12, color:TEXT1, flex:1, padding:0 },

  /* Sub header */
  subHeader:  { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingBottom:12, backgroundColor:CARD, borderBottomWidth:1, borderBottomColor:BORDER },
  backRow:    { flexDirection:"row", alignItems:"center", gap:2, minWidth:60 },
  backLabel:  { fontSize:15, color:TEXT1, fontWeight:"500" },
  subHeaderTitle: { flex:1, fontSize:16, fontWeight:"700", color:TEXT1, textAlign:"center" },
  rankBadge:  { flexDirection:"row", alignItems:"center", gap:3, backgroundColor:ORANGE_L, paddingHorizontal:8, paddingVertical:3, borderRadius:10, minWidth:60, justifyContent:"center" },
  rankBadgeText: { fontSize:11, color:ORANGE, fontWeight:"700" },

  /* Quick actions */
  quickRow:   { flexDirection:"row", justifyContent:"space-around", backgroundColor:CARD, paddingVertical:18, borderBottomWidth:1, borderBottomColor:BORDER, marginBottom:12 },
  quickBtn:   { alignItems:"center", gap:7 },
  quickIcon:  { width:54, height:54, borderRadius:18, alignItems:"center", justifyContent:"center" },
  quickLabel: { fontSize:12, color:TEXT1, fontWeight:"500" },

  /* Categories */
  catBar: { backgroundColor:CARD, borderBottomWidth:1, borderBottomColor:BORDER },
  catRow: { flexDirection:"row", alignItems:"center", gap:8, paddingVertical:8 },
  catPill:      { flexDirection:"row", alignItems:"center", alignSelf:"flex-start", gap:4, paddingHorizontal:12, paddingVertical:8, borderRadius:20, backgroundColor:CARD, borderWidth:1, borderColor:BORDER },
  catPillActive: { backgroundColor:ORANGE, borderColor:ORANGE },
  catPillText:   { fontSize:12, color:TEXT2, fontWeight:"500" },
  catPillTextActive: { color:"#fff", fontWeight:"700" },

  /* Section */
  secRow:  { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, marginBottom:10 },
  secTitle:{ fontSize:16, fontWeight:"800", color:TEXT1 },
  secSub:  { fontSize:12, color:TEXT3 },
  moreBtn: { fontSize:13, color:ORANGE, fontWeight:"600" },

  /* Horizontal product cards */
  hScroll: { paddingHorizontal:16, gap:10, paddingBottom:6 },
  hCard:   { width:140, backgroundColor:CARD, borderRadius:16, overflow:"hidden", shadowColor:"#000", shadowOpacity:0.07, shadowRadius:8, shadowOffset:{width:0,height:2}, elevation:2 },
  hCardImg:{ height:120, alignItems:"center", justifyContent:"center" },
  hCardEmoji:{ fontSize:52 },
  hCardInfo: { padding:10, gap:4 },
  hCardName: { fontSize:12, fontWeight:"600", color:TEXT1, lineHeight:17 },
  hCardPrice:{ fontSize:16, fontWeight:"800", color:ORANGE, marginTop:2 },

  /* New badge */
  newBadge:    { position:"absolute", top:7, right:7, backgroundColor:"#3A78E0", borderRadius:7, paddingHorizontal:5, paddingVertical:2 },
  newBadgeText:{ fontSize:9, color:"#fff", fontWeight:"700" },

  /* Store cards */
  storeCard:      { flexDirection:"row", alignItems:"center", backgroundColor:CARD, marginHorizontal:16, marginBottom:10, borderRadius:18, padding:14, gap:10, shadowColor:"#000", shadowOpacity:0.05, shadowRadius:8, shadowOffset:{width:0,height:2}, elevation:2 },
  storeMedal:     { width:28, height:28, borderRadius:14, alignItems:"center", justifyContent:"center", flexShrink:0 },
  storeMedalTxt:  { fontSize:13, fontWeight:"800" },
  storeCardAvatar:{ width:48, height:48, borderRadius:14, alignItems:"center", justifyContent:"center", flexShrink:0 },
  storeCardEmoji: { fontSize:24 },
  storeCardInfo:  { flex:1 },
  storeCardName:  { fontSize:14, fontWeight:"700", color:TEXT1, marginBottom:2 },
  storeCardDesc:  { fontSize:11, color:TEXT2, marginBottom:5 },
  storeCardMeta:  { flexDirection:"row", alignItems:"center", gap:3 },
  storeCardRating:{ fontSize:12, fontWeight:"700", color:GOLD },
  storeCardSep:   { fontSize:11, color:TEXT3 },
  storeCardSales: { fontSize:11, color:GREEN, fontWeight:"600" },

  /* Footer */
  footer:   { alignItems:"center", paddingVertical:28, paddingHorizontal:24, gap:10, backgroundColor:"#1A1A2E", marginTop:16 },
  footerL1: { fontSize:13, color:"rgba(255,255,255,0.7)", textAlign:"center", lineHeight:20 },
  footerL2: { fontSize:12, color:"rgba(255,255,255,0.4)", textAlign:"center" },

  /* Grid */
  gridWrap:    { flexDirection:"row", flexWrap:"wrap", gap:10, paddingHorizontal:16, paddingTop:8 },
  gridCard:    { width:"47%", backgroundColor:CARD, borderRadius:16, overflow:"hidden", shadowColor:"#000", shadowOpacity:0.05, shadowRadius:6, shadowOffset:{width:0,height:2}, elevation:1 },
  gridImg:     { height:110, alignItems:"center", justifyContent:"center" },
  gridEmoji:   { fontSize:48 },
  gridInfo:    { padding:10, gap:5 },
  gridName:    { fontSize:13, fontWeight:"600", color:TEXT1, lineHeight:18 },
  gridPrice:   { fontSize:16, fontWeight:"800", color:ORANGE, marginTop:2 },

  /* Store detail */
  storeHero:       { flexDirection:"row", padding:16, gap:14, marginBottom:4 },
  storeHeroAvatar: { width:80, height:80, borderRadius:16, alignItems:"center", justifyContent:"center", flexShrink:0 },
  storeHeroEmoji:  { fontSize:36 },
  storeHeroRight:  { flex:1 },
  storeHeroName:   { fontSize:19, fontWeight:"800", color:TEXT1, marginBottom:3 },
  storeHeroDesc:   { fontSize:12, color:TEXT2, lineHeight:17, marginBottom:12 },
  storeStatsRow:   { flexDirection:"row", alignItems:"center" },
  storeStat:       { flex:1, alignItems:"center", gap:3 },
  storeStatLabel:  { fontSize:10, color:TEXT3 },
  storeStatValRow: { flexDirection:"row", alignItems:"center", gap:2 },
  storeStatVal:    { fontSize:14, fontWeight:"700", color:TEXT1 },
  storeStatDiv:    { width:1, height:26, backgroundColor:BORDER },

  /* Tabs */
  tabs:        { flexDirection:"row", backgroundColor:CARD, borderBottomWidth:1, borderBottomColor:BORDER },
  tab:         { flex:1, paddingVertical:14, alignItems:"center" },
  tabActive:   { borderBottomWidth:2.5, borderBottomColor:ORANGE },
  tabText:     { fontSize:14, color:TEXT3, fontWeight:"500" },
  tabTextActive: { color:ORANGE, fontWeight:"700" },

  /* Reviews */
  reviewItem:     { paddingHorizontal:16 },
  reviewTop:      { flexDirection:"row", alignItems:"center", gap:10, paddingTop:14, marginBottom:7 },
  reviewAvatar:   { width:34, height:34, borderRadius:17, alignItems:"center", justifyContent:"center" },
  reviewAvatarTxt:{ fontSize:14, fontWeight:"700", color:"#fff" },
  reviewName:     { fontSize:13, fontWeight:"600", color:TEXT1, marginBottom:3 },
  reviewDate:     { fontSize:11, color:TEXT3 },
  reviewContent:  { fontSize:13, color:TEXT2, lineHeight:20, paddingBottom:14 },
  reviewDiv:      { height:1, backgroundColor:BORDER },

  /* Modal */
  modalOverlay: { flex:1, backgroundColor:"rgba(0,0,0,0.45)", justifyContent:"flex-end" },
  modalSheet:   { backgroundColor:CARD, borderTopLeftRadius:28, borderTopRightRadius:28, height:SCREEN_H * 0.72 },
  modalHandle:  { width:40, height:4, backgroundColor:"#E0DAD4", borderRadius:2, alignSelf:"center", marginTop:12, marginBottom:4 },
  modalHeader:  { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, paddingVertical:14, borderBottomWidth:1, borderBottomColor:BORDER },
  modalTitle:   { fontSize:17, fontWeight:"700", color:TEXT1 },
  modalClose:   { width:32, height:32, borderRadius:16, backgroundColor:"#F5F0EB", alignItems:"center", justifyContent:"center" },
  modalEmpty:   { flex:1, alignItems:"center", justifyContent:"center", gap:14 },
  modalEmptyIcon: { width:76, height:76, borderRadius:24, alignItems:"center", justifyContent:"center" },
  modalEmptyTxt:  { fontSize:16, fontWeight:"600", color:TEXT1 },
  modalEmptyHint: { fontSize:13, color:TEXT3 },
});
