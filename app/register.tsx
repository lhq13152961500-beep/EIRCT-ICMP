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

function generateCaptcha() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generateSmsCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const CAPTCHA_COLORS = ["#FFD060", "#7FFFFF", "#FF9090", "#90FF90", "#C0C0FF"];

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [phone, setPhone] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaCode, setCaptchaCode] = useState(generateCaptcha);
  const [smsCode, setSmsCode] = useState("");
  const [sentSmsCode, setSentSmsCode] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshCaptcha = () => {
    haptic();
    setCaptchaCode(generateCaptcha());
    setCaptchaInput("");
  };

  const sendSms = () => {
    if (countdown > 0) return;
    if (!phone.trim() || phone.trim().length < 7) {
      setError("请输入有效的手机号码");
      return;
    }
    if (captchaInput.toUpperCase() !== captchaCode) {
      setError("图片验证码不正确");
      refreshCaptcha();
      return;
    }
    haptic();
    setError("");
    const code = generateSmsCode();
    setSentSmsCode(code);
    setError(`验证码已发送（测试码：${code}）`);
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleRegister = async () => {
    if (!phone.trim()) { setError("请输入手机号码"); return; }
    if (captchaInput.toUpperCase() !== captchaCode) { setError("图片验证码不正确"); return; }
    if (!smsCode.trim()) { setError("请输入手机验证码"); return; }
    if (smsCode !== sentSmsCode) { setError("手机验证码错误"); return; }
    if (!password || password.length < 6) { setError("密码至少6位"); return; }
    haptic();
    setError("");
    setLoading(true);
    try {
      await register(phone.trim(), password);
    } catch (e: any) {
      setError(e.message || "注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const isHint = error.startsWith("验证码已发送");

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
              <Pressable onPress={() => { haptic(); router.replace("/signin"); }}>
                <Text style={styles.switchText}>已有账号，去登录</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>注册账号</Text>

            <View style={styles.fieldsWrap}>
              {/* 手机号 */}
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

              {/* 图片验证码 */}
              <View style={styles.field}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="请输入图片验证码"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  value={captchaInput}
                  onChangeText={(v) => { setCaptchaInput(v); setError(""); }}
                  autoCapitalize="characters"
                  returnKeyType="next"
                  maxLength={4}
                />
                {/* Captcha display box */}
                <Pressable style={styles.captchaBox} onPress={refreshCaptcha}>
                  <View style={styles.captchaInner}>
                    {captchaCode.split("").map((ch, i) => (
                      <Text
                        key={i}
                        style={[
                          styles.captchaChar,
                          {
                            color: CAPTCHA_COLORS[i % CAPTCHA_COLORS.length],
                            transform: [{ rotate: `${(i % 3 - 1) * 12}deg` }],
                          },
                        ]}
                      >
                        {ch}
                      </Text>
                    ))}
                  </View>
                  <Text style={styles.captchaRefresh}>换一张</Text>
                </Pressable>
              </View>

              {/* 手机验证码 */}
              <View style={styles.field}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="请输入手机验证码"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  value={smsCode}
                  onChangeText={(v) => { setSmsCode(v); setError(""); }}
                  keyboardType="number-pad"
                  returnKeyType="next"
                  maxLength={6}
                />
                <Pressable
                  style={[styles.sendCodeBtn, countdown > 0 && styles.sendCodeBtnDisabled]}
                  onPress={sendSms}
                >
                  <Text style={styles.sendCodeText}>
                    {countdown > 0 ? `${countdown}s` : "发送验证码"}
                  </Text>
                </Pressable>
              </View>

              {/* 密码 */}
              <View style={styles.field}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="请设置密码（至少6位）"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError(""); }}
                  secureTextEntry={!showPw}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
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

            {error ? (
              <Text style={[styles.errorText, isHint && styles.hintText]}>{error}</Text>
            ) : null}

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

            <View style={styles.agreeRow}>
              <Text style={styles.agreeText}>注册即表示同意</Text>
              <Pressable onPress={haptic}>
                <Text style={styles.agreeLink}>《用户协议》</Text>
              </Pressable>
              <Text style={styles.agreeText}>和</Text>
              <Pressable onPress={haptic}>
                <Text style={styles.agreeLink}>《隐私政策》</Text>
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
    paddingVertical: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
  },
  eyeBtn: { paddingLeft: 10 },
  captchaBox: {
    marginLeft: 12,
    alignItems: "center",
    gap: 2,
  },
  captchaInner: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  captchaChar: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
  },
  captchaRefresh: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
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
    marginBottom: 20,
  },
  hintText: {
    color: "rgba(255,255,255,0.7)",
  },
  submitBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: "center",
    marginBottom: 20,
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 2,
  },
  agreeRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 2,
  },
  agreeText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
  },
  agreeLink: {
    fontSize: 12,
    color: Colors.light.primary,
  },
});
