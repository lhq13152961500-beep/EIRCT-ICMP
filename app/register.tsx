"use no memo";
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ImageBackground,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

const haptic = () => {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!username.trim() || !password.trim() || !confirm.trim()) {
      setError("请填写所有字段");
      return;
    }
    if (username.trim().length < 2) {
      setError("用户名至少需要2个字符");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要6位");
      return;
    }
    if (password !== confirm) {
      setError("两次密码输入不一致");
      return;
    }
    haptic();
    setError("");
    setLoading(true);
    try {
      await register(username.trim(), password);
    } catch (e: any) {
      setError(e.message || "注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("@/assets/images/auth_bg.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.18)", "rgba(0,60,30,0.55)"]}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={[
              styles.inner,
              { paddingTop: topPad + 16, paddingBottom: bottomPad + 40 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Close button */}
            <Pressable style={styles.closeBtn} onPress={() => { haptic(); router.back(); }}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
            </Pressable>

            {/* Title */}
            <Text style={styles.title}>注册账号</Text>

            {/* Fields */}
            <View style={styles.fieldsWrap}>
              <View style={styles.field}>
                <TextInput
                  style={styles.input}
                  placeholder="请输入用户名（2-20个字符）"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  value={username}
                  onChangeText={(v) => { setUsername(v); setError(""); }}
                  autoCapitalize="none"
                  returnKeyType="next"
                  maxLength={20}
                />
              </View>

              <View style={styles.field}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="请输入密码，至少6位"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(""); }}
                  secureTextEntry={!showPw}
                  returnKeyType="next"
                />
                <Pressable onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPw ? "eye-outline" : "eye-off-outline"}
                    size={18}
                    color="rgba(255,255,255,0.6)"
                  />
                </Pressable>
              </View>

              <View style={styles.field}>
                <TextInput
                  style={styles.input}
                  placeholder="请再次输入密码"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  value={confirm}
                  onChangeText={(v) => { setConfirm(v); setError(""); }}
                  secureTextEntry={!showPw}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Submit */}
            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.88 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>注册</Text>
              }
            </Pressable>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>已有账号？</Text>
              <Pressable onPress={() => { haptic(); router.replace("/signin"); }}>
                <Text style={styles.footerLink}>直接登录</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  gradient: { flex: 1 },
  inner: {
    flexGrow: 1,
    paddingHorizontal: 36,
    alignItems: "stretch",
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 48,
  },
  fieldsWrap: {
    gap: 0,
    marginBottom: 40,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.45)",
    paddingVertical: 18,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
  },
  eyeBtn: {
    paddingLeft: 10,
  },
  errorText: {
    fontSize: 13,
    color: "#FFD0D0",
    textAlign: "center",
    marginBottom: 16,
    marginTop: -20,
  },
  submitBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: "center",
    marginBottom: 24,
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  footerText: { fontSize: 14, color: "rgba(255,255,255,0.7)" },
  footerLink: { fontSize: 14, color: Colors.light.primary, fontWeight: "600" },
});
