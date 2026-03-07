import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth, type AuthUser } from "@/contexts/AuthContext";

const haptic = () => {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

// ─── Avatar placeholder ───────────────────────────────────────────────────────

function AccountAvatar({ username, size = 52 }: { username: string; size?: number }) {
  const firstChar = username.charAt(0).toUpperCase();
  const colors = [
    "#3DAA6F", "#5C6BC0", "#E91E63", "#FF9800",
    "#00897B", "#7B1FA2", "#1565C0", "#FF7043",
  ];
  const color = colors[username.charCodeAt(0) % colors.length];

  return (
    <View
      style={[
        styles.avatarCircle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color + "20", borderColor: color + "40" },
      ]}
    >
      <Text style={[styles.avatarChar, { fontSize: size * 0.42, color }]}>{firstChar}</Text>
    </View>
  );
}

// ─── AccountSwitchScreen ──────────────────────────────────────────────────────

export default function AccountSwitchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, savedAccounts, switchToAccount, removeFromSaved } = useAuth();
  const [managing, setManaging] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSwitch = (account: AuthUser) => {
    if (account.id === user?.id) return; // already active
    haptic();
    switchToAccount(account).then(() => {
      router.replace("/");
    });
  };

  const handleRemove = (account: AuthUser) => {
    haptic();
    Alert.alert(
      "移除账号",
      `确定要从设备移除「${account.username}」的登录记录吗？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "移除",
          style: "destructive",
          onPress: () => removeFromSaved(account.id),
        },
      ]
    );
  };

  const handleAddAccount = () => {
    haptic();
    router.push("/signin");
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── 顶部导航栏 ── */}
      <View style={styles.navbar}>
        <Pressable style={styles.navBtn} onPress={() => { haptic(); router.back(); }}>
          <Ionicons name="arrow-back" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.navTitle}>账号切换</Text>
        <Pressable
          style={styles.navBtn}
          onPress={() => { haptic(); setManaging((v) => !v); }}
        >
          <Text style={[styles.manageText, managing && styles.manageTextActive]}>
            {managing ? "完成" : "管理"}
          </Text>
        </Pressable>
      </View>

      {/* ── 提示文字 ── */}
      <Text style={styles.hint}>点击头像切换账号</Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 账号列表 ── */}
        <View style={styles.listCard}>
          {savedAccounts.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>暂无保存的账号</Text>
            </View>
          ) : (
            savedAccounts.map((account, index) => {
              const isActive = account.id === user?.id;
              const isLast = index === savedAccounts.length - 1;
              return (
                <Pressable
                  key={account.id}
                  style={({ pressed }) => [
                    styles.accountRow,
                    isLast && styles.accountRowLast,
                    pressed && { backgroundColor: "#F8F9FA" },
                  ]}
                  onPress={() => handleSwitch(account)}
                >
                  {/* 管理模式：左侧减号 */}
                  {managing && (
                    <Pressable
                      style={styles.removeBtn}
                      onPress={() => handleRemove(account)}
                    >
                      <Ionicons name="remove-circle" size={22} color="#E53935" />
                    </Pressable>
                  )}

                  {/* 头像 */}
                  <AccountAvatar username={account.username} size={52} />

                  {/* 用户名 */}
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>{account.username}</Text>
                    {isActive && (
                      <Text style={styles.accountSub}>当前登录中</Text>
                    )}
                  </View>

                  {/* 当前账号勾选标记 */}
                  {isActive && !managing && (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        {/* ── 添加账号 ── */}
        <View style={styles.listCard}>
          <Pressable
            style={({ pressed }) => [styles.addRow, pressed && { backgroundColor: "#F8F9FA" }]}
            onPress={handleAddAccount}
          >
            <View style={styles.addIcon}>
              <Ionicons name="add" size={26} color={Colors.light.textSecondary} />
            </View>
            <Text style={styles.addText}>添加账号</Text>
          </Pressable>
        </View>

        {/* 说明 */}
        <Text style={styles.footerNote}>
          账号登录信息仅保存在此设备上，移除不会影响账号本身
        </Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6F8" },

  // Navbar
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5E5",
  },
  navBtn: { padding: 8, minWidth: 60 },
  navTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: "#1A1A1A", textAlign: "center" },
  manageText: { fontSize: 15, color: Colors.light.textSecondary, textAlign: "right" },
  manageTextActive: { color: Colors.light.primary, fontWeight: "600" },

  // Hint
  hint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#F4F6F8",
  },

  scroll: { flex: 1 },

  // List card
  listCard: {
    backgroundColor: "#fff",
    marginHorizontal: 0,
    marginBottom: 12,
  },

  // Account row
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
  },
  accountRowLast: { borderBottomWidth: 0 },

  removeBtn: { marginRight: 4 },

  accountInfo: { flex: 1, gap: 3 },
  accountName: { fontSize: 16, fontWeight: "500", color: "#1A1A1A" },
  accountSub: { fontSize: 12, color: Colors.light.textSecondary },

  // Check circle
  checkCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#FF4B8C",
    alignItems: "center", justifyContent: "center",
  },

  // Avatar
  avatarCircle: {
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
  avatarChar: { fontWeight: "700" },

  // Add row
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  addIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#F0F0F0",
    alignItems: "center", justifyContent: "center",
  },
  addText: { fontSize: 16, color: "#333", fontWeight: "500" },

  // Empty
  emptyRow: { paddingVertical: 32, alignItems: "center" },
  emptyText: { fontSize: 14, color: Colors.light.textSecondary },

  // Footer
  footerNote: {
    fontSize: 11,
    color: "#ABABAB",
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 17,
  },
});
