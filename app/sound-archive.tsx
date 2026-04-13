"use no memo";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Platform, Animated, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";

const BG       = "#F5EFE6";
const CARD_BG  = "#FFFFFF";
const ORANGE   = "#E07030";
const ORANGE_L = "#FFF0E8";
const TEXT1    = "#1A1A2E";
const TEXT2    = "#666880";
const TEXT3    = "#9B9BB0";
const BORDER   = "#F0EBE3";

const VENUES = ["吐峪沟"];

const CATEGORIES: { label: string; icon: string; bg: string; iconColor: string }[] = [
  { label: "方言",    icon: "chatbubble-ellipses-outline", bg: "#FFF0E8", iconColor: "#E07030" },
  { label: "传统工艺", icon: "construct-outline",            bg: "#FFE8E0", iconColor: "#D05030" },
  { label: "工具声音", icon: "hammer-outline",               bg: "#E8EEFF", iconColor: "#4060D0" },
  { label: "民歌小调", icon: "musical-notes-outline",        bg: "#F0E8FF", iconColor: "#8050C0" },
  { label: "故事传说", icon: "book-outline",                  bg: "#E8F5EE", iconColor: "#3A9060" },
  { label: "自然声景", icon: "leaf-outline",                  bg: "#E4F5F0", iconColor: "#30A070" },
];

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

