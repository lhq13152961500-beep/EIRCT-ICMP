import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

const TAB_BAR_HEIGHT = 80;

const haptic = () => {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

// ─── MenuItem ─────────────────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  value,
  color = Colors.light.primary,
  badge,
  isLast = false,
  locked = false,
  onPress,
}: {
  icon: string;
  label: string;
  value?: string;
  color?: string;
  badge?: number;
  isLast?: boolean;
  locked?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        isLast && styles.menuItemLast,
        pressed && { opacity: 0.7 },
      ]}
      onPress={() => { haptic(); onPress?.(); }}
    >
      <View style={[styles.menuIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon as any} size={18} color={locked ? "#BDBDBD" : color} />
      </View>
      <Text style={[styles.menuLabel, locked && styles.menuLabelLocked]}>{label}</Text>
      <View style={styles.menuRight}>
        {locked ? (
          <Ionicons name="lock-closed-outline" size={14} color="#BDBDBD" />
        ) : (
          <>
            {badge !== undefined && badge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
            {value ? <Text style={styles.menuValue}>{value}</Text> : null}
          </>
        )}
        <Ionicons name="chevron-forward" size={15} color="#C8C8C8" />
      </View>
    </Pressable>
  );
}

// ─── OrderIconRow ──────────────────────────────────────────────────────────────

