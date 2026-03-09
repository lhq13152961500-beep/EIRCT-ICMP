import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

const haptic = () => {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

function SecurityRow({
  icon,
  iconColor,
  label,
  value,
  status,
  statusColor,
  onPress,
  isLast,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value?: string;
  status?: string;
  statusColor?: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowBorder,
        pressed && onPress && { backgroundColor: "#F8F9FA" },
      ]}
      onPress={() => { if (onPress) { haptic(); onPress(); } }}
      disabled={!onPress}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconColor + "15" }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {status ? (
          <View style={[styles.statusBadge, { backgroundColor: (statusColor || "#999") + "15" }]}>
            <Text style={[styles.statusText, { color: statusColor || "#999" }]}>{status}</Text>
          </View>
        ) : null}
        {onPress ? <Ionicons name="chevron-forward" size={16} color="#CCC" /> : null}
      </View>
    </Pressable>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function DeviceItem({
  name,
  model,
  lastLogin,
  isCurrent,
  isLast,
}: {
  name: string;
  model: string;
  lastLogin: string;
  isCurrent?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.deviceRow, !isLast && styles.rowBorder]}>
      <View style={[styles.rowIcon, { backgroundColor: "#1565C015" }]}>
        <Ionicons name="phone-portrait-outline" size={18} color="#1565C0" />
      </View>
      <View style={styles.deviceInfo}>
        <View style={styles.deviceNameRow}>
          <Text style={styles.deviceName}>{name}</Text>
          {isCurrent && (
            <View style={[styles.statusBadge, { backgroundColor: Colors.light.primary + "15" }]}>
              <Text style={[styles.statusText, { color: Colors.light.primary }]}>当前设备</Text>
            </View>
          )}
        </View>
        <Text style={styles.deviceMeta}>{model} · {lastLogin}</Text>
      </View>
      {!isCurrent && (
        <Pressable
          style={styles.deviceRemoveBtn}
          onPress={() => {
            haptic();
            Alert.alert("下线设备", `确定要将「${name}」从登录设备中移除吗？`, [
              { text: "取消", style: "cancel" },
              { text: "确认下线", style: "destructive", onPress: () => Alert.alert("已下线", `「${name}」已被移除`) },
            ]);
          }}
        >
          <Text style={styles.deviceRemoveText}>下线</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function AccountSecurityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isPhoneNumber = (s: string) => /^1\d{10}$/.test(s);
  const rawPhone = profile?.phone && isPhoneNumber(profile.phone)
    ? profile.phone
    : user?.username && isPhoneNumber(user.username)
      ? user.username
      : null;
  const phoneIsBound = !!rawPhone;
  const maskedPhone = rawPhone
    ? rawPhone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2")
    : "未绑定";

  const handleChangePhone = () => {
    Alert.alert(
      "换绑手机号",
      "换绑手机号需要验证当前手机号后绑定新手机号。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "开始验证",
          onPress: () => Alert.alert("提示", "该功能需要短信验证服务支持，暂未开放"),
        },
      ]
    );
  };

  const handleBindEmail = () => {
    Alert.alert(
      "绑定邮箱",
      "绑定邮箱后可用于找回密码和接收重要通知。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "去绑定",
          onPress: () => Alert.alert("提示", "该功能需要邮件验证服务支持，暂未开放"),
        },
      ]
    );
  };

  const handleRealName = () => {
    Alert.alert(
      "实名认证",
      "实名认证后可获得更多权益，如发布商户内容、参与活动等。\n\n需提供：\n· 真实姓名\n· 身份证号码",
      [
        { text: "取消", style: "cancel" },
        {
          text: "去认证",
          onPress: () => Alert.alert("提示", "该功能需要实名认证服务支持，暂未开放"),
        },
      ]
    );
  };

  const handleBindThirdParty = (name: string, icon: string) => {
    Alert.alert(
      `绑定${name}`,
      `绑定${name}后可使用${name}快捷登录。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "去绑定",
          onPress: () => Alert.alert("提示", `${name}授权登录服务暂未开放`),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.navbar}>
        <Pressable style={styles.navBtn} onPress={() => { haptic(); router.back(); }}>
          <Ionicons name="arrow-back" size={22} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.navTitle}>账号安全</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <SectionCard title="手机与邮箱">
          <SecurityRow
            icon="call-outline"
            iconColor={Colors.light.primary}
            label="手机号"
            value={maskedPhone}
            status={phoneIsBound ? "已绑定" : "未绑定"}
            statusColor={phoneIsBound ? Colors.light.primary : "#E53935"}
            onPress={handleChangePhone}
          />
          <SecurityRow
            icon="mail-outline"
            iconColor="#1565C0"
            label="邮箱"
            status="未绑定"
            statusColor="#999"
            onPress={handleBindEmail}
            isLast
          />
        </SectionCard>

        <SectionCard title="身份认证">
          <SecurityRow
            icon="shield-checkmark-outline"
            iconColor="#FF9800"
            label="实名认证"
            status="未认证"
            statusColor="#999"
            onPress={handleRealName}
            isLast
          />
        </SectionCard>

        <SectionCard title="第三方账号">
          <SecurityRow
            icon="chatbubble-ellipses-outline"
            iconColor="#07C160"
            label="微信"
            status="未绑定"
            statusColor="#999"
            onPress={() => handleBindThirdParty("微信", "wechat")}
          />
          <SecurityRow
            icon="chatbubbles-outline"
            iconColor="#12B7F5"
            label="QQ"
            status="未绑定"
            statusColor="#999"
            onPress={() => handleBindThirdParty("QQ", "qq")}
          />
          <SecurityRow
            icon="wallet-outline"
            iconColor="#1677FF"
            label="支付宝"
            status="未绑定"
            statusColor="#999"
            onPress={() => handleBindThirdParty("支付宝", "alipay")}
            isLast
          />
        </SectionCard>

        <SectionCard title="登录设备管理">
          <DeviceItem
            name={Platform.OS === "web" ? "网页浏览器" : "当前手机"}
            model={Platform.OS === "web" ? "Web 端" : Platform.OS === "ios" ? "iPhone" : "Android"}
            lastLogin="刚刚"
            isCurrent
          />
          <DeviceItem
            name="其他设备"
            model="未知型号"
            lastLogin="暂无记录"
            isLast
          />
        </SectionCard>

        <Text style={styles.footerNote}>
          绑定多种登录方式可以提高账号安全性{"\n"}如遇到账号异常，请及时修改密码
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6F8" },

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

  scroll: { flex: 1 },

  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#999",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "500", color: "#1A1A1A" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue: { fontSize: 14, color: "#666", marginRight: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: { fontSize: 11, fontWeight: "600" },

  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  deviceInfo: { flex: 1, gap: 3 },
  deviceNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  deviceName: { fontSize: 15, fontWeight: "500", color: "#1A1A1A" },
  deviceMeta: { fontSize: 12, color: "#999" },
  deviceRemoveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E53935",
  },
  deviceRemoveText: { fontSize: 12, color: "#E53935", fontWeight: "500" },

  footerNote: {
    fontSize: 11,
    color: "#ABABAB",
    textAlign: "center",
    paddingHorizontal: 32,
    paddingTop: 20,
    lineHeight: 17,
  },
});
