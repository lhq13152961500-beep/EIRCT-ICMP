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
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

const haptic = () => {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

type Step = "verify" | "setPassword";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [step, setStep] = useState<Step>("verify");

  // Step 1
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 2
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isHint = error.startsWith("验证码已发送");

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

  const handleNext = () => {
    if (!phone.trim()) { setError("请输入手机号码"); return; }
    if (!smsCode.trim()) { setError("请输入验证码"); return; }
    if (smsCode !== sentCode) { setError("验证码错误，请重新输入"); return; }
    haptic();
    setError("");
    setStep("setPassword");
  };

  const handleConfirm = async () => {
    if (!newPassword || newPassword.length < 6) { setError("密码至少6位"); return; }
    if (newPassword !== confirmPassword) { setError("两次输入的密码不一致"); return; }
    haptic();
    setError("");
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        username: phone.trim(),
        password: newPassword,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "重置失败");
      // Success — go back to sign in
      router.replace("/signin");
    } catch (e: any) {
      setError(e.message || "重置失败，请重试");
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
            <View style={styles.topBar}>
              <Pressable style={styles.closeBtn} onPress={() => { haptic(); router.back(); }}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
              </Pressable>
            </View>

            {/* ─── Step 1: SMS Verification ─── */}
            {step === "verify" && (
              <>
                <Text style={styles.title}>短信验证</Text>

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
                  <Text style={[styles.errorText, isHint && styles.hintText]}>{error}</Text>
                ) : null}

                <Pressable
                  style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.88 }]}
                  onPress={handleNext}
                >
                  <Text style={styles.submitBtnText}>下一步</Text>
                </Pressable>
              </>
            )}

            {/* ─── Step 2: Set New Password ─── */}
            {step === "setPassword" && (
              <>
                <Text style={styles.title}>设置密码</Text>

                <View style={styles.fieldsWrap}>
                  <View style={styles.field}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="请输入新密码，至少6位"
                      placeholderTextColor="rgba(255,255,255,0.55)"
                      value={newPassword}
                      onChangeText={(v) => { setNewPassword(v); setError(""); }}
                      secureTextEntry={!showNew}
                      returnKeyType="next"
                    />
                    <Pressable onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
                      <Ionicons
                        name={showNew ? "eye-outline" : "eye-off-outline"}
                        size={18}
                        color="rgba(255,255,255,0.6)"
                      />
                    </Pressable>
                  </View>
                  <View style={styles.field}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="请再次输出新密码"
                      placeholderTextColor="rgba(255,255,255,0.55)"
                      value={confirmPassword}
                      onChangeText={(v) => { setConfirmPassword(v); setError(""); }}
                      secureTextEntry={!showConfirm}
                      returnKeyType="done"
                      onSubmitEditing={handleConfirm}
                    />
                    <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                      <Ionicons
                        name={showConfirm ? "eye-outline" : "eye-off-outline"}
                        size={18}
                        color="rgba(255,255,255,0.6)"
                      />
                    </Pressable>
                  </View>
                </View>

                {error ? (
                  <Text style={styles.errorText}>{error}</Text>
                ) : null}

                <Pressable
                  style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.88 }]}
                  onPress={handleConfirm}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.submitBtnText}>确认</Text>
                  }
                </Pressable>
              </>
            )}
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
    marginBottom: 36,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 48,
  },
  fieldsWrap: {
    marginBottom: 20,
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
    marginBottom: 24,
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 2,
  },
});