function OrderIconRow({ onPress }: { onPress: () => void }) {
  const orders = [
    { icon: "wallet-outline", label: "待付款", count: 0 },
    { icon: "cube-outline", label: "待发货", count: 1 },
    { icon: "bicycle-outline", label: "待收货", count: 0 },
    { icon: "star-outline", label: "待评价", count: 2 },
    { icon: "refresh-outline", label: "退款/售后", count: 0 },
  ];

  return (
    <View style={styles.orderRow}>
      {orders.map((o) => (
        <Pressable
          key={o.label}
          style={({ pressed }) => [styles.orderItem, pressed && { opacity: 0.7 }]}
          onPress={() => { haptic(); onPress(); }}
        >
          <View style={styles.orderIconWrap}>
            <Ionicons name={o.icon as any} size={24} color={Colors.light.primary} />
            {o.count > 0 && (
              <View style={styles.orderBadge}>
                <Text style={styles.orderBadgeText}>{o.count}</Text>
              </View>
            )}
          </View>
          <Text style={styles.orderLabel}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ─── GuestLoginBanner ─────────────────────────────────────────────────────────

function GuestLoginBanner({ onLogin }: { onLogin: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.guestBanner, pressed && { opacity: 0.85 }]}
      onPress={() => { haptic(); onLogin(); }}
    >
      <View style={styles.guestBannerInner}>
        <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.9)" />
        <Text style={styles.guestBannerText}>登录后查看更多内容</Text>
      </View>
      <View style={styles.guestBannerBtn}>
        <Text style={styles.guestBannerBtnText}>立即登录</Text>
        <Ionicons name="chevron-forward" size={13} color={Colors.light.primary} />
      </View>
    </Pressable>
  );
}

// ─── ProfileScreen ─────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, isGuest, logout, profile } = useAuth();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Redirect guest to register when touching a locked feature
  const requireLogin = () => {
    haptic();
    router.push("/register");
  };

  // Returns a real handler for logged-in users, or requireLogin for guests
  const guard = (fn: () => void) => isGuest ? requireLogin : () => { haptic(); fn(); };

  const handleLogout = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("退出登录", "确定要退出当前账号吗？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: () => logout() },
    ]);
  };

  const displayName = isGuest ? "游客" : (profile?.displayName || user?.username || "旅行者");
  const displaySub = isGuest
    ? "热爱乡村，探索每一寸土地"
    : (profile?.bio || "热爱乡村，探索每一寸土地");

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + bottomPad + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 头部 ── */}
        <LinearGradient
          colors={[Colors.light.primary, Colors.light.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: topPad + 16 }]}
        >
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={36} color={Colors.light.primary} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{displayName}</Text>
              <Text style={styles.userSub}>{displaySub}</Text>
            </View>
            {/* 已登录：编辑按钮；游客：隐藏 */}
            {!isGuest && (
              <Pressable
                style={styles.editBtn}
                onPress={() => { haptic(); router.push("/profile-edit"); }}
              >
                <Ionicons name="create-outline" size={20} color="#fff" />
              </Pressable>
            )}
          </View>

          {/* 游客：登录横幅 */}
          {isGuest && <GuestLoginBanner onLogin={() => router.push("/register")} />}

          {/* 数据统计栏 */}
          <View style={styles.statsBar}>
            {[
              { value: isGuest ? "--" : "5",  label: "声音日记" },
              { value: isGuest ? "--" : "32", label: "发现声音" },
              { value: isGuest ? "--" : "18", label: "收藏" },
              { value: isGuest ? "--" : "3",  label: "行程" },
            ].map((s, i, arr) => (
              <Pressable
                key={s.label}
                style={[styles.statCol, i < arr.length - 1 && styles.statColBorder]}
                onPress={isGuest ? requireLogin : undefined}
              >
                <Text style={styles.statNum}>{s.value}</Text>
                <Text style={styles.statLbl}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.content}>

          {/* ── 一、我的旅游 ── */}
          <SectionCard title="我的旅游">
            <MenuItem
              icon="mic-outline" label="声音日记"
              value={isGuest ? undefined : "5条"}
              color={Colors.light.primary}
              locked={isGuest}
              onPress={guard(() => {})}
            />
            <MenuItem
              icon="radio-outline" label="发现他人声音"
              value={isGuest ? undefined : "收听 32 次"}
              color="#5C6BC0" badge={isGuest ? undefined : 3}
              locked={isGuest}
              onPress={guard(() => {})}
            />
            <MenuItem
              icon="heart-outline" label="收藏的声音档案"
              value={isGuest ? undefined : "18个"}
              color="#E91E63"
              locked={isGuest}
              onPress={guard(() => {})}
            />
            <MenuItem
              icon="map-outline" label="我的行程"
              value={isGuest ? undefined : "3个"}
              color={Colors.light.accent}
              locked={isGuest}
              onPress={guard(() => {})}
            />
            <MenuItem
              icon="trophy-outline" label="方言文化成就体系"
              value={isGuest ? undefined : "LV 2"}
              color="#FF9800" isLast
              locked={isGuest}
              onPress={guard(() => {})}
            />
          </SectionCard>

          {/* ── 二、订单与个人合作 ── */}
          <SectionCard title="订单与个人合作">
            <View style={styles.allOrdersRow}>
              <Text style={styles.allOrdersLabel}>我的订单</Text>
              <Pressable
                style={({ pressed }) => [styles.allOrdersBtn, pressed && { opacity: 0.7 }]}
                onPress={isGuest ? requireLogin : haptic}
              >
                <Text style={styles.allOrdersBtnText}>查看全部</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.light.textSecondary} />
              </Pressable>
            </View>
            <OrderIconRow onPress={isGuest ? requireLogin : haptic} />
            <View style={styles.divider} />
            <MenuItem
              icon="storefront-outline" label="商家入驻" color="#FF7043"
              locked={isGuest} onPress={guard(() => {})}
            />
            <MenuItem
              icon="cash-outline" label="乡音采集增收" color="#43A047" isLast
              locked={isGuest} onPress={guard(() => {})}
            />
          </SectionCard>

          {/* ── 三、工具与设置 ── */}
          <SectionCard title="工具与设置">
            <MenuItem
              icon="person-circle-outline" label="个人资料" color={Colors.light.primary}
              locked={isGuest}
              onPress={guard(() => router.push("/profile-edit"))}
            />
            <MenuItem
              icon="shield-checkmark-outline" label="账号安全" color="#1565C0"
              locked={isGuest}
              onPress={guard(() => {})}
            />
            <MenuItem icon="language-outline" label="语言设置" value="简体中文" color="#00897B" />
            <MenuItem icon="notifications-outline" label="通知设置" color="#7B1FA2" isLast />
          </SectionCard>

          {/* ── 关于 ── */}
          <SectionCard title="关于">
            <MenuItem icon="information-circle-outline" label="关于逛游指南" color={Colors.light.primary} />
            <MenuItem icon="star-outline" label="为我们评分" color="#FFB300" isLast />
          </SectionCard>

          {/* ── 底部按钮区 ── */}
          {isGuest ? (
            /* 游客：注册/登录 */
            <Pressable
              style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.85 }]}
              onPress={() => { haptic(); router.push("/register"); }}
            >
              <Ionicons name="person-add-outline" size={18} color="#fff" />
              <Text style={styles.loginBtnText}>注册账号 / 立即登录</Text>
            </Pressable>
          ) : (
            <>
              {/* 切换账号 */}
              <Pressable
                style={({ pressed }) => [styles.switchBtn, pressed && { opacity: 0.75 }]}
                onPress={() => { haptic(); router.push("/account-switch"); }}
              >
                <Ionicons name="swap-horizontal-outline" size={18} color={Colors.light.primary} />
                <Text style={styles.switchText}>切换账号</Text>
              </Pressable>

              {/* 退出登录 */}
              <Pressable
                style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.75 }]}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={18} color="#E53935" />
                <Text style={styles.logoutText}>退出登录</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6F8" },
  scroll: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 14,
  },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  userInfo: { flex: 1, gap: 4 },
  userName: { fontSize: 20, fontWeight: "700", color: "#fff" },
  userSub: { fontSize: 12, color: "rgba(255,255,255,0.8)" },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },

  // Guest banner
  guestBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  guestBannerInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  guestBannerText: { fontSize: 13, color: "rgba(255,255,255,0.95)", fontWeight: "500" },
  guestBannerBtn: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: "#fff",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  guestBannerBtnText: { fontSize: 12, fontWeight: "700", color: Colors.light.primary },

  // Stats
  statsBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingVertical: 14,
  },
  statCol: { flex: 1, alignItems: "center", gap: 2 },
  statColBorder: { borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.25)" },
  statNum: { fontSize: 18, fontWeight: "700", color: "#fff" },
  statLbl: { fontSize: 11, color: "rgba(255,255,255,0.8)" },

  // Content
  content: { paddingHorizontal: 14, paddingTop: 16, gap: 12 },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.textSecondary,
    marginBottom: 10,
    letterSpacing: 0.4,
  },

  // MenuItem
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EBEBEB",
  },
  menuItemLast: { borderBottomWidth: 0, marginBottom: 6 },
  menuIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: "500", color: "#1A1A1A" },
  menuLabelLocked: { color: "#BDBDBD" },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  menuValue: { fontSize: 13, color: Colors.light.textSecondary },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: "#E53935",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },

  // Orders
  allOrdersRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  allOrdersLabel: { fontSize: 14, fontWeight: "600", color: "#1A1A1A" },
  allOrdersBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  allOrdersBtnText: { fontSize: 12, color: Colors.light.textSecondary },
  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 16,
  },
  orderItem: { flex: 1, alignItems: "center", gap: 7 },
  orderIconWrap: { position: "relative" },
  orderBadge: {
    position: "absolute",
    top: -4, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#E53935",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: "#fff",
  },
  orderBadgeText: { fontSize: 9, fontWeight: "700", color: "#fff" },
  orderLabel: { fontSize: 11, color: "#555", textAlign: "center" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: "#EBEBEB", marginBottom: 4 },

  // Switch Account
  switchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    marginTop: 4,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.primary + "40",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  switchText: { fontSize: 15, fontWeight: "600", color: Colors.light.primary },

  // Logout
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    marginTop: 4,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FFCDD2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutText: { fontSize: 15, fontWeight: "600", color: "#E53935" },

  // Guest login button
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.light.primary,
    marginTop: 4,
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
