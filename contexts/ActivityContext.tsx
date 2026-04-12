"use no memo";
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import type { Emotion } from "@/components/XiaoxiangFace";

export type MovementLevel = "none" | "low" | "medium" | "high" | "very_high";

export interface ActivityState {
  emotion: Emotion;
  stepRate: number;
  movementLevel: MovementLevel;
  isResting: boolean;
  activityHint: string;
}

interface ActivityContextValue extends ActivityState {
  overrideEmotion: (e: Emotion) => void;
}

const DEFAULT: ActivityState = {
  emotion: "平静",
  stepRate: 0,
  movementLevel: "none",
  isResting: true,
  activityHint: "静候中",
};

const ActivityContext = createContext<ActivityContextValue>({
  ...DEFAULT,
  overrideEmotion: () => {},
});

function classifyMovement(energy: number): {
  emotion: Emotion;
  movementLevel: MovementLevel;
  activityHint: string;
} {
  if (energy < 0.04) {
    return { emotion: "疲惫", movementLevel: "none", activityHint: "正在休息" };
  } else if (energy < 0.10) {
    return { emotion: "平静", movementLevel: "low", activityHint: "缓步游览中" };
  } else if (energy < 0.20) {
    return { emotion: "好奇", movementLevel: "medium", activityHint: "探索中" };
  } else if (energy < 0.35) {
    return { emotion: "开心", movementLevel: "high", activityHint: "活力游览中" };
  } else {
    return { emotion: "愉快", movementLevel: "very_high", activityHint: "精力充沛" };
  }
}

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ActivityState>(DEFAULT);
  const manualOverrideRef = useRef<Emotion | null>(null);
  const manualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const energyBufRef = useRef<number[]>([]);
  const restTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;

    let sub: { remove: () => void } | null = null;

    const setup = async () => {
      try {
        const { Accelerometer } = await import("expo-sensors");
        Accelerometer.setUpdateInterval(200);

        sub = Accelerometer.addListener(({ x, y, z }) => {
          const mag = Math.sqrt(x * x + y * y + z * z);
          const deviation = Math.abs(mag - 1.0);
          energyBufRef.current.push(deviation);
          if (energyBufRef.current.length > 25) energyBufRef.current.shift();

          if (deviation > 0.08) {
            if (restTimerRef.current) clearTimeout(restTimerRef.current);
            restTimerRef.current = setTimeout(() => {
              if (!manualOverrideRef.current) {
                setState(prev => ({ ...prev, isResting: true, emotion: "疲惫", movementLevel: "none", activityHint: "休息中" }));
              }
            }, 25000);
          }

          if (energyBufRef.current.length === 25) {
            const avg = energyBufRef.current.reduce((a, b) => a + b, 0) / 25;
            if (!manualOverrideRef.current) {
              const cls = classifyMovement(avg);
              const stepRate = Math.round(avg * 300);
              setState({
                ...cls,
                stepRate,
                isResting: cls.movementLevel === "none",
              });
            }
          }
        });
      } catch {
      }
    };

    setup();
    return () => {
      sub?.remove();
      if (restTimerRef.current) clearTimeout(restTimerRef.current);
      if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
    };
  }, []);

  const overrideEmotion = useCallback((e: Emotion) => {
    manualOverrideRef.current = e;
    setState(prev => ({ ...prev, emotion: e }));
    if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
    manualTimerRef.current = setTimeout(() => {
      manualOverrideRef.current = null;
    }, 5 * 60 * 1000);
  }, []);

  return (
    <ActivityContext.Provider value={{ ...state, overrideEmotion }}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  return useContext(ActivityContext);
}
