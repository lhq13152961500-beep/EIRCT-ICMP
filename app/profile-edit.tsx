import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/contexts/AuthContext";

const haptic = () => {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Gender = "男" | "女" | "保密";

interface ProfileData {
  name: string;
  gender: Gender;
  birthYear: string;
  birthMonth: string;
  bio: string;
  region: string;
  phone: string;
  address: string;
}

// ─── EditRow ──────────────────────────────────────────────────────────────────

function EditRow({
  label,
  value,
  placeholder,
  onPress,
  isLast,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, isLast && styles.rowLast, pressed && { backgroundColor: "#F8F9FA" }]}
      onPress={() => { haptic(); onPress(); }}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, !value && styles.rowPlaceholder]}>
          {value || placeholder || "未设置"}
        </Text>
        <Ionicons name="chevron-forward" size={15} color="#C8C8C8" />
      </View>
    </Pressable>
  );
}

// ─── ReadonlyRow ──────────────────────────────────────────────────────────────

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.row, styles.readonlyRow]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <View style={styles.roleTag}>
          <Text style={styles.roleTagText}>{value}</Text>
        </View>
      </View>
    </View>
  );
}

function getRoleLabel(role: UserRole | undefined, isGuest: boolean): string {
  if (isGuest) return "游客";
  if (role === "merchant") return "商家";
  if (role === "collector") return "村民";
  return "普通用户";
}

// ─── TextEditModal ────────────────────────────────────────────────────────────

function TextEditModal({
  visible,
  title,
  value,
  placeholder,
  keyboardType,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  value: string;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "numeric";
  onClose: () => void;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  React.useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalBox} onPress={() => {}}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            style={styles.modalInput}
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor="#C0C0C0"
            keyboardType={keyboardType ?? "default"}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => { onSave(draft.trim()); onClose(); }}
          />
          <View style={styles.modalActions}>
            <Pressable style={[styles.modalBtn, styles.modalCancel]} onPress={onClose}>
              <Text style={styles.modalCancelText}>取消</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBtn, styles.modalConfirm]}
              onPress={() => { onSave(draft.trim()); onClose(); }}
            >
              <Text style={styles.modalConfirmText}>保存</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── PickerModal ──────────────────────────────────────────────────────────────

