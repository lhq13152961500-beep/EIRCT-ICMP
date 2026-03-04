"use no memo";
import React, { useRef, useState } from "react";
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
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

const haptic = () => {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

type Mode = "phone" | "password";

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, loginAsGuest } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [mode, setMode] = useState<Mode>("phone");

  // — Password mode
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // — Phone mode
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (m: Mode) => {
    haptic();
    setMode(m);
    setError("");
  };

  // Generate mock 6-digit SMS code
  const sendCode = () => {
    if (countdown > 0) return;
    if (!phone.trim() || phone.trim().length < 7) {
      setError("请输入有效的手机号码");
      return;
    }
    haptic();
    setError("");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSentCode(code);
    setError(`验证码已发送（测试码：${code}）`);
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handlePhoneLogin = async () => {
    if (!phone.trim()) { setError("请输入手机号码"); return; }
    if (!smsCode.trim()) { setError("请输入验证码"); return; }
    if (smsCode !== sentCode) { setError("验证码错误，请重新输入"); return; }
    haptic();
    setError("");
    setLoading(true);
    try {
      // Use phone as username for demo
      await login(phone.trim(), sentCode!);
    } catch {
      // If no account exists, auto-register with phone
      try {
        const { apiRequest } = await import("@/lib/query-client");
        const res = await apiRequest("POST", "/api/auth/register", {
          username: phone.trim(),
          password: sentCode!,
        });
        const data = await res.json();
        if (!res.ok && data.error !== "该用户名已被注册") throw new Error(data.error);
        await login(phone.trim(), sentCode!);
      } catch (e: any) {
        setError(e.message || "登录失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!username.trim() || !password.trim()) { setError("请输入用户名和密码"); return; }
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

  const isErrorHint = error.startsWith("验证码已发送");

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
            {/* Top bar */}
            <View style={styles.topBar}>
              <Pressable style={styles.closeBtn} onPress={() => { haptic(); router.back(); }}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
              </Pressable>
              <Pressable onPress={() => switchMode(mode === "phone" ? "password" : "phone")}>
                <Text style={styles.switchText}>
                  {mode === "phone" ? "账号密码登录" : "验证码登录"}
                </Text>
              </Pressable>
            </View>

            {/* Title */}
            <Text style={styles.title}>
              {mode === "phone" ? "验证码登录" : "账号密码登录"}
            </Text>

            {/* ─── Phone mode ─── */}
            {mode === "phone" && (
              <>
                <View style={styles.fieldsWrap}>
                  <View style={styles.field}>
                    <TextInput
                      style={styles.input}
                      placeholder="请输入手机号码"
                      placeholderTextColor="rgba(255,255,255,0.55)"
                      value={phone}
                      onChangeText={(v) => { setPhone(v); setError(""); }}
                      keyboardType="phone-pad"
                      returnKeyType="next"
                      maxLength={11}
                    />
                  </View>
                  <View style={styles.field}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="请输入手机验证码"
                      placeholderTextColor="rgba(255,255,255,0.55)"
                      value={smsCode}
                      onChangeText={(v) => { setSmsCode(v); setError(""); }}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      maxLength={6}
                    />
                    <Pressable
                      style={[styles.sendCodeBtn, countdown > 0 && styles.sendCodeBtnDisabled]}
                      onPress={sendCode}
                    >
                      <Text style={styles.sendCodeText}>
                        {countdown > 0 ? `${countdown}s` : "发送验证码"}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {error ? (
                  <Text style={[styles.errorText, isErrorHint && styles.hintText]}>{error}</Text>
                ) : null}

                <View style={styles.linksRow}>
                  <Pressable onPress={() => { haptic(); router.push("/forgot-password"); }}>
                    <Text style={styles.linkText}>忘记密码</Text>
                  </Pressable>
                  <Pressable onPress={() => { haptic(); router.replace("/register"); }}>
                    <Text style={styles.linkText}>注册账户</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.88 }]}
                  onPress={handlePhoneLogin}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>登录</Text>}
                </Pressable>
              </>
            )}

            {/* ─── Password mode ─── */}
            {mode === "password" && (
              <>
                <View style={styles.fieldsWrap}>
                  <View style={styles.field}>
                    <TextInput
                      style={styles.input}
                      placeholder="请输入用户名"
                      placeholderTextColor="rgba(255,255,255,0.55)"
                      value={username}
                      onChangeText={(v) => { setUsername(v); setError(""); }}
                      autoCapitalize="none"
                      returnKeyType="next"
                    />
                  </View>
                  <View style={styles.field}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="请输入密码"
                      placeholderTextColor="rgba(255,255,255,0.55)"
                      value={password}
                      onChangeText={(v) => { setPassword(v); setError(""); }}
                      secureTextEntry={!showPw}
                      returnKeyType="done"
                      onSubmitEditing={handlePasswordLogin}
                    />
                    <Pressable onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                      <Ionicons
                        name={showPw ? "eye-outline" : "eye-off-outline"}
                        size={18}
                        color="rgba(255,255,255,0.6)"
                      />
                    </Pressable>
                  </View>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={styles.linksRow}>
                  <Pressable onPress={() => { haptic(); router.push("/forgot-password"); }}>
                    <Text style={styles.linkText}>忘记密码</Text>
                  </Pressable>
                  <Pressable onPress={() => { haptic(); router.replace("/register"); }}>
                    <Text style={styles.linkText}>注册账户</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.88 }]}
                  onPress={handlePasswordLogin}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>登录</Text>}
                </Pressable>
              </>
            )}

            {/* Social icons */}
            <View style={styles.socialRow}>
              <Pressable style={styles.socialBtn} onPress={haptic}>
                <Ionicons name="logo-wechat" size={28} color="rgba(255,255,255,0.7)" />
              </Pressable>
              <Pressable style={styles.socialBtn} onPress={haptic}>
                <AntDesign name="qq" size={26} color="rgba(255,255,255,0.7)" />
              </Pressable>
              <Pressable style={styles.socialBtn} onPress={haptic}>
                <AntDesign name="alipay-circle" size={26} color="rgba(255,255,255,0.7)" />
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
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 36,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  switchText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 36,
  },
  fieldsWrap: {
    marginBottom: 16,
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
  eyeBtn: { paddingLeft: 10 },
  sendCodeBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 12,
  },
  sendCodeBtnDisabled: {
    backgroundColor: "rgba(61,170,111,0.45)",
  },
  sendCodeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  errorText: {
    fontSize: 13,
    color: "#FFD0D0",
    marginBottom: 12,
  },
  hintText: {
    color: "rgba(255,255,255,0.7)",
  },
  linksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  linkText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  submitBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: "center",
    marginBottom: 32,
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 2,
  },
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    marginTop: 8,
  },
  socialBtn: { padding: 6 },
});
