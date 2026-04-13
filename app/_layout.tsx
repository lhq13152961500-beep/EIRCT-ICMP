import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { RecordingsProvider, useRecordings } from "@/contexts/RecordingsContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ActivityProvider } from "@/contexts/ActivityContext";

SplashScreen.preventAutoHideAsync();

function SyncUserToRecordings() {
  const { user, isGuest } = useAuth();
  const { setCurrentUserId } = useRecordings();
  useEffect(() => {
    if (user && !isGuest) {
      setCurrentUserId(user.id);
    } else {
      setCurrentUserId(null);
    }
  }, [user, isGuest, setCurrentUserId]);
  return null;
}

function RootLayoutNav() {
  const { user, isGuest, isLoading, addingAccount } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const segment = segments[0] as string | undefined;
    const inTabs = segment === "(tabs)";
    const isAuthScreen = ["welcome", "signin", "register", "forgot-password"].includes(segment ?? "");

    if (!user && (inTabs || (!isAuthScreen && segment !== undefined))) {
      router.replace("/welcome");
    } else if (user && !isGuest && isAuthScreen) {
      if (segment === "signin" && addingAccount) {
        return;
      }
      router.replace("/");
    }
  }, [user, isGuest, segments, isLoading]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="welcome"  options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="signin"   options={{ headerShown: false, animation: "fade_from_bottom" }} />
      <Stack.Screen name="register"        options={{ headerShown: false, animation: "fade_from_bottom" }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false, animation: "fade_from_bottom" }} />
      <Stack.Screen name="profile-edit"      options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="account-switch"   options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="account-security" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="map-guide"     options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="adaptive-roam" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="ar-tour"          options={{ headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="voice-guide-entry" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="voice-guide"       options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="terminal"              options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="terminal-device"      options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="sound-archive"        options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="sound-archive-record" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="villager-companion"   options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="(tabs)"   options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const handler = (e: PromiseRejectionEvent) => {
      const msg: string = e.reason?.message ?? "";
      if (msg.includes("timeout exceeded") || msg.includes("timed out")) {
        e.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LocationProvider>
            <ActivityProvider>
            <RecordingsProvider>
              <SyncUserToRecordings />
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </RecordingsProvider>
            </ActivityProvider>
          </LocationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
