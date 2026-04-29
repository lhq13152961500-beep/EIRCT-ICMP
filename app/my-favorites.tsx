"use no memo";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";

const BG      = "#F5EFE6";
const CARD_BG = "#FFFFFF";
const ORANGE  = "#E07030";
const ORANGE_L= "#FFF0E8";
const TEXT1   = "#1A1A2E";
const TEXT2   = "#666880";
const TEXT3   = "#9B9BB0";

interface Archive {
  id: string;
  venue: string;
  category: string;
  title: string;
  author: string;
  durationSeconds: number;
  playCount: number;
  isVerified: boolean;
  audioUri?: string;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtPlays(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000)  return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "方言":    { bg: "#FFF0E8", text: "#E07030" },
  "传统工艺": { bg: "#FFE8E0", text: "#D05030" },
  "工具声音": { bg: "#E8EEFF", text: "#4060D0" },
  "民歌小调": { bg: "#F0E8FF", text: "#8050C0" },
  "故事传说": { bg: "#E8F5EE", text: "#3A9060" },
  "自然声景": { bg: "#E4F5F0", text: "#30A070" },
};

let _gSound: Audio.Sound | null = null;
async function stopGlobalAudio() {
  if (_gSound) {
    try { await _gSound.stopAsync(); await _gSound.unloadAsync(); } catch {}
    _gSound = null;
  }
}

export default function MyFavoritesPage() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useAuth();

  const [archives, setArchives] = useState<Archive[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const soundRef = useRef<Audio.Sound | null>(null);

  const haptic = () => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const fetchFavorites = useCallback(async () => {
    if (!user || user.id === "guest") { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}api/sound-archives/favorites-full/${encodeURIComponent(user.id)}`);
      if (res.ok) {
        const data: Archive[] = await res.json();
        setArchives(data);
        setFavIds(new Set(data.map((a) => a.id)));
      }
    } catch (e) {
      console.warn("[MyFavorites] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const stopSound = async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    setPlayingId(null);
  };

  const playArchive = async (archive: Archive) => {
    haptic();
    if (playingId === archive.id) { await stopSound(); return; }
    await stopGlobalAudio();
    await stopSound();
    if (!archive.audioUri) return;
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      const apiBase = getApiUrl().replace(/\/$/, "");
      const url = archive.audioUri.startsWith("http") ? archive.audioUri : `${apiBase}${archive.audioUri}`;
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
      _gSound = sound;
      setPlayingId(archive.id);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          setPlayingId(null);
          if (_gSound === sound) _gSound = null;
        }
      });
    } catch (e) {
      console.warn("[MyFavorites] play error:", e);
    }
  };

  const unfavorite = async (archiveId: string) => {
    if (!user || user.id === "guest") return;
    haptic();
    setFavIds((prev) => { const next = new Set(prev); next.delete(archiveId); return next; });
    setArchives((prev) => prev.filter((a) => a.id !== archiveId));
    if (playingId === archiveId) await stopSound();
    try {
      await fetch(`${getApiUrl()}api/sound-archives/${archiveId}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (e) {
      console.warn("[MyFavorites] unfavorite error:", e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => { haptic(); router.back(); }}>
          <Ionicons name="arrow-back" size={22} color={TEXT1} />
        </Pressable>
        <Text style={styles.headerTitle}>收藏的声音档案</Text>
        <View style={styles.headerRight}>
          <Text style={styles.countText}>{archives.length}件</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : archives.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="star-outline" size={56} color={TEXT3} />
          <Text style={styles.emptyTitle}>暂无收藏</Text>
          <Text style={styles.emptyDesc}>在声音档案中，点击{"\u2605"}收藏文化声音作品</Text>
          <Pressable style={styles.goBtn} onPress={() => { haptic(); router.push("/sound-archive" as any); }}>
            <Text style={styles.goBtnText}>去声音档案看看</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.listHint}>点击卡片播放，点击星标取消收藏</Text>
          {archives.map((archive) => {
            const isPlaying = playingId === archive.id;
            const catStyle = CATEGORY_COLORS[archive.category] ?? { bg: "#F0F0F0", text: TEXT2 };
            return (
              <Pressable
                key={archive.id}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
                onPress={() => { haptic(); playArchive(archive); }}
                activeOpacity={0.88}
              >
                <View style={[styles.playIcon, isPlaying && styles.playIconActive]}>
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={20}
                    color={isPlaying ? "#fff" : ORANGE}
                  />
                </View>

                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{archive.title}</Text>
                  <View style={styles.authorRow}>
                    <Text style={styles.authorText}>{archive.author}</Text>
                    {archive.isVerified && (
                      <Ionicons name="checkmark-circle" size={12} color="#3A9060" />
                    )}
                  </View>
                  <View style={styles.metaRow}>
                    <View style={[styles.catTag, { backgroundColor: catStyle.bg }]}>
                      <Text style={[styles.catText, { color: catStyle.text }]}>{archive.category}</Text>
                    </View>
                    <Text style={styles.metaText}>
                      {fmtDuration(archive.durationSeconds)} · {fmtPlays(archive.playCount)}次播放
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={styles.starBtn}
                  onPress={() => unfavorite(archive.id)}
                  hitSlop={8}
                >
                  <Ionicons name="star" size={20} color="#FFB800" />
                </Pressable>
              </Pressable>
            );
          })}
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
    borderBottomColor: "#F0EBE3",
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: TEXT1 },
  headerRight: { alignItems: "flex-end" },
  countText: { fontSize: 13, color: TEXT2 },

  center: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: TEXT2, marginTop: 8 },
  emptyDesc: { fontSize: 13, color: TEXT3, textAlign: "center", lineHeight: 20 },
  goBtn: {
    marginTop: 8,
    backgroundColor: ORANGE,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  goBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },

  list: { padding: 16, gap: 10, paddingBottom: 40 },
  listHint: { fontSize: 12, color: TEXT3, textAlign: "center", marginBottom: 4 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  playIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: ORANGE_L,
    alignItems: "center", justifyContent: "center",
    marginRight: 12,
  },
  playIconActive: { backgroundColor: ORANGE },
  cardInfo: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: TEXT1, lineHeight: 20 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  authorText: { fontSize: 12, color: TEXT2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  catTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  catText: { fontSize: 11, fontWeight: "600" },
  metaText: { fontSize: 11, color: TEXT3 },
  starBtn: { padding: 4, marginLeft: 4 },
});