function PickerModal<T extends string>({
  visible,
  title,
  options,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: T[];
  value: T | string;
  onClose: () => void;
  onSelect: (v: T) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.pickerBox}>
          <View style={styles.pickerHandle} />
          <View style={styles.pickerHeader}>
            <Pressable onPress={onClose}>
              <Text style={styles.pickerCancel}>取消</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>{title}</Text>
            <View style={{ width: 36 }} />
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            style={styles.pickerList}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: opt }) => (
              <Pressable
                style={({ pressed }) => [styles.pickerItem, pressed && { backgroundColor: "#F5F5F5" }]}
                onPress={() => { haptic(); onSelect(opt); onClose(); }}
              >
                <Text style={[styles.pickerItemText, opt === value && styles.pickerItemActive]}>
                  {opt}
                </Text>
                {opt === value && <Ionicons name="checkmark" size={18} color={Colors.light.primary} />}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── MONTHS / YEARS ───────────────────────────────────────────────────────────

const YEARS = Array.from({ length: 80 }, (_, i) => String(new Date().getFullYear() - i));
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

const PROVINCES = [
  "北京市", "天津市", "上海市", "重庆市",
  "河北省", "山西省", "辽宁省", "吉林省", "黑龙江省",
  "江苏省", "浙江省", "安徽省", "福建省", "江西省", "山东省",
  "河南省", "湖北省", "湖南省", "广东省", "海南省",
  "四川省", "贵州省", "云南省", "陕西省", "甘肃省",
  "青海省", "内蒙古自治区", "广西壮族自治区", "西藏自治区",
  "宁夏回族自治区", "新疆维吾尔自治区",
  "香港特别行政区", "澳门特别行政区", "台湾省",
];

// ─── ProfileEditScreen ────────────────────────────────────────────────────────

type ActiveModal =
  | "name" | "gender" | "year" | "month" | "bio" | "region" | "address" | null;

export default function ProfileEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isGuest, profile: savedProfile, updateProfile } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const roleLabel = getRoleLabel(user?.role, isGuest);
  const [isSaving, setIsSaving] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({
    name: savedProfile?.displayName ?? user?.username ?? "",
    gender: (savedProfile?.gender as Gender) ?? "保密",
    birthYear: savedProfile?.birthYear ?? "",
    birthMonth: savedProfile?.birthMonth ?? "",
    bio: savedProfile?.bio ?? "",
    region: savedProfile?.region ?? "",
    phone: savedProfile?.phone ?? "",
    address: savedProfile?.address ?? "",
  });

  // Sync form state whenever savedProfile loads (e.g. after login)
  useEffect(() => {
    if (savedProfile) {
      setProfile({
        name: savedProfile.displayName ?? user?.username ?? "",
        gender: (savedProfile.gender as Gender) ?? "保密",
        birthYear: savedProfile.birthYear ?? "",
        birthMonth: savedProfile.birthMonth ?? "",
        bio: savedProfile.bio ?? "",
        region: savedProfile.region ?? "",
        phone: savedProfile.phone ?? "",
        address: savedProfile.address ?? "",
      });
    }
  }, [savedProfile]);

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const update = (key: keyof ProfileData, value: string) => {
    setProfile((p) => ({ ...p, [key]: value }));
  };

  const handleSave = async () => {
    if (isSaving) return;
    haptic();
    setIsSaving(true);
    try {
      await updateProfile({
        displayName: profile.name || null,
        bio: profile.bio || null,
        gender: profile.gender,
        birthYear: profile.birthYear || null,
        birthMonth: profile.birthMonth || null,
        region: profile.region || null,
        phone: profile.phone || null,
        address: profile.address || null,
      });
      Alert.alert("保存成功", "个人资料已更新");
    } catch {
      Alert.alert("保存失败", "请检查网络后重试");
    } finally {
      setIsSaving(false);
    }
  };

  const birthDisplay =
    profile.birthYear && profile.birthMonth
      ? `${profile.birthYear} ${profile.birthMonth}`
      : profile.birthYear
        ? profile.birthYear
        : "";

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── 顶部导航栏 ── */}
      <View style={styles.navbar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </Pressable>
        <Text style={styles.navTitle}>个人资料</Text>
        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
          {isSaving
            ? <ActivityIndicator size="small" color={Colors.light.primary} />
            : <Text style={styles.saveBtnText}>保存</Text>
          }
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: bottomPad + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 头像 ── */}
        <View style={styles.avatarSection}>
          <Pressable
            style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.8 }]}
            onPress={() => {
              haptic();
              Alert.alert("修改头像", "请选择方式", [
                { text: "拍照", onPress: () => {} },
                { text: "从相册选择", onPress: () => {} },
                { text: "取消", style: "cancel" },
              ]);
            }}
          >
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={44} color={Colors.light.primary} />
            </View>
            <View style={styles.avatarCameraTag}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>点击更换头像</Text>
        </View>

        {/* ── 基本信息 ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>基本信息</Text>
        </View>
        <View style={styles.card}>
          <EditRow
            label="名称"
            value={profile.name}
            placeholder="请设置昵称"
            onPress={() => setActiveModal("name")}
          />
          <ReadonlyRow label="身份" value={roleLabel} />
          <EditRow
            label="性别"
            value={profile.gender}
            onPress={() => setActiveModal("gender")}
          />
          <EditRow
            label="出生年份"
            value={profile.birthYear}
            placeholder="请选择"
            onPress={() => setActiveModal("year")}
          />
          <EditRow
            label="出生月份"
            value={profile.birthMonth}
            placeholder="请选择"
            onPress={() => setActiveModal("month")}
          />
          <EditRow
            label="个性签名"
            value={profile.bio}
            placeholder="填写个性签名"
            onPress={() => setActiveModal("bio")}
          />
          <EditRow
            label="地区"
            value={profile.region}
            placeholder="请选择省份/地区"
            onPress={() => setActiveModal("region")}
            isLast
          />
        </View>

        {/* ── 联系方式 ── */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionLabelText}>联系方式</Text>
        </View>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: "#F8F9FA" }]}
            onPress={() => Alert.alert("换绑手机", "请前往「账号安全」→「换绑手机号」进行操作")}
          >
            <Text style={styles.rowLabel}>手机号</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{profile.phone}</Text>
              <Ionicons name="chevron-forward" size={15} color="#C8C8C8" />
            </View>
          </Pressable>
          <EditRow
            label="我的地址"
            value={profile.address}
            placeholder="添加收货地址"
            onPress={() => setActiveModal("address")}
            isLast
          />
        </View>

        {/* ── 收货地址提示 ── */}
        <View style={styles.hint}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.light.textSecondary} />
          <Text style={styles.hintText}>收货地址用于特产礼品购买时的默认收货地址</Text>
        </View>
      </ScrollView>

      {/* ─── Modals ───────────────────────────────────────────────────────────── */}

      <TextEditModal
        visible={activeModal === "name"}
        title="修改名称"
        value={profile.name}
        placeholder="请输入昵称"
        onClose={() => setActiveModal(null)}
        onSave={(v) => update("name", v)}
      />

      <PickerModal
        visible={activeModal === "gender"}
        title="选择性别"
        options={["男", "女", "保密"] as Gender[]}
        value={profile.gender}
        onClose={() => setActiveModal(null)}
        onSelect={(v) => update("gender", v)}
      />

      <PickerModal
        visible={activeModal === "year"}
        title="选择出生年份"
        options={YEARS}
        value={profile.birthYear}
        onClose={() => setActiveModal(null)}
        onSelect={(v) => update("birthYear", v)}
      />

      <PickerModal
        visible={activeModal === "month"}
        title="选择出生月份"
        options={MONTHS}
        value={profile.birthMonth}
        onClose={() => setActiveModal(null)}
        onSelect={(v) => update("birthMonth", v)}
      />

      <TextEditModal
        visible={activeModal === "bio"}
        title="个性签名"
        value={profile.bio}
        placeholder="填写一句话介绍自己"
        onClose={() => setActiveModal(null)}
        onSave={(v) => update("bio", v)}
      />

      <PickerModal
        visible={activeModal === "region"}
        title="选择地区"
        options={PROVINCES}
        value={profile.region}
        onClose={() => setActiveModal(null)}
        onSelect={(v) => update("region", v)}
      />

      <TextEditModal
        visible={activeModal === "address"}
        title="收货地址"
        value={profile.address}
        placeholder="请输入详细收货地址"
        onClose={() => setActiveModal(null)}
        onSave={(v) => update("address", v)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6F8" },
  scroll: { flex: 1 },

  // Navbar
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5E5",
  },
  backBtn: { padding: 6, marginRight: 4 },
  navTitle: { flex: 1, fontSize: 17, fontWeight: "600", color: "#1A1A1A", textAlign: "center" },
  saveBtn: { padding: 6 },
  saveBtnText: { fontSize: 15, fontWeight: "600", color: Colors.light.primary },

  // Avatar
  avatarSection: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  avatarWrap: { position: "relative" },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.light.primary + "15",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.light.primary + "30",
  },
  avatarCameraTag: {
    position: "absolute", bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.light.primary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  avatarHint: { marginTop: 10, fontSize: 12, color: Colors.light.textSecondary },

  // Sections
  sectionLabel: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  sectionLabelText: { fontSize: 12, fontWeight: "600", color: Colors.light.textSecondary, letterSpacing: 0.4 },

  // Card
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 14,
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EBEBEB",
    borderRadius: 4,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { width: 80, fontSize: 14, color: "#1A1A1A", fontWeight: "500" },
  rowRight: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 },
  rowValue: { fontSize: 14, color: "#666", flexShrink: 1, textAlign: "right" },
  rowPlaceholder: { color: "#C0C0C0" },
  readonlyRow: { backgroundColor: "transparent" },
  roleTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: Colors.light.primary + "18",
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.primary,
  },

  // Hint
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 28,
    paddingTop: 10,
  },
  hintText: { fontSize: 11, color: Colors.light.textSecondary, lineHeight: 16 },

  // TextEditModal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  modalBox: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 24,
    gap: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: "600", color: "#1A1A1A", textAlign: "center" },
  modalInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1A1A1A",
    backgroundColor: "#FAFAFA",
  },
  modalActions: { flexDirection: "row", gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  modalCancel: { backgroundColor: "#F0F0F0" },
  modalCancelText: { fontSize: 15, fontWeight: "500", color: "#666" },
  modalConfirm: { backgroundColor: Colors.light.primary },
  modalConfirmText: { fontSize: 15, fontWeight: "600", color: "#fff" },

  // PickerModal
  pickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  pickerBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "70%",
  },
  pickerHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginTop: 10, marginBottom: 2,
  },
  pickerList: { flexGrow: 0 },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5E5",
  },
  pickerCancel: { fontSize: 15, color: Colors.light.textSecondary },
  pickerTitle: { fontSize: 16, fontWeight: "600", color: "#1A1A1A" },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F0",
  },
  pickerItemText: { fontSize: 15, color: "#333" },
  pickerItemActive: { color: Colors.light.primary, fontWeight: "600" },
});
