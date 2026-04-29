"use no memo";
import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/query-client";

const BG    = "#F4F6F8";
const TEXT1 = "#1A1A2E";
const TEXT2 = "#666880";
const TEXT3 = "#9B9BB0";

interface CustomRoute {
  id: string;
  name: string;
  poiIds: string[];
  color: string;
  icon: string;
  imageData?: string | null;
  createdAt: string;
}

const VENUE = "吐峪沟景区";

function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export default function MyRoutesPage() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useAuth();

  const [routes, setRoutes] = useState<CustomRoute[]>([]);
  const [loading, setLoading] = useState(true);

  const haptic = () => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const fetchRoutes = useCallback(async () => {
    if (!user || user.id === "guest") { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}api/custom-routes/user/${encodeURIComponent(user.id)}`);
      if (res.ok) {
        const data: CustomRoute[] = await res.json();
        setRoutes(data);
      }
    } catch (e) {
      console.warn("[MyRoutes] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchRoutes(); }, [fetchRoutes]));

  const openRoute = (route: CustomRoute) => {
    haptic();
    router.push({ pathname: "/map-guide", params: { highlightRoute: route.id } } as any);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => { haptic(); router.back(); }}>
          <Ionicons name="arrow-back" size={22} color={TEXT1} />
        </Pressable>
        <Text style={styles.headerTitle}>我的行程</Text>
        <View style={styles.headerRight}>
          <Text style={styles.countText}>{routes.length}个行程</Text>
        </View>
      </View>

      <View style={styles.venueTag}>
        <Ionicons name="location" size={13} color={Colors.light.primary} />
        <Text style={styles.venueText}>{VENUE}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      ) : routes.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="map-outline" size={56} color={TEXT3} />
          <Text style={styles.emptyTitle}>还没有自定义行程</Text>
          <Text style={styles.emptyDesc}>在地图导览中，选择景点并保存成你的专属行程</Text>
          <Pressable
            style={styles.goBtn}
            onPress={() => { haptic(); router.push("/map-guide" as any); }}
          >
            <Ionicons name="map" size={16} color="#fff" />
            <Text style={styles.goBtnText}>去地图导览创建</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {routes.map((route) => (
            <Pressable
              key={route.id}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
              onPress={() => openRoute(route)}
            >
              <View style={[styles.iconBox, { backgroundColor: route.color + "22" }]}>
                <Text style={styles.routeIcon}>{route.icon}</Text>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="business-outline" size={12} color={TEXT3} />
                    <Text style={styles.metaText}>{route.poiIds.length}个景点</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={12} color={TEXT3} />
                    <Text style={styles.metaText}>{VENUE}</Text>
                  </View>
                </View>
                <Text style={styles.dateText}>创建于 {formatDate(route.createdAt)}</Text>
              </View>

              <View style={[styles.arrowBox, { backgroundColor: route.color + "18" }]}>
                <Ionicons name="chevron-forward" size={16} color={route.color} />
              </View>
            </Pressable>
          ))}

          <Pressable
            style={styles.createBtn}
            onPress={() => { haptic(); router.push("/map-guide" as any); }}
          >
            <Ionicons name="add-circle-outline" size={18} color={Colors.light.primary} />
            <Text style={styles.createBtnText}>创建新行程</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBEB",
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: TEXT1 },
  headerRight: { alignItems: "flex-end" },
  countText: { fontSize: 13, color: TEXT2 },

  venueTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.primary + "0F",
  },
  venueText: { fontSize: 13, color: Colors.light.primary, fontWeight: "500" },

  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 12, paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: TEXT2, marginTop: 8 },
  emptyDesc: { fontSize: 13, color: TEXT3, textAlign: "center", lineHeight: 20 },
  goBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  goBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },

  list: { padding: 14, gap: 10, paddingBottom: 40 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconBox: {
    width: 50, height: 50, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  routeIcon: { fontSize: 24 },
  cardBody: { flex: 1, gap: 4 },
  routeName: { fontSize: 16, fontWeight: "700", color: TEXT1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 12, color: TEXT3 },
  dateText: { fontSize: 11, color: TEXT3, marginTop: 1 },
  arrowBox: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
  },

  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.light.primary + "40",
    borderStyle: "dashed",
  },
  createBtnText: { fontSize: 14, fontWeight: "600", color: Colors.light.primary },
});
