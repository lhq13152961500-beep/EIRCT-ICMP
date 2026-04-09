"use no memo";
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import { getApiUrl } from "@/lib/query-client";

const { width: SCREEN_W } = Dimensions.get("window");

type Emotion = "愉快" | "开心" | "平静" | "好奇" | "疲惫";
type Screen = "welcome" | "chat";
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
};

const EMOTIONS: Record<Emotion, { label: string; color: string; bg: string }> = {
  愉快: { label: "愉快", color: "#E05A3A", bg: "#FFE8E2" },
  开心: { label: "开心", color: "#E07830", bg: "#FFE4CC" },
  平静: { label: "平静", color: "#4271DD", bg: "#DDE8FF" },
  好奇: { label: "好奇", color: "#7B5EA7", bg: "#EDE8FF" },
  疲惫: { label: "疲惫", color: "#888", bg: "#EFEFEF" },
};

const QUICK_CHIPS = [
  { icon: "time-outline" as const, label: "历史文化" },
  { icon: "restaurant-outline" as const, label: "特色美食" },
  { icon: "location-outline" as const, label: "景点推荐" },
  { icon: "camera-outline" as const, label: "拍照打卡" },
];

const WELCOME_FEATURES = [
  { icon: "heart-outline" as const, text: "情感计算引擎，读懂你的心情" },
  { icon: "location-outline" as const, text: "个性化推荐，发现隐藏美景" },
  { icon: "sparkles-outline" as const, text: "随时解答，趣味互动" },
];

function nowTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function XiaoxiangFace({
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

export default function XiaoxiangAiScreen() {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [emotion, setEmotion] = useState<Emotion>("平静");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      content: "你好呀！我是小乡，你的专属旅行伴游～今天想去哪里逛逛呢？我可以给你讲当地的故事、美食，还有那些藏在巷子里的宝藏小店！",
      time: nowTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (screen !== "chat") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [screen]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setInput("");

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
        time: nowTime(),
      };
      setMessages((prev) => {
        const next = [...prev, userMsg];
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        return next;
      });

      setLoading(true);
      try {
        const history = [...messages, userMsg].slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const resp = await fetch(`${getApiUrl()}/api/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, emotion }),
        });
        const data = await resp.json();
        if (data.reply) {
          if (data.emotion && EMOTIONS[data.emotion as Emotion]) {
            setEmotion(data.emotion as Emotion);
          }
          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.reply,
            time: nowTime(),
          };
          setMessages((prev) => {
            const next = [...prev, aiMsg];
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            return next;
          });
        }
      } catch {
        const errMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "哎呀，网络不太好，小乡暂时联系不上～稍后再试试吧！",
          time: nowTime(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [messages, emotion, loading]
  );

  const handleCamera = useCallback(async () => {
    setShowMediaPanel(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) sendMessage("[图片] 帮我介绍一下这里");
  }, [sendMessage]);

  const handleAlbum = useCallback(async () => {
    setShowMediaPanel(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled) sendMessage("[图片] 帮我介绍一下这里");
  }, [sendMessage]);

  const handleFile = useCallback(async () => {
    setShowMediaPanel(false);
    sendMessage("[文件] 请帮我分析这个内容");
  }, [sendMessage]);

  const emotionInfo = EMOTIONS[emotion];

  if (screen === "welcome") {
    return (
      <LinearGradient
        colors={["#FFF4EE", "#FFE8DC", "#FFF0EA"]}
        style={[styles.welcomeRoot, { paddingTop: insets.top + 20 }]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable
          style={styles.backBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        >
          <Ionicons name="chevron-back" size={24} color="#E05A3A" />
        </Pressable>

        <View style={styles.welcomeFaceWrap}>
          <XiaoxiangFace size={120} emotion="愉快" animate />
          <View style={styles.starDeco1}><Text style={{ fontSize: 18 }}>✦</Text></View>
          <View style={styles.heartDeco}><Ionicons name="heart" size={14} color="#F97340" /></View>
        </View>

        <Text style={styles.welcomeTitle}>你好，我是小乡</Text>
        <Text style={styles.welcomeSub}>您的贴心旅行伴游</Text>

        <View style={styles.featureList}>
          {WELCOME_FEATURES.map((f, i) => (
            <View key={i} style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon} size={18} color="#F97340" />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={styles.startBtnWrap}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setScreen("chat");
          }}
        >
          <LinearGradient
            colors={["#FF8C5A", "#F97340", "#E86030"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startBtn}
          >
            <Text style={styles.startBtnText}>开始旅程</Text>
            <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />
          </LinearGradient>
        </Pressable>
      </LinearGradient>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.chatRoot, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={["#FFF4EE", "#FFF9F6"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.chatHeader}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setScreen("welcome"); }}
          style={styles.headerBack}
        >
          <Ionicons name="chevron-back" size={22} color="#666" />
        </Pressable>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <XiaoxiangFace size={44} emotion={emotion} />
        </Animated.View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>小乡AI</Text>
          <Text style={styles.headerSub}>您的贴心旅行伴游</Text>
        </View>
        <View style={[styles.emotionBadge, { backgroundColor: emotionInfo.bg }]}>
          <Ionicons name="happy-outline" size={13} color={emotionInfo.color} />
          <Text style={[styles.emotionLabel, { color: emotionInfo.color }]}>{emotionInfo.label}</Text>
        </View>
        <Pressable
          style={styles.companionBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            sendMessage("我需要你的陪伴和支持，帮我推荐一些放松的活动");
          }}
        >
          <LinearGradient
            colors={["#9B59F5", "#7C3AED"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.companionGrad}
          >
            <Ionicons name="hardware-chip-outline" size={14} color="white" />
            <Text style={styles.companionText}>情感伴游</Text>
          </LinearGradient>
        </Pressable>
      </View>

      <View style={styles.chipsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
          {QUICK_CHIPS.map((chip) => (
            <Pressable
              key={chip.label}
              style={styles.chip}
              onPress={() => sendMessage(chip.label)}
            >
              <LinearGradient
                colors={["#FF8C5A", "#F97340"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.chipIcon}
              >
                <Ionicons name={chip.icon} size={16} color="white" />
              </LinearGradient>
              <Text style={styles.chipLabel}>{chip.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <View
            style={[
              styles.msgRow,
              item.role === "user" ? styles.msgRowUser : styles.msgRowAI,
            ]}
          >
            {item.role === "assistant" && (
              <View style={styles.msgAvatar}>
                <XiaoxiangFace size={32} emotion={emotion} />
              </View>
            )}
            <View
              style={[
                styles.msgBubble,
                item.role === "user" ? styles.bubbleUser : styles.bubbleAI,
              ]}
            >
              <Text style={item.role === "user" ? styles.msgTextUser : styles.msgTextAI}>
                {item.content}
              </Text>
              <Text style={styles.msgTime}>{item.time}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          loading ? (
            <View style={styles.typingRow}>
              <View style={styles.msgAvatar}>
                <XiaoxiangFace size={32} emotion={emotion} />
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color="#F97340" />
                <Text style={styles.typingText}>小乡正在思考...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {showMediaPanel && (
        <View style={styles.mediaPanel}>
          <Pressable style={styles.mediaPanelItem} onPress={handleCamera}>
            <View style={[styles.mediaPanelIcon, { backgroundColor: "#FFE8DC" }]}>
              <Ionicons name="camera-outline" size={22} color="#F97340" />
            </View>
            <Text style={styles.mediaPanelLabel}>拍照</Text>
          </Pressable>
          <Pressable style={styles.mediaPanelItem} onPress={handleAlbum}>
            <View style={[styles.mediaPanelIcon, { backgroundColor: "#DDE8FF" }]}>
              <Ionicons name="images-outline" size={22} color="#4271DD" />
            </View>
            <Text style={styles.mediaPanelLabel}>相册</Text>
          </Pressable>
          <Pressable style={styles.mediaPanelItem} onPress={handleFile}>
            <View style={[styles.mediaPanelIcon, { backgroundColor: "#EDE8FF" }]}>
              <Ionicons name="document-outline" size={22} color="#7C3AED" />
            </View>
            <Text style={styles.mediaPanelLabel}>文件</Text>
          </Pressable>
          <Pressable style={styles.mediaPanelItem} onPress={() => { setShowMediaPanel(false); sendMessage("[位置] 我在这里"); }}>
            <View style={[styles.mediaPanelIcon, { backgroundColor: "#D6F0E3" }]}>
              <Ionicons name="location-outline" size={22} color="#2E9E60" />
            </View>
            <Text style={styles.mediaPanelLabel}>位置</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          style={styles.uploadBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowMediaPanel((v) => !v); }}
        >
          <Ionicons
            name={showMediaPanel ? "close-circle-outline" : "add-circle-outline"}
            size={26}
            color={showMediaPanel ? "#7C3AED" : "#F97340"}
          />
        </Pressable>
        <TextInput
          style={styles.inputField}
          value={input}
          onChangeText={setInput}
          placeholder="问问小乡任何问题..."
          placeholderTextColor="#BBA"
          multiline
          maxLength={300}
          onSubmitEditing={() => sendMessage(input)}
          returnKeyType="send"
          onFocus={() => setShowMediaPanel(false)}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <LinearGradient
            colors={input.trim() && !loading ? ["#FF8C5A", "#F97340"] : ["#DDD", "#CCC"]}
            style={styles.sendGrad}
          >
            <Ionicons name="send" size={16} color="white" />
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  welcomeRoot: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28,
  },
  backBtn: {
    position: "absolute",
    top: 52,
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeFaceWrap: {
    marginTop: 40,
    marginBottom: 20,
    position: "relative",
    alignItems: "center",
  },
  starDeco1: {
    position: "absolute",
    top: -8,
    right: -12,
  },
  heartDeco: {
    position: "absolute",
    bottom: 0,
    left: -16,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#E05A3A",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  welcomeSub: {
    fontSize: 15,
    color: "#C07860",
    marginBottom: 32,
  },
  featureList: {
    width: "100%",
    gap: 12,
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: "#F97340",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFE8DC",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 14,
    color: "#5A3020",
    fontWeight: "500",
  },
  startBtnWrap: {
    width: "100%",
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#F97340",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 28,
  },
  startBtnText: {
    fontSize: 17,
    fontWeight: "700",
    color: "white",
    letterSpacing: 1,
  },
  chatRoot: {
    flex: 1,
    backgroundColor: "#FFF9F6",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#FFF0E8",
    gap: 8,
    shadowColor: "#F97340",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  headerBack: {
    padding: 2,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2A1810",
  },
  headerSub: {
    fontSize: 11,
    color: "#A08070",
    marginTop: 1,
  },
  emotionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  emotionLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  companionBtn: {
    borderRadius: 16,
    overflow: "hidden",
  },
  companionGrad: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    borderRadius: 16,
  },
  companionText: {
    fontSize: 12,
    color: "white",
    fontWeight: "600",
  },
  chipsRow: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#FFF0E8",
  },
  chipsContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    marginRight: 4,
  },
  chipIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  chipLabel: {
    fontSize: 11,
    color: "#5A3020",
    fontWeight: "500",
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  msgRowAI: {
    justifyContent: "flex-start",
  },
  msgRowUser: {
    justifyContent: "flex-end",
  },
  msgAvatar: {
    width: 32,
    height: 32,
    flexShrink: 0,
  },
  msgBubble: {
    maxWidth: SCREEN_W * 0.68,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleAI: {
    backgroundColor: "white",
    borderBottomLeftRadius: 4,
    shadowColor: "#F97340",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  bubbleUser: {
    backgroundColor: "#F97340",
    borderBottomRightRadius: 4,
  },
  msgTextAI: {
    fontSize: 14,
    color: "#2A1810",
    lineHeight: 21,
  },
  msgTextUser: {
    fontSize: 14,
    color: "white",
    lineHeight: 21,
  },
  msgTime: {
    fontSize: 10,
    color: "#B0A090",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "white",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typingText: {
    fontSize: 13,
    color: "#A08070",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#FFF0E8",
    gap: 8,
  },
  uploadBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginBottom: 2,
  },
  inputField: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: "#FFF4EE",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#2A1810",
    borderWidth: 1,
    borderColor: "#FFE0CC",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    flexShrink: 0,
    marginBottom: 2,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendGrad: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaPanel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#FFF0E8",
  },
  mediaPanelItem: {
    alignItems: "center",
    gap: 6,
  },
  mediaPanelIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaPanelLabel: {
    fontSize: 12,
    color: "#5A3020",
    fontWeight: "500",
  },
});