export default function SoundArchivePage() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 67 : insets.top;
  const { profile } = useAuth();

  const [venue, setVenue]           = useState("吐峪沟");
  const [venuePickerVisible, setVenuePickerVisible] = useState(false);
  const [stats, setStats]           = useState({ archiveCount: 0, contributorCount: 0, totalPlays: 0 });
  const [archives, setArchives]     = useState<Archive[]>([]);
  const [hotOffset, setHotOffset]   = useState(0);
  const [loading, setLoading]       = useState(true);
  const [playingId, setPlayingId]   = useState<string | null>(null);
  const soundRef                    = useRef<Audio.Sound | null>(null);

  const haptic = () => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

  const fetchData = useCallback(async (v: string) => {
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        apiRequest("GET", `/api/sound-archives/stats?venue=${encodeURIComponent(v)}`),
        apiRequest("GET", `/api/sound-archives?venue=${encodeURIComponent(v)}&sort=hot&limit=20`),
      ]);
      const s = await (sRes as any).json();
      const a = await (aRes as any).json();
      setStats(s);
      setArchives(Array.isArray(a) ? a : []);
    } catch (e) {
      console.warn("[SoundArchive] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(venue); }, [venue, fetchData]);

  const hotArchives = archives.slice(hotOffset, hotOffset + 5);

  const shuffleHot = () => {
    haptic();
    const max = Math.max(0, archives.length - 5);
    setHotOffset(Math.floor(Math.random() * (max + 1)));
  };

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
    await stopSound();
    if (!archive.audioUri) return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const apiBase = (global as any).__apiBase || "";
      const url = `${apiBase}${archive.audioUri}`;
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingId(archive.id);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          soundRef.current = null;
          setPlayingId(null);
        }
      });
    } catch (e) {
      console.warn("[SoundArchive] play error:", e);
      setPlayingId(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: BG }]}>
      {/* ── Header ── */}
      <LinearGradient
        colors={["#FFF4EC", "#F5EFE6"]}
        style={[styles.header, { paddingTop: topPad + 4 }]}
      >
        <Pressable style={styles.backBtn} onPress={() => { haptic(); router.back(); }}>
          <Ionicons name="chevron-back" size={24} color={TEXT1} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>声音档案</Text>
        </View>
        <Pressable style={styles.venueBtn} onPress={() => { haptic(); setVenuePickerVisible(true); }}>
          <Ionicons name="location" size={13} color={ORANGE} />
          <Text style={styles.venueBtnText}>{venue}</Text>
          <Ionicons name="chevron-down" size={13} color={ORANGE} />
        </Pressable>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom) + 24 }]}
      >
        {/* ── Title ── */}
        <View style={styles.titleBlock}>
          <Text style={styles.pageTitle}>声音档案</Text>
          <Text style={styles.pageSub}>记录乡土声音，传承文化记忆</Text>
        </View>

        {/* ── Stats card ── */}
        <View style={styles.statsCard}>
          <View style={styles.statsLeft}>
            <Text style={styles.statsVenueLabel}>{venue}声音记录</Text>
            {loading ? (
              <ActivityIndicator size="small" color={ORANGE} style={{ marginTop: 12 }} />
            ) : (
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <View style={[styles.statIconWrap, { backgroundColor: "#FFF0E8" }]}>
                    <Ionicons name="albums" size={20} color={ORANGE} />
                  </View>
                  <Text style={styles.statNum}>{stats.archiveCount}</Text>
                  <Text style={styles.statLabel}>份档案</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <View style={[styles.statIconWrap, { backgroundColor: "#E8F0FF" }]}>
                    <Ionicons name="people" size={20} color="#4060D0" />
                  </View>
                  <Text style={styles.statNum}>{stats.contributorCount}</Text>
                  <Text style={styles.statLabel}>位贡献者</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <View style={[styles.statIconWrap, { backgroundColor: "#E8F5EE" }]}>
                    <Ionicons name="trending-up" size={20} color="#3A9060" />
                  </View>
                  <Text style={styles.statNum}>{fmtPlays(stats.totalPlays)}</Text>
                  <Text style={styles.statLabel}>总播放</Text>
                </View>
              </View>
            )}
          </View>
          <Pressable
            style={styles.recordBtn}
            onPress={() => { haptic(); router.push("/sound-archive-record" as any); }}
          >
            <Ionicons name="mic" size={15} color="#fff" />
            <Text style={styles.recordBtnText}>录制</Text>
          </Pressable>
        </View>

        {/* ── 声音分类 ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>声音分类</Text>
        </View>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.label}
              style={styles.categoryItem}
              onPress={() => { haptic(); router.push({ pathname: "/sound-archive-category", params: { category: cat.label, venue } } as any); }}
            >
              <View style={[styles.categoryCard, { backgroundColor: cat.bg }]}>
                <Ionicons name={cat.icon as any} size={28} color={cat.iconColor} />
              </View>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── 热门档案 ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="trending-up" size={16} color={ORANGE} />
            <Text style={[styles.sectionTitle, { marginLeft: 5 }]}>热门档案</Text>
          </View>
          <Pressable style={styles.refreshBtn} onPress={shuffleHot}>
            <Ionicons name="shuffle" size={14} color={ORANGE} />
            <Text style={styles.refreshBtnText}>换一批</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={ORANGE} />
          </View>
        ) : hotArchives.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="musical-note-outline" size={40} color={TEXT3} />
            <Text style={styles.emptyText}>暂无档案，成为第一位贡献者吧</Text>
          </View>
        ) : (
          hotArchives.map((archive, idx) => (
            <Pressable
              key={archive.id}
              style={[styles.archiveCard, idx === hotArchives.length - 1 && { marginBottom: 0 }]}
              onPress={() => { haptic(); playArchive(archive); }}
              activeOpacity={0.85}
            >
              <View style={[styles.playBtn, playingId === archive.id && styles.playBtnActive]}>
                <Ionicons
                  name={playingId === archive.id ? "pause" : "play"}
                  size={20}
                  color={playingId === archive.id ? "#fff" : ORANGE}
                />
              </View>
              <View style={styles.archiveInfo}>
                <Text style={styles.archiveTitle} numberOfLines={2}>{archive.title}</Text>
                <View style={styles.archiveAuthorRow}>
                  <Text style={styles.archiveAuthor}>{archive.author}</Text>
                  {archive.isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={12} color="#3A9060" />
                    </View>
                  )}
                </View>
                <View style={styles.archiveMeta}>
                  <View style={styles.archiveTag}>
                    <Text style={styles.archiveTagText}>{archive.category}</Text>
                  </View>
                  <Text style={styles.archiveMetaText}>
                    {fmtDuration(archive.durationSeconds)} · {fmtPlays(archive.playCount)}次播放
                  </Text>
                </View>
              </View>
              {!archive.audioUri && (
                <View style={styles.noAudioBadge}>
                  <Ionicons name="volume-mute-outline" size={14} color={TEXT3} />
                </View>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* ── Venue picker modal ── */}
      <Modal visible={venuePickerVisible} transparent animationType="fade" onRequestClose={() => setVenuePickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setVenuePickerVisible(false)}>
          <View style={[styles.venuePicker, { top: topPad + 50 }]}>
            <Text style={styles.venuePickerTitle}>选择景区</Text>
            {VENUES.map((v) => (
              <Pressable
                key={v}
                style={[styles.venuePickerItem, v === venue && styles.venuePickerItemActive]}
                onPress={() => { haptic(); setVenue(v); setVenuePickerVisible(false); }}
              >
                <Ionicons name="location" size={16} color={v === venue ? ORANGE : TEXT2} />
                <Text style={[styles.venuePickerText, v === venue && styles.venuePickerTextActive]}>{v}</Text>
                {v === venue && <Ionicons name="checkmark" size={16} color={ORANGE} style={{ marginLeft: "auto" }} />}
              </Pressable>
            ))}
            <Text style={styles.venuePickerNote}>更多景区即将开放</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  backBtn:      { padding: 4, marginRight: 4 },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 17, fontWeight: "700", color: TEXT1 },
  venueBtn:     { flexDirection: "row", alignItems: "center", backgroundColor: ORANGE_L, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 3 },
  venueBtnText: { fontSize: 13, fontWeight: "600", color: ORANGE },

  scroll:      { paddingHorizontal: 16, paddingTop: 4 },
  titleBlock:  { paddingVertical: 18 },
  pageTitle:   { fontSize: 28, fontWeight: "800", color: TEXT1, letterSpacing: -0.5 },
  pageSub:     { fontSize: 14, color: TEXT2, marginTop: 4 },

  statsCard:    { backgroundColor: CARD_BG, borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", shadowColor: "#C87030", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3, marginBottom: 24 },
  statsLeft:    { flex: 1 },
  statsVenueLabel: { fontSize: 13, fontWeight: "600", color: TEXT2, marginBottom: 4 },
  statsRow:     { flexDirection: "row", alignItems: "center", marginTop: 10 },
  statItem:     { flex: 1, alignItems: "center" },
  statIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  statNum:      { fontSize: 20, fontWeight: "800", color: TEXT1 },
  statLabel:    { fontSize: 11, color: TEXT2, marginTop: 2 },
  statDivider:  { width: 1, height: 40, backgroundColor: BORDER, marginHorizontal: 4 },
  recordBtn:    { backgroundColor: ORANGE, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 5, shadowColor: ORANGE, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4, marginLeft: 14 },
  recordBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  sectionHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, marginTop: 6 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center" },
  sectionTitle:    { fontSize: 17, fontWeight: "700", color: TEXT1 },
  refreshBtn:      { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: ORANGE_L, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  refreshBtnText:  { fontSize: 12, color: ORANGE, fontWeight: "600" },

  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  categoryItem: { width: "30%", alignItems: "center" },
  categoryCard: { width: "100%", aspectRatio: 1.2, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  categoryLabel: { fontSize: 13, fontWeight: "600", color: TEXT1, textAlign: "center" },

  loadingBox: { height: 200, alignItems: "center", justifyContent: "center" },
  emptyBox:   { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText:  { fontSize: 14, color: TEXT3, textAlign: "center" },

  archiveCard:   { backgroundColor: CARD_BG, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  playBtn:       { width: 46, height: 46, borderRadius: 23, backgroundColor: ORANGE_L, alignItems: "center", justifyContent: "center", marginRight: 14, flexShrink: 0 },
  playBtnActive: { backgroundColor: ORANGE },
  archiveInfo:   { flex: 1, gap: 3 },
  archiveTitle:  { fontSize: 15, fontWeight: "700", color: TEXT1, lineHeight: 20 },
  archiveAuthorRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  archiveAuthor: { fontSize: 12, color: TEXT2 },
  verifiedBadge: { backgroundColor: "#E8F5EE", borderRadius: 8, padding: 2 },
  archiveMeta:   { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  archiveTag:    { backgroundColor: ORANGE_L, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  archiveTagText: { fontSize: 11, color: ORANGE, fontWeight: "600" },
  archiveMetaText: { fontSize: 11, color: TEXT3 },
  noAudioBadge:  { padding: 4 },

  modalBackdrop:     { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  venuePicker:       { position: "absolute", right: 16, backgroundColor: CARD_BG, borderRadius: 18, padding: 16, minWidth: 180, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  venuePickerTitle:  { fontSize: 13, fontWeight: "700", color: TEXT3, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  venuePickerItem:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 4, borderRadius: 12 },
  venuePickerItemActive: { backgroundColor: ORANGE_L },
  venuePickerText:   { fontSize: 15, color: TEXT1, fontWeight: "500" },
  venuePickerTextActive: { color: ORANGE, fontWeight: "700" },
  venuePickerNote:   { fontSize: 11, color: TEXT3, textAlign: "center", marginTop: 12 },
});
