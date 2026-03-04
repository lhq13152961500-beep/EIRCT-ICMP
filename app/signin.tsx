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
  Alert,
  KeyboardAvoidingView,
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

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("请输入用户名和密码");
      return;
    }
    haptic();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (e: any) {
      setError(e.message || "登录失败，请重试");
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
        colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.15)", "rgba(0,40,20,0.78)"]}
        locations={[0, 0.45, 1]}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Back */}
          <Pressable
            style={[styles.backBtn, { top: topPad + 12 }]}
            onPress={() => { haptic(); router.back(); }}
          >
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.9)" />
          </Pressable>

          <View style={styles.spacer} />

          {/* Form card */}
          <View style={[styles.card, { paddingBottom: bottomPad + 24 }]}>
            <Text style={styles.cardTitle}>欢迎回来</Text>
            <Text style={styles.cardSub}>登录，继续你的乡音旅程</Text>

            <View style={styles.field}>
              <Ionicons name="person-outline" size={18} color={Colors.light.textSecondary} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="用户名"
                placeholderTextColor="#aaa"
                value={username}
                onChangeText={(v) => { setUsername(v); setError(""); }}
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.light.textSecondary} style={styles.fieldIcon} />
              <TextInput
                style={styles.input}
                placeholder="密码"
                placeholderTextColor="#aaa"
                value={password}
                onChangeText={(v) => { setPassword(v); setError(""); }}
                secureTextEntry={!showPw}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                <Ionicons name={showPw ? "eye-outline" : "eye-off-outline"} size={18} color={Colors.light.textSecondary} />
              </Pressable>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>登录</Text>
              }
            </Pressable>

            <View style={styles.footer}>
              <Text style={styles.footerText}>还没有账号？</Text>
              <Pressable onPress={() => { haptic(); router.replace("/register"); }}>
                <Text style={styles.footerLink}>立即注册</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  gradient: { flex: 1 },
  backBtn: {
    position: "absolute",
    left: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: { flex: 1 },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 32,
    gap: 16,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  cardSub: {
    fontSize: 14,
    color: "#888",
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 16 : 12,
  },
  fieldIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A1A",
  },
  eyeBtn: { padding: 4 },
  errorText: {
    fontSize: 13,
    color: "#E04040",
    textAlign: "center",
    marginTop: -6,
  },
  primaryBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    marginTop: 4,
  },
  footerText: { fontSize: 14, color: "#888" },
  footerLink: { fontSize: 14, color: Colors.light.primary, fontWeight: "600" },
});
