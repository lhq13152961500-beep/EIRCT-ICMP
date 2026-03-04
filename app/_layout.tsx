import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { RecordingsProvider } from "@/contexts/RecordingsContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inTabs = segments[0] === "(tabs)";
    if (!user && inTabs) {
      router.replace("/welcome");
    } else if (user && !inTabs) {
      router.replace("/");
    }
  }, [user, segments, isLoading]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="welcome"  options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="signin"   options={{ headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="register" options={{ headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="(tabs)"   options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

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
          <RecordingsProvider>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </RecordingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
