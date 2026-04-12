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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Speech from "expo-speech";

const { width: SCREEN_W } = Dimensions.get("window");

type Emotion = "愉快" | "开心" | "平静" | "好奇" | "疲惫";
type Screen = "welcome" | "chat" | "companion";
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
  const [screen, setScreen] = useState<Screen>(companion === "1" ? "companion" : "welcome");
  const [emotion, setEmotion] = useState<Emotion>(activityEmotion);
  const companionTriggered = useRef(false);
  const [isCompanionActive, setIsCompanionActive] = useState(false);
  const [companionStatus, setCompanionStatus] = useState<"idle" | "listening" | "processing">("idle");
  const [voiceEnrolled, setVoiceEnrolled] = useState(false);
  const [enrolledPrompt, setEnrolledPrompt] = useState("");
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollCountdown, setEnrollCountdown] = useState(0);
  const [companionResponse, setCompanionResponse] = useState("");
  const companionActiveRef = useRef(false);
  const enrollRecordingRef = useRef<Audio.Recording | null>(null);
  const companionRecordingRef = useRef<Audio.Recording | null>(null);
  const [doubaoReady, setDoubaoReady] = useState(false);
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
    AsyncStorage.getItem("voiceEnrollPrompt").then((val) => {
      if (val) { setVoiceEnrolled(true); setEnrolledPrompt(val); }
    });
    apiRequest("GET", "/api/doubao/status", undefined)
      .then((r: any) => r.json())
      .then((d: any) => setDoubaoReady(!!d?.configured))
      .catch(() => setDoubaoReady(false));
  }, []);

  const startEnrollment = useCallback(async () => {
    if (!doubaoReady && voiceAvailable === false) {
      Alert.alert("语音功能未配置", "需要配置 GROQ_API_KEY 或豆包语音凭证才能使用语音功能。");
      return;
    }
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) { Alert.alert("需要麦克风权限"); return; }
    // Stop companion mode and its active recording immediately
    Speech.stop();
    if (companionActiveRef.current) {
      companionActiveRef.current = false;
      setIsCompanionActive(false);
      setCompanionStatus("idle");
    }
    if (companionRecordingRef.current) {
      try { await companionRecordingRef.current.stopAndUnloadAsync(); } catch {}
      companionRecordingRef.current = null;
    }
    // Stop any enrollment recording already in progress
    if (enrollRecordingRef.current) {
      try { await enrollRecordingRef.current.stopAndUnloadAsync(); } catch {}
      enrollRecordingRef.current = null;
    }
    // Stop chat voice recording if active
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
      recordingRef.current = null;
      setIsListening(false);
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync({
      android: { extension: ".m4a", outputFormat: 2, audioEncoder: 3, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
      ios: { extension: ".m4a", audioQuality: 127, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
      web: {},
    });
    enrollRecordingRef.current = recording;
    setIsEnrolling(true);
    setEnrollCountdown(5);
    let count = 5;
    const timer = setInterval(() => {
      count -= 1;
      setEnrollCountdown(count);
      if (count <= 0) {
        clearInterval(timer);
        stopEnrollment();
      }
    }, 1000);
  }, [voiceAvailable]);

  const stopEnrollment = useCallback(async () => {
    const rec = enrollRecordingRef.current;
    if (!rec) { setIsEnrolling(false); return; }
    try {
      await rec.stopAndUnloadAsync();
      enrollRecordingRef.current = null;
      const uri = rec.getURI();
      if (!uri) { setIsEnrolling(false); return; }
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const resp = await apiRequest("POST", "/api/ai/transcribe", { audio: base64, mime: "audio/m4a" });
      const data = await (resp as any).json();
      const prompt = data.text?.trim() ?? "";
      setEnrolledPrompt(prompt);
      setVoiceEnrolled(true);
      await AsyncStorage.setItem("voiceEnrollPrompt", prompt || "吐峪沟 吐鲁番 小乡");
      Alert.alert("录入成功", "小乡已记住你的声音特征，伴游模式下将优先识别你的声音");
    } catch {
      Alert.alert("录入失败", "请重试");
    } finally {
      setIsEnrolling(false);
      setEnrollCountdown(0);
    }
  }, []);

  // Whisper hallucination phrases to ignore
  const NOISE_PHRASES = [
    "谢谢观看", "请订阅", "感谢收看", "感谢观看", "谢谢收看",
    "bye", "thank you", "thanks", "okay", "ok", "um", "uh",
    "字幕", "翻译", "请关注", "请点赞",
  ];

  const isNoise = (text: string): boolean => {
    if (!text || text.length < 3) return true;
    // Only punctuation / numbers
    if (/^[\s\d\p{P}.,!?。，！？、…]+$/u.test(text)) return true;
    const lower = text.toLowerCase().trim();
    if (NOISE_PHRASES.some((p) => lower === p.toLowerCase() || lower.includes(p.toLowerCase()))) return true;
    // Less than 2 Chinese chars in a Chinese context = likely noise
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    if (chineseChars < 2 && text.length < 8) return true;
    return false;
  };

  const playDoubaoAudio = useCallback(async (base64Mp3: string): Promise<void> => {
    const tempUri = `${FileSystem.cacheDirectory}xiaoxiang_tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(tempUri, base64Mp3, { encoding: FileSystem.EncodingType.Base64 });
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync({ uri: tempUri }, { shouldPlay: true });
    await new Promise<void>((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) { resolve(); return; }
        if (status.didJustFinish) { sound.unloadAsync().catch(() => {}); resolve(); }
      });
      setTimeout(resolve, 30000); // safety timeout 30s
    });
    FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
  }, []);

  const runCompanionLoop = useCallback(async (
    currentEmotion: Emotion,
    currentActivityHint: string,
    currentPrompt: string,
    useDoubao: boolean,
  ) => {
    // Ensure any lingering recording is cleaned up before the loop
    if (companionRecordingRef.current) {
      try { await companionRecordingRef.current.stopAndUnloadAsync(); } catch {}
      companionRecordingRef.current = null;
    }

    while (companionActiveRef.current) {
      let recording: Audio.Recording | null = null;
      try {
        // Stop any playback before recording to prevent feedback
        if (await Speech.isSpeakingAsync()) {
          Speech.stop();
          await new Promise<void>((r) => setTimeout(r, 400));
        }

        setCompanionStatus("listening");
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const result = await Audio.Recording.createAsync({
          android: { extension: ".m4a", outputFormat: 2, audioEncoder: 3, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
          ios: { extension: ".m4a", audioQuality: 127, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
          web: {},
        });
        recording = result.recording;
        companionRecordingRef.current = recording;
        await new Promise<void>((resolve) => setTimeout(resolve, 5000));
        companionRecordingRef.current = null;
        if (!companionActiveRef.current) { try { await recording.stopAndUnloadAsync(); } catch {} recording = null; break; }
        const uri = recording.getURI();
        await recording.stopAndUnloadAsync();
        recording = null;
        if (!uri) continue;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

        setCompanionStatus("processing");

        // ── Doubao O2.0 S2S: end-to-end ASR + LLM + TTS ──
        if (useDoubao) {
          try {
            const locName = locationStatus.state === "located" ? locationStatus.locationName : "新疆";
            console.log("[S2S] 发送请求…");
            const s2sResp = await apiRequest("POST", "/api/doubao/s2s", {
              audioBase64: base64,
              mimeType: "audio/m4a",
              emotion: currentEmotion,
              location: locName,
            });
            const s2sData = await (s2sResp as any).json();
            if (s2sData.error) {
              console.warn("[S2S] 服务端错误:", s2sData.error);
              setCompanionResponse("小乡暂时连不上，稍等一下～");
              await new Promise<void>((r) => setTimeout(r, 1500));
              setCompanionResponse("");
            } else if (!s2sData.audioBase64) {
              console.log("[S2S] 静音，重新监听");
            } else if (companionActiveRef.current) {
              if (s2sData.transcript) console.log("[S2S] 用户说:", s2sData.transcript);
              if (s2sData.aiText) {
                setCompanionResponse(s2sData.aiText);
                console.log("[S2S] 小乡说:", s2sData.aiText);
              }
              await playDoubaoAudio(s2sData.audioBase64);
              setCompanionResponse("");
            }
          } catch (s2sErr: any) {
            console.warn("[S2S] 请求失败:", s2sErr?.message);
            setCompanionResponse("网络波动，小乡重新连接中～");
            await new Promise<void>((r) => setTimeout(r, 1500));
            setCompanionResponse("");
          }
          setCompanionStatus("listening");
          continue;
        }

        // ── Fallback chain (仅 doubaoReady=false 时): Whisper → DeepSeek → expo-speech ──
        let text = "";
        const tResp = await apiRequest("POST", "/api/ai/transcribe", {
          audio: base64, mime: "audio/m4a",
          prompt: currentPrompt || "吐峪沟 吐鲁番 游览 景点 旅行",
        });
        const tData = await (tResp as any).json();
        text = tData.text?.trim() ?? "";
        console.log("[Companion/WhisperASR]", text);

        if (isNoise(text) || !companionActiveRef.current) {
          setCompanionStatus("listening");
          continue;
        }

        const loc = locationStatus.state === "located" ? { name: locationStatus.locationName, lat: 0, lng: 0 } : null;
        const aiResp = await apiRequest("POST", "/api/ai/chat", {
          messages: [{ role: "user", content: text }],
          emotion: currentEmotion,
          activityData: { hint: currentActivityHint, stepRate: 0 },
          userLocation: loc,
        });
        const aiData = await (aiResp as any).json();
        const reply: string = aiData.reply || "";
        if (!reply || !companionActiveRef.current) continue;

        setCompanionResponse(reply);
        if (aiData.emotion) setEmotion(aiData.emotion as Emotion);

        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        await new Promise<void>((resolve) => {
          Speech.speak(reply, { language: "zh-CN", rate: 0.95, pitch: 1.05, onDone: resolve, onError: resolve, onStopped: resolve });
        });
        setCompanionResponse("");
      } catch (e) {
        console.error("[Companion] loop error:", e);
        // Always clean up recording on error to prevent "Only one Recording" crash
        if (recording) {
          try { await recording.stopAndUnloadAsync(); } catch {}
          recording = null;
        }
        companionRecordingRef.current = null;
        await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      }
    }
    Speech.stop();
    setCompanionStatus("idle");
  }, [locationStatus, playDoubaoAudio]);

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

  const toggleCompanionMode = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isCompanionActive) {
      companionActiveRef.current = false;
      setIsCompanionActive(false);
      setCompanionStatus("idle");
      setCompanionResponse("");
      Speech.stop();
    } else {
      if (!doubaoReady && voiceAvailable === false) {
        Alert.alert("语音功能未配置", "伴游模式需要配置豆包语音或 GROQ_API_KEY。");
        return;
      }
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert("需要麦克风权限", "请在设置中开启麦克风权限"); return; }
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
        setIsListening(false);
      }
      if (isEnrolling) { setIsEnrolling(false); setEnrollCountdown(0); }
      if (enrollRecordingRef.current) {
        try { await enrollRecordingRef.current.stopAndUnloadAsync(); } catch {}
        enrollRecordingRef.current = null;
      }
      companionActiveRef.current = true;
      setIsCompanionActive(true);
      runCompanionLoop(emotion, activityHint, enrolledPrompt, doubaoReady);
    }
  }, [isCompanionActive, voiceAvailable, emotion, activityHint, enrolledPrompt, doubaoReady, runCompanionLoop]);

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

  if (screen === "companion") {
    const ew = EMOTION_WELCOME[emotion] ?? EMOTION_WELCOME["平静"];
    const COMPANION_CHIPS = [
      "时间有限，帮我规划新路线",
      "我有点累，推荐附近休息点",
      "讲个吐峪沟的历史故事",
      "吐峪沟有什么特色美食",
    ];

    const statusText =
      companionStatus === "listening" ? "小乡正在聆听..." :
      companionStatus === "processing" ? "小乡正在思考..." :
      isCompanionActive ? "小乡已开启，说话就行" : "";

    return (
      <LinearGradient
        colors={["#FFF4EE", "#FFE8DC", "#FFF0EA"]}
        style={[styles.companionRoot, { paddingTop: insets.top }]}
      >
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header */}
        <View style={styles.companionHeader}>
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              if (isCompanionActive) {
                companionActiveRef.current = false;
                setIsCompanionActive(false);
                setCompanionStatus("idle");
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#E05A3A" />
          </Pressable>
          <Text style={styles.companionHeaderTitle}>情感伴游</Text>
          <Pressable
            style={[styles.enrollBtn, voiceEnrolled && styles.enrollBtnDone]}
            onPress={isEnrolling ? stopEnrollment : startEnrollment}
          >
            <Ionicons
              name={voiceEnrolled ? "checkmark-circle" : isEnrolling ? "stop-circle-outline" : "mic-outline"}
              size={14}
              color={voiceEnrolled ? "#1AAD6B" : "#E05A3A"}
            />
            <Text style={[styles.enrollBtnText, voiceEnrolled && { color: "#1AAD6B" }]}>
              {isEnrolling ? `停止录入 ${enrollCountdown}s` : voiceEnrolled ? "已录入" : "录入我的声音"}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.companionScroll}
        >
          {/* Face + emotion */}
          <View style={styles.companionFaceWrap}>
            <Animated.View style={{
              transform: [{ scale: isCompanionActive ? pulseAnim : new Animated.Value(1) }]
            }}>
              <XiaoxiangFace size={120} emotion={emotion} animate={isCompanionActive} />
            </Animated.View>
            {isCompanionActive && (
              <View style={styles.listeningRing} />
            )}
          </View>

          <View style={[styles.emotionBadgeLarge, { backgroundColor: emotionInfo.bg, alignSelf: "center", marginBottom: 4 }]}>
            <Ionicons name="heart" size={12} color={emotionInfo.color} />
            <Text style={[styles.emotionBadgeLargeText, { color: emotionInfo.color }]}>{emotion}</Text>
          </View>

          <Text style={styles.companionPageTitle}>小乡伴游模式</Text>
          <View style={styles.doubaoModeBadge}>
            <Ionicons name={doubaoReady ? "checkmark-circle" : "mic-circle-outline"} size={12} color={doubaoReady ? "#1AAD6B" : "#A07050"} />
            <Text style={[styles.doubaoModeBadgeText, { color: doubaoReady ? "#1AAD6B" : "#A07050" }]}>
              {doubaoReady ? "豆包语音 · 大模型" : "标准语音"}
            </Text>
          </View>
          <Text style={styles.companionPageSub}>{ew.sub}</Text>
          <Text style={styles.companionActivityHint}>{activityHint}</Text>

          {/* Status badge */}
          {isCompanionActive && (
            <View style={styles.companionStatusBadge}>
              <Animated.View style={[styles.companionStatusDot, {
                opacity: companionStatus === "listening" ? pulseAnim : 1,
                backgroundColor: companionStatus === "processing" ? "#F97340" : "#1AAD6B",
              }]} />
              <Text style={styles.companionStatusText}>{statusText}</Text>
            </View>
          )}

          {/* AI response bubble */}
          {!!companionResponse && (
            <View style={styles.companionResponseBubble}>
              <XiaoxiangFace size={28} emotion={emotion} />
              <View style={styles.companionResponseText}>
                <Text style={styles.companionResponseContent}>{companionResponse}</Text>
              </View>
            </View>
          )}

          {/* Main toggle button */}
          <Pressable style={styles.companionToggleWrap} onPress={toggleCompanionMode}>
            <LinearGradient
              colors={isCompanionActive ? ["#888", "#666"] : ["#FF8C5A", "#F97340", "#E86030"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.companionToggleBtn}
            >
              <Ionicons
                name={isCompanionActive ? "pause-circle-outline" : "radio-outline"}
                size={22}
                color="white"
              />
              <Text style={styles.companionToggleText}>
                {isCompanionActive ? "暂停伴游" : "开启伴游模式"}
              </Text>
            </LinearGradient>
          </Pressable>

          {!isCompanionActive && (
            <Text style={styles.companionToggleHint}>
              开启后小乡将持续聆听，随时与你聊天
            </Text>
          )}

          {/* Quick chips */}
          <View style={styles.companionChipGrid}>
            {COMPANION_CHIPS.map((text, i) => (
              <Pressable
                key={i}
                style={styles.companionChip}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setScreen("chat");
                  setTimeout(() => sendMessage(text), 300);
                }}
              >
                <Text style={styles.companionChipText}>{text}</Text>
                <Ionicons name="chevron-forward" size={14} color="#C08060" />
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Enrollment overlay */}
        {isEnrolling && (
          <View style={styles.enrollOverlay}>
            <View style={styles.enrollCard}>
              <XiaoxiangFace size={64} emotion="平静" animate />
              <Text style={styles.enrollTitle}>请说一段话，录入声纹</Text>
              <Text style={styles.enrollSub}>小乡正在记录你的声音特征</Text>
              <View style={styles.enrollCountdownCircle}>
                <Text style={styles.enrollCountdownText}>{enrollCountdown}</Text>
              </View>
              <Pressable style={styles.enrollStopBtn} onPress={stopEnrollment}>
                <Text style={styles.enrollStopText}>提前停止</Text>
              </Pressable>
            </View>
          </View>
        )}
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
            setScreen("companion");
          }}
        >
          <LinearGradient
            colors={["#2ECC8A", "#1AAD6B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.companionGrad}
          >
            <Ionicons name="heart-outline" size={14} color="white" />
            <Text style={styles.companionText}>小乡陪伴</Text>
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF4EE",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#FFD8BE",
  },
  chipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  chipLabel: {
    fontSize: 13,
    color: "#C05818",
    fontWeight: "600",
  },
  companionRoot: { flex: 1 },
  companionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  companionHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#8A3010",
    textAlign: "center",
    marginLeft: -8,
  },
  enrollBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(224,90,58,0.1)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(224,90,58,0.2)",
  },
  enrollBtnDone: {
    backgroundColor: "rgba(26,173,107,0.1)",
    borderColor: "rgba(26,173,107,0.3)",
  },
  enrollBtnText: { fontSize: 11, color: "#E05A3A", fontWeight: "600" },
  companionScroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  companionFaceWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16,
    position: "relative",
  },
  listeningRing: {
    position: "absolute",
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 2,
    borderColor: "rgba(249,115,64,0.4)",
    borderStyle: "dashed",
  },
  companionStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 12,
    shadowColor: "#F97340",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  companionStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  companionStatusText: { fontSize: 13, color: "#5A3020", fontWeight: "500" },
  companionResponseBubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "white",
    borderRadius: 18,
    padding: 12,
    marginBottom: 16,
    width: "100%",
    shadowColor: "#F97340",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  companionResponseText: { flex: 1 },
  companionResponseContent: { fontSize: 14, color: "#3A1A10", lineHeight: 20 },
  companionToggleWrap: { width: "100%", borderRadius: 28, overflow: "hidden", marginBottom: 8 },
  companionToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 28,
  },
  companionToggleText: { fontSize: 17, fontWeight: "800", color: "white", letterSpacing: 0.5 },
  companionToggleHint: { fontSize: 12, color: "#B08060", marginBottom: 20, textAlign: "center" },
  enrollOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  enrollCard: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 12,
    width: "80%",
  },
  enrollTitle: { fontSize: 16, fontWeight: "700", color: "#3A1A10", textAlign: "center" },
  enrollSub: { fontSize: 13, color: "#A07050", textAlign: "center" },
  enrollCountdownCircle: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: "#FFF4EE",
    borderWidth: 3, borderColor: "#F97340",
    alignItems: "center", justifyContent: "center",
  },
  enrollCountdownText: { fontSize: 28, fontWeight: "800", color: "#F97340" },
  enrollStopBtn: {
    backgroundColor: "#F97340",
    borderRadius: 16, paddingHorizontal: 20, paddingVertical: 8,
  },
  enrollStopText: { color: "white", fontWeight: "600", fontSize: 14 },
  companionPageHeader: {
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  emotionBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
  },
  emotionBadgeLargeText: { fontSize: 13, fontWeight: "700" },
  doubaoModeBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  doubaoModeBadgeText: { fontSize: 11, fontWeight: "600" as const },
  companionPageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#C04020",
    textAlign: "center",
    marginBottom: 4,
  },
  companionPageSub: {
    fontSize: 14,
    color: "#A05030",
    textAlign: "center",
    paddingHorizontal: 28,
    lineHeight: 20,
    marginBottom: 6,
  },
  companionActivityHint: {
    fontSize: 12,
    color: "#C09070",
    textAlign: "center",
    marginBottom: 20,
  },
  companionChipGrid: {
    width: "100%",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  companionChip: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#FFDCC8",
    shadowColor: "#F97340",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  companionChipText: {
    fontSize: 14,
    color: "#6A3010",
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
