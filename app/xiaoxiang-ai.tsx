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
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Markdown from "react-native-markdown-display";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { apiRequest } from "@/lib/query-client";
import { useLocation } from "@/contexts/LocationContext";
import { useActivity } from "@/contexts/ActivityContext";
import { XiaoxiangFace } from "@/components/XiaoxiangFace";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

const { width: SCREEN_W } = Dimensions.get("window");

type Emotion = "愉快" | "开心" | "平静" | "好奇" | "疲惫";
type Screen = "welcome" | "chat";
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  isVoice?: boolean;
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

const EMOTION_WELCOME: Record<string, {
  title: string;
  sub: string;
  bg: [string, string, string];
  features: { icon: "heart-outline" | "bed-outline" | "cafe-outline" | "location-outline" | "sparkles-outline" | "telescope-outline" | "map-outline" | "flag-outline"; text: string }[];
}> = {
  疲惫: {
    title: "辛苦了，我是小乡",
    sub: "累了就歇歇，我来帮你找舒适的休息点",
    bg: ["#EEF3FF", "#DDEAFF", "#EEF3FF"],
    features: [
      { icon: "bed-outline", text: "为你推荐附近休息区" },
      { icon: "cafe-outline", text: "放松一下，品尝当地特色小食" },
      { icon: "heart-outline", text: "轻松游览，不疾不徐" },
    ],
  },
  平静: {
    title: "你好，我是小乡",
    sub: "您的贴心旅行伴游",
    bg: ["#FFF4EE", "#FFE8DC", "#FFF0EA"],
    features: WELCOME_FEATURES,
  },
  好奇: {
    title: "发现你想探索！",
    sub: "让我带你揭开吐峪沟的历史秘密",
    bg: ["#F5F0FF", "#EAE0FF", "#F5F0FF"],
    features: [
      { icon: "telescope-outline", text: "深度解说12处核心景点" },
      { icon: "map-outline", text: "探索千年洞窟与丝路遗珍" },
      { icon: "sparkles-outline", text: "趣味典故，知识随问随答" },
    ],
  },
  开心: {
    title: "你看起来很开心！",
    sub: "今天一定是个美好旅程",
    bg: ["#FFFCE8", "#FFF6D0", "#FFFCE8"],
    features: [
      { icon: "heart-outline", text: "情感共鸣，分享旅途快乐" },
      { icon: "location-outline", text: "推荐绝佳拍照打卡地点" },
      { icon: "sparkles-outline", text: "趣味互动，让旅途更精彩" },
    ],
  },
  愉快: {
    title: "精力满满，出发吧！",
    sub: "今天适合深度游览，全程探索",
    bg: ["#FFF4EE", "#FFE4CC", "#FFF0EA"],
    features: [
      { icon: "flag-outline", text: "推荐全程深度游览路线" },
      { icon: "location-outline", text: "发现隐藏美景与体验活动" },
      { icon: "sparkles-outline", text: "激发探索欲，玩转吐峪沟" },
    ],
  },
};

function nowTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function XiaoxiangAiScreen() {
  const insets = useSafeAreaInsets();
  const { companion } = useLocalSearchParams<{ companion?: string }>();
  const { locationStatus } = useLocation();
  const { emotion: activityEmotion, activityHint, stepRate, overrideEmotion } = useActivity();
  const [screen, setScreen] = useState<Screen>(companion === "1" ? "chat" : "welcome");
  const [emotion, setEmotion] = useState<Emotion>(activityEmotion);
  const companionTriggered = useRef(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      content: "你好呀！我是“小乡”，你的专属旅行伴游～今天想去哪里逛逛呢？我可以给你讲当地的故事、美食，还有那些藏在巷子里的宝藏小店！",
      time: nowTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState<boolean | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const micAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    apiRequest("GET", "/api/ai/voice-status", undefined)
      .then((res: any) => res.json())
      .then((d: any) => setVoiceAvailable(!!d?.available))
      .catch(() => setVoiceAvailable(false));
  }, []);

  useEffect(() => {
    setEmotion(activityEmotion);
  }, [activityEmotion]);

  useEffect(() => {
    if (!isListening) { micAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(micAnim, { toValue: 1.22, duration: 500, useNativeDriver: true }),
        Animated.timing(micAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isListening]);

  const stopAndTranscribe = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) {
      console.log("[Voice] stopAndTranscribe: no recording ref");
      setIsListening(false);
      return;
    }
    try {
      setIsListening(false);
      setIsTranscribing(true);
      console.log("[Voice] stopping recording...");
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      console.log("[Voice] recording uri:", uri);
      if (!uri) {
        setIsTranscribing(false);
        setInput("（录音失败，请重试）");
        return;
      }
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      console.log("[Voice] base64 length:", base64.length);
      const resp = await apiRequest("POST", "/api/ai/transcribe", { audio: base64, mime: "audio/m4a" });
      const data = await (resp as any).json();
      console.log("[Voice] transcribe result:", JSON.stringify(data));
      const text: string = data.text?.trim() ?? "";
      setIsTranscribing(false);
      if (text) {
        sendMessage(text, true);
      } else if (data.error === "no_key") {
        setInput("（需要GROQ_API_KEY才能使用语音，请联系管理员配置）");
      } else {
        setInput("（未能识别语音，请重试）");
      }
    } catch (e: any) {
      console.error("[Voice] stopAndTranscribe error:", e?.message, e?.stack);
      setIsTranscribing(false);
      setIsListening(false);
      recordingRef.current = null;
      setInput("（语音处理出错，请重试）");
    }
  }, [sendMessage]);

  const handleVoice = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isListening) {
      console.log("[Voice] stopping (isListening=true)");
      await stopAndTranscribe();
      return;
    }
    if (voiceAvailable === false) {
      Alert.alert(
        "语音功能未配置",
        "语音识别需要配置 GROQ API 密钥（免费）。\n\n获取步骤：\n1. 访问 console.groq.com\n2. 注册免费账号\n3. 创建 API Key\n4. 在 Replit Secrets 添加 GROQ_API_KEY",
        [{ text: "知道了", style: "default" }]
      );
      return;
    }
    try {
      console.log("[Voice] requesting permission...");
      const { granted } = await Audio.requestPermissionsAsync();
      console.log("[Voice] permission granted:", granted);
      if (!granted) {
        setInput("（需要麦克风权限，请在设置中开启）");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      console.log("[Voice] creating recording...");
      const { recording } = await Audio.Recording.createAsync({
        android: {
          extension: ".m4a",
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: ".m4a",
          audioQuality: 0x7f,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
        isMeteringEnabled: false,
      });
      recordingRef.current = recording;
      console.log("[Voice] recording started");
      setIsListening(true);
    } catch (e: any) {
      console.error("[Voice] start error:", e?.message);
      setIsListening(false);
      setInput("（启动录音失败：" + (e?.message ?? "未知错误") + "）");
    }
  }, [isListening, stopAndTranscribe, voiceAvailable]);

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
    async (text: string, isVoice = false) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setInput("");

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
        time: nowTime(),
        isVoice,
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
        const userLocation = locationStatus.state === "located"
          ? { name: locationStatus.locationName, lat: locationStatus.lat, lng: locationStatus.lng }
          : null;
        const activityData = { hint: activityHint, stepRate };
        const resp = await apiRequest("POST", "/api/ai/chat", { messages: history, emotion, userLocation, activityData });
        const data = await resp.json();
        if (data.reply) {
          if (data.emotion && EMOTIONS[data.emotion as Emotion]) {
            setEmotion(data.emotion as Emotion);
            overrideEmotion(data.emotion as Emotion);
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

  useEffect(() => {
    if (companion === "1" && !companionTriggered.current) {
      companionTriggered.current = true;
      const timer = setTimeout(() => {
        sendMessage("\u6211\u9700\u8981\u4f60\u7684\u966a\u4f34\u548c\u652f\u6301\uff0c\u5e2e\u6211\u63a8\u8350\u4e00\u4e9b\u653e\u677e\u7684\u6d3b\u52a8");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [companion, sendMessage]);

  const emotionInfo = EMOTIONS[emotion];

  if (screen === "welcome") {
    const ew = EMOTION_WELCOME[emotion] ?? EMOTION_WELCOME["平静"];

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
          <XiaoxiangFace size={120} emotion={emotion} animate />
          <View style={styles.starDeco1}><Text style={{ fontSize: 18 }}>✦</Text></View>
          <View style={styles.heartDeco}><Ionicons name="heart" size={14} color="#F97340" /></View>
        </View>

        <Text style={styles.welcomeTitle}>{ew.title}</Text>
        <Text style={styles.welcomeSub}>{ew.sub}</Text>

        <View style={styles.featureList}>
          {ew.features.map((f, i) => (
            <View key={i} style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon as any} size={18} color="#F97340" />
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
            colors={["#2ECC8A", "#1AAD6B"]}
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
              {item.role === "user" ? (
                item.isVoice ? (
                  <View style={styles.voiceMsgInner}>
                    <Ionicons name="mic" size={16} color="white" />
                    <View style={styles.voiceWaves}>
                      {[3, 7, 11, 7, 3].map((h, i) => (
                        <View key={i} style={[styles.voiceBar, { height: h }]} />
                      ))}
                    </View>
                    <Text style={styles.voiceMsgLabel}>语音消息</Text>
                  </View>
                ) : (
                  <Text style={styles.msgTextUser}>{item.content}</Text>
                )
              ) : (
                <Markdown style={mdStyles}>{item.content}</Markdown>
              )}
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

      {(isListening || isTranscribing) && (
        <View style={styles.listeningBar}>
          <Animated.View style={{ transform: [{ scale: isListening ? micAnim : 1 }] }}>
            <Ionicons name={isTranscribing ? "hourglass-outline" : "mic"} size={18} color="#E03A20" />
          </Animated.View>
          <Text style={styles.listeningText}>
            {isTranscribing ? "正在识别语音..." : "正在听，请说话...点击停止"}
          </Text>
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
          placeholder={isListening ? "录音中..." : isTranscribing ? "识别中..." : "问问小乡任何问题..."}
          placeholderTextColor={isListening ? "#E03A20" : "#BBA"}
          multiline
          maxLength={300}
          onSubmitEditing={() => sendMessage(input)}
          returnKeyType="send"
          onFocus={() => setShowMediaPanel(false)}
          editable={!isListening && !isTranscribing}
        />
        {input.trim() && !isListening && !isTranscribing ? (
          <Pressable
            style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
            onPress={() => sendMessage(input)}
            disabled={loading}
          >
            <LinearGradient
              colors={!loading ? ["#FF8C5A", "#F97340"] : ["#DDD", "#CCC"]}
              style={styles.sendGrad}
            >
              <Ionicons name="send" size={16} color="white" />
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable style={styles.micBtn} onPress={handleVoice} disabled={loading || isTranscribing}>
            <Animated.View style={[
              styles.micGrad,
              (isListening || isTranscribing) && styles.micGradActive,
              { transform: [{ scale: isListening ? micAnim : 1 }] },
            ]}>
              {isTranscribing
                ? <ActivityIndicator size="small" color="white" />
                : <Ionicons name={isListening ? "stop" : "mic"} size={18} color="white" />
              }
            </Animated.View>
          </Pressable>
        )}
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
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    flexShrink: 0,
    marginBottom: 2,
  },
  micGrad: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#9B59B6",
  },
  micGradActive: {
    backgroundColor: "#E03A20",
  },
  listeningBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFF0EE",
    borderTopWidth: 1,
    borderTopColor: "#FFD5CC",
  },
  listeningText: {
    flex: 1,
    fontSize: 13,
    color: "#C03020",
    fontStyle: "italic",
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
  voiceMsgInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  voiceWaves: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  voiceBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  voiceMsgLabel: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
});

const mdStyles: any = {
  body: {
    fontSize: 14,
    color: "#2A1810",
    lineHeight: 21,
    backgroundColor: "transparent",
  },
  strong: {
    fontWeight: "700",
    color: "#2A1810",
  },
  em: {
    fontStyle: "italic",
    color: "#2A1810",
  },
  bullet_list: {
    marginVertical: 2,
  },
  ordered_list: {
    marginVertical: 2,
  },
  list_item: {
    marginVertical: 1,
  },
  paragraph: {
    marginVertical: 2,
  },
  heading1: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2A1810",
    marginVertical: 4,
  },
  heading2: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2A1810",
    marginVertical: 3,
  },
  code_inline: {
    backgroundColor: "#F5EDE8",
    borderRadius: 4,
    paddingHorizontal: 4,
    fontSize: 13,
    color: "#C0442A",
  },
};
