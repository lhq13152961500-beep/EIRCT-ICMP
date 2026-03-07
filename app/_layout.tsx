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
  const { user, isGuest, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const segment = segments[0] as string | undefined;
    const inTabs = segment === "(tabs)";
    const isAuthScreen = ["welcome", "signin", "register", "forgot-password"].includes(segment ?? "");

    if (!user && (inTabs || (!isAuthScreen && segment !== undefined))) {
      // Fully unauthenticated (not even a guest) inside the app → welcome
      router.replace("/welcome");
    } else if (user && !isGuest && isAuthScreen) {
      // Fully logged-in user on an auth screen → send to app
      // Guests are allowed through so they can register / sign in
      router.replace("/");
    }
  }, [user, isGuest, segments, isLoading]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="welcome"  options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="signin"   options={{ headerShown: false, animation: "fade_from_bottom" }} />
      <Stack.Screen name="register"        options={{ headerShown: false, animation: "fade_from_bottom" }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false, animation: "fade_from_bottom" }} />
      <Stack.Screen name="profile-edit"    options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="account-switch"  options={{ headerShown: false, animation: "slide_from_right" }} />
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
