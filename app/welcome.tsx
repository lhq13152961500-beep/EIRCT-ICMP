"use no memo";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Platform,
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

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loginAsGuest } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleGuest = () => {
    haptic();
    loginAsGuest();
  };

  return (
    <ImageBackground
      source={require("@/assets/images/auth_bg.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.15)", "rgba(0,40,20,0.72)"]}
        locations={[0, 0.5, 1]}
        style={styles.gradient}
      >
        {/* App name — upper area */}
        <View style={[styles.titleArea, { paddingTop: topPad + 60 }]}>
          <Text style={styles.appName}>乡音伴旅</Text>
          <Text style={styles.appTagline}>连接土地、情感与记忆</Text>
        </View>

        {/* Buttons — lower area */}
        <View style={[styles.bottomArea, { paddingBottom: bottomPad + 28 }]}>
          {/* Primary: login */}
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}
            onPress={() => { haptic(); router.push("/signin"); }}
          >
            <Text style={styles.primaryBtnText}>开启旅程</Text>
          </Pressable>

          {/* Secondary row: register + guest */}
          <View style={styles.secondaryRow}>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.8 }]}
              onPress={() => { haptic(); router.push("/register"); }}
            >
              <Text style={styles.secondaryBtnText}>注册账号</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.8 }]}
              onPress={handleGuest}
            >
              <Text style={styles.secondaryBtnText}>游客访问</Text>
            </Pressable>
          </View>

          {/* Social icons */}
          <View style={styles.socialRow}>
            <Pressable style={styles.socialBtn} onPress={haptic}>
              <Ionicons name="logo-wechat" size={28} color="rgba(255,255,255,0.75)" />
            </Pressable>
            <Pressable style={styles.socialBtn} onPress={haptic}>
              <Ionicons name="notifications-outline" size={26} color="rgba(255,255,255,0.75)" />
            </Pressable>
            <Pressable style={styles.socialBtn} onPress={haptic}>
              <Ionicons name="card-outline" size={26} color="rgba(255,255,255,0.75)" />
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  gradient: { flex: 1, justifyContent: "space-between" },

  titleArea: {
    paddingHorizontal: 32,
    gap: 10,
  },
  appName: {
    fontSize: 48,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 2,
  },
  appTagline: {
    fontSize: 16,
    color: "rgba(255,255,255,0.88)",
    fontWeight: "400",
    letterSpacing: 1,
  },

  bottomArea: {
    paddingHorizontal: 28,
    gap: 14,
  },
  primaryBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: "center",
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 2,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 14,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },

  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
    marginTop: 6,
  },
  socialBtn: {
    padding: 6,
  },
});
