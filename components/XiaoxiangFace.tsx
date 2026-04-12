"use no memo";
import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export type Emotion = "愉快" | "开心" | "平静" | "好奇" | "疲惫";

export function XiaoxiangFace({
  size = 80,
  emotion = "平静" as Emotion,
  animate = false,
}: {
  size?: number;
  emotion?: Emotion;
  animate?: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animate]);

  const tired = emotion === "疲惫";
  const curious = emotion === "好奇";
  const happy = emotion === "愉快" || emotion === "开心";

  const eyeH = tired ? size * 0.055 : size * 0.09;
  const eyeW = size * 0.09;
  const eyeTop = size * (tired ? 0.35 : 0.33);

  const mouthW = happy ? size * 0.38 : size * 0.26;
  const mouthH = happy ? size * 0.16 : size * 0.1;
  const mouthTop = size * (tired ? 0.56 : 0.54);
  const mouthRadius = happy ? size * 0.16 : size * 0.08;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <LinearGradient
        colors={["#FF8C5A", "#F97340"]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          position: "relative",
          shadowColor: "#F97340",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: eyeTop,
            left: size * 0.24,
            width: eyeW,
            height: eyeH,
            borderRadius: eyeH / 2,
            backgroundColor: "white",
          }}
        />
        <View
          style={{
            position: "absolute",
            top: eyeTop,
            right: size * 0.24,
            width: curious ? eyeW * 1.3 : eyeW,
            height: eyeH,
            borderRadius: eyeH / 2,
            backgroundColor: "white",
          }}
        />
        <View
          style={{
            position: "absolute",
            top: mouthTop,
            left: (size - mouthW) / 2,
            width: mouthW,
            height: mouthH,
            borderBottomLeftRadius: mouthRadius,
            borderBottomRightRadius: mouthRadius,
            borderTopLeftRadius: tired ? mouthRadius : 0,
            borderTopRightRadius: tired ? mouthRadius : 0,
            backgroundColor: "white",
            opacity: 0.9,
          }}
        />
      </LinearGradient>
    </Animated.View>
  );
}
