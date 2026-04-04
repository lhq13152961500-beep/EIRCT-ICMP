"use no memo";
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Image,
  ScrollView,
  Platform,
  Dimensions,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Line as SvgLine, Circle } from "react-native-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";

const { width: SW, height: SH } = Dimensions.get("window");
const PRIMARY = Colors.light.primary;

/**
 * Phases:
 *  idle     – intro screen
 *  scanning – live camera viewfinder
 *  result   – processing overlay + AR result (BOTH always mounted, opacity-controlled)
 */
type Phase = "idle" | "scanning" | "result";

/* ────────────────────────────────────────────
   SVG: Hexagonal AR icon
   ──────────────────────────────────────────── */
function ArHexIcon({ size = 64, color = PRIMARY }: { size?: number; color?: string }) {
  const r = 36, ri = 16, cx = 50, cy = 50, arrowLen = 10;
  const verts = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  const innerPts = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * (Math.PI / 180);
    return `${i === 0 ? "M" : "L"} ${(cx + ri * Math.cos(a)).toFixed(1)} ${(cy + ri * Math.sin(a)).toFixed(1)}`;
  }).join(" ") + " Z";
  const norm = (dx: number, dy: number) => { const d = Math.sqrt(dx*dx+dy*dy); return { dx: dx/d, dy: dy/d }; };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {verts.map((v, i) => {
        const prev = verts[(i+5)%6]; const next = verts[(i+1)%6];
        const dp = norm(prev.x-v.x, prev.y-v.y); const dn = norm(next.x-v.x, next.y-v.y);
        return (
          <React.Fragment key={i}>
            <SvgLine x1={v.x} y1={v.y} x2={v.x+arrowLen*dp.dx} y2={v.y+arrowLen*dp.dy} stroke={color} strokeWidth="3.8" strokeLinecap="round"/>
            <SvgLine x1={v.x} y1={v.y} x2={v.x+arrowLen*dn.dx} y2={v.y+arrowLen*dn.dy} stroke={color} strokeWidth="3.8" strokeLinecap="round"/>
          </React.Fragment>
        );
      })}
      <Path d={innerPts} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round"/>
    </Svg>
  );
}

/* ────────────────────────────────────────────
   Idle: pulsing ring
   ──────────────────────────────────────────── */
function PulseRing({ delay, size }: { delay: number; size: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{
      position: "absolute", width: size, height: size, borderRadius: size/2,
      borderWidth: 1.5, borderColor: PRIMARY,
      opacity: anim.interpolate({ inputRange:[0,0.3,1], outputRange:[0,0.55,0] }),
      transform: [{ scale: anim.interpolate({ inputRange:[0,1], outputRange:[0.65,1.5] }) }],
    }}/>
  );
}

/* ────────────────────────────────────────────
   Processing: spinning arc
   ──────────────────────────────────────────── */
function SpinArc({ size, speed = 1500 }: { size: number; speed?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: speed, easing: Easing.linear, useNativeDriver: true }));
    loop.start(); return () => loop.stop();
  }, []);
  const rotate = spin.interpolate({ inputRange:[0,1], outputRange:["0deg","360deg"] });
  return (
    <Animated.View style={{ width:size, height:size, transform:[{ rotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="44" fill="none" stroke={PRIMARY} strokeWidth="4"
          strokeDasharray="200 80" strokeLinecap="round"/>
      </Svg>
    </Animated.View>
  );
}

/* ────────────────────────────────────────────
   AR: bouncing dots loader
   ──────────────────────────────────────────── */
function LoadingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const loops = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 160),
      Animated.timing(d, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(d, { toValue: 0, duration: 320, useNativeDriver: true }),
      Animated.delay(640),
    ])));
    loops.forEach(l => l.start()); return () => loops.forEach(l => l.stop());
  }, []);
  return (
    <View style={{ flexDirection:"row", gap:6, alignItems:"center", height:14 }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{
          width:6, height:6, borderRadius:3, backgroundColor: PRIMARY,
          opacity: d, transform:[{ translateY: d.interpolate({ inputRange:[0,1], outputRange:[0,-5] }) }],
        }}/>
      ))}
    </View>
  );
}

/* ════════════════════════════════════════════
   Main screen
   ════════════════════════════════════════════ */
export default function ArTourScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase]     = useState<Phase>("idle");
  const [viewMode, setViewMode] = useState<"ar" | "3d">("ar");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const cameraRef = useRef<CameraView>(null);

  /* ── Animated values ── */
  const flashAnim     = useRef(new Animated.Value(0)).current; // white flash
  const shutterScale  = useRef(new Animated.Value(1)).current;
  const photoOpacity  = useRef(new Animated.Value(0)).current; // photo bg fade-in

  // Processing overlay: starts 1 → animates to 0 when AR is ready
  const procOpacity   = useRef(new Animated.Value(1)).current;
  const procProgress  = useRef(new Animated.Value(0)).current;

  // AR content: starts 0 → animates to 1 when processing fades out
  const arAlpha       = useRef(new Animated.Value(0)).current;
  const infoPanelY    = useRef(new Animated.Value(280)).current;
  const headerAlpha   = useRef(new Animated.Value(0)).current;

  // AR/3D cross-fade
  const arModeAlpha   = useRef(new Animated.Value(1)).current;
  const d3ModeAlpha   = useRef(new Animated.Value(0)).current;

  const scanLineAnim  = useRef(new Animated.Value(0)).current;
  const modelRotate   = useRef(new Animated.Value(0)).current;

  // Info panel expand (height-based, bottom anchored)
  const EXPAND_HEIGHT = 130;         // description text only (~3 lines)
  const EXPAND_DRAG_PX = 60;         // px of drag to go 0→1
  const panelExpandAnim = useRef(new Animated.Value(0)).current;  // 0=collapsed 1=expanded
  const panelExpandRef  = useRef(0);
  const [liked, setLiked] = useState(false);

  const panelPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 6,
      onPanResponderGrant: () => {
        panelExpandAnim.stopAnimation(v => {
          panelExpandRef.current = v;
          panelExpandAnim.setValue(v);
        });
      },
      onPanResponderMove: (_, gs) => {
        // dy < 0 = dragging up = expand
        const next = Math.max(0, Math.min(1, panelExpandRef.current + (-gs.dy / EXPAND_DRAG_PX)));
        panelExpandAnim.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        const finalV = Math.max(0, Math.min(1, panelExpandRef.current + (-gs.dy / EXPAND_DRAG_PX)));
        const target = finalV > 0.5 ? 1 : 0;
        panelExpandRef.current = target;
        Animated.spring(panelExpandAnim, { toValue: target, friction: 8, tension: 70, useNativeDriver: false }).start();
      },
    })
  ).current;

  /* Scan line loop (only runs when AR result is visible) */
  useEffect(() => {
    if (phase !== "result") return;
    const loop = Animated.loop(
      Animated.timing(scanLineAnim, { toValue:1, duration:2800, easing:Easing.linear, useNativeDriver:true })
    );
    // Start after AR content appears (~1.8s processing + 300ms fade delay)
    const t = setTimeout(() => loop.start(), 2200);
    return () => { clearTimeout(t); loop.stop(); };
  }, [phase]);

  /* 3D rotation */
  useEffect(() => {
    if (viewMode !== "3d") return;
    const loop = Animated.loop(
      Animated.timing(modelRotate, { toValue:1, duration:6000, easing:Easing.linear, useNativeDriver:true })
    );
    loop.start(); return () => loop.stop();
  }, [viewMode]);

  /* AR ↔ 3D cross-fade */
  const switchViewMode = (mode: "ar" | "3d") => {
    if (mode === viewMode) return;
    if (mode === "3d") {
      Animated.parallel([
        Animated.timing(arModeAlpha, { toValue:0, duration:200, useNativeDriver:true }),
        Animated.timing(d3ModeAlpha, { toValue:1, duration:320, easing:Easing.out(Easing.quad), useNativeDriver:true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(d3ModeAlpha, { toValue:0, duration:200, useNativeDriver:true }),
        Animated.timing(arModeAlpha, { toValue:1, duration:320, easing:Easing.out(Easing.quad), useNativeDriver:true }),
      ]).start();
    }
    setViewMode(mode);
  };

  /* ── Open camera ── */
  const handleStart = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setPhase("scanning");
  };

  /* ── Shared: reset anim values + run result phase sequence ── */
  const startResultTransition = (uri: string | null) => {
    setPhotoUri(uri);
    procOpacity.setValue(1);
    procProgress.setValue(0);
    photoOpacity.setValue(0);
    arAlpha.setValue(0);
    infoPanelY.setValue(280);
    headerAlpha.setValue(0);
    arModeAlpha.setValue(1);
    d3ModeAlpha.setValue(0);
    setViewMode("ar");
    panelExpandAnim.setValue(0);
    panelExpandRef.current = 0;
    setLiked(false);

    setTimeout(() => {
      setPhase("result");
      setCapturing(false);
      Animated.timing(photoOpacity, { toValue:1, duration:600, easing:Easing.out(Easing.quad), useNativeDriver:true }).start();
      Animated.timing(procProgress, { toValue:1, duration:1700, easing:Easing.inOut(Easing.quad), useNativeDriver:false }).start();
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(procOpacity, { toValue:0, duration:550, easing:Easing.out(Easing.quad), useNativeDriver:true }),
          Animated.timing(headerAlpha, { toValue:1, duration:400, delay:120, useNativeDriver:true }),
          Animated.timing(arAlpha,     { toValue:1, duration:500, delay:200, useNativeDriver:true }),
          Animated.spring(infoPanelY,  { toValue:0, friction:9, tension:65, useNativeDriver:true }),
        ]).start();
      }, 1900);
    }, 100);
  };

  /* ── Shutter capture ── */
  const handleCapture = async () => {
    if (capturing) return;
    setCapturing(true);

    Animated.sequence([
      Animated.timing(shutterScale, { toValue:0.75, duration:85, useNativeDriver:true }),
      Animated.timing(shutterScale, { toValue:1, duration:130, easing:Easing.out(Easing.back(3)), useNativeDriver:true }),
    ]).start();

    let uri: string | null = null;
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality:0.85, skipProcessing:true });
      if (photo?.uri) uri = photo.uri;
    } catch (_) {}

    Animated.sequence([
      Animated.timing(flashAnim, { toValue:1, duration:60, useNativeDriver:true }),
      Animated.timing(flashAnim, { toValue:0, duration:480, easing:Easing.out(Easing.quad), useNativeDriver:true }),
    ]).start();

    startResultTransition(uri);
  };

  /* ── Gallery pick ── */
  const handleGalleryPick = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { setCapturing(false); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.85,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) { setCapturing(false); return; }
      startResultTransition(result.assets[0].uri);
    } catch (_) {
      setCapturing(false);
    }
  };

  const scanLineY = scanLineAnim.interpolate({ inputRange:[0,1], outputRange:[0, SH * 0.5] });
  const rotateDeg = modelRotate.interpolate({ inputRange:[0,1], outputRange:["0deg","360deg"] });
  const progressW = procProgress.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] });

  /* ════ IDLE ════ */
  if (phase === "idle") {
    return (
      <View style={styles.root}>
        <LinearGradient colors={["#071018","#0B2215","#071018"]} style={StyleSheet.absoluteFill}/>
        {Array.from({length:28}).map((_,i) => (
          <View key={i} style={[styles.star,{
            left:(i*137.5)%SW, top:(i*89.3)%(SH*0.78),
            width:i%3===0?2:1.5, height:i%3===0?2:1.5, opacity:0.25+(i%5)*0.08,
          }]}/>
        ))}
        <View style={[styles.header,{paddingTop:topPad+8}]}>
          <Pressable style={styles.backBtn} onPress={()=>router.back()}>
            <Ionicons name="chevron-back" size={22} color="#fff"/>
          </Pressable>
          <Text style={styles.headerTitle}>AR 实景畅游</Text>
          <View style={{width:36}}/>
        </View>
        <View style={styles.idleCenter}>
          <PulseRing size={270} delay={0}/>
          <PulseRing size={200} delay={700}/>
          <PulseRing size={134} delay={1400}/>
          <View style={styles.idleCircle}>
            <LinearGradient colors={[PRIMARY+"CC","#1A6A3A"]} style={styles.idleCircleInner}>
              <ArHexIcon size={64} color="#fff"/>
            </LinearGradient>
          </View>
          <Text style={styles.idleTitle}>AR 实景畅游</Text>
          <Text style={styles.idleSub}>{"将镜头对准周边建筑与景点\n即可触发沉浸式 AR 体验"}</Text>
          <View style={styles.idleTags}>
            {["3D 建模识别","文化讲解","历史层叠"].map(t=>(
              <View key={t} style={styles.idleTag}><Text style={styles.idleTagText}>{t}</Text></View>
            ))}
          </View>
        </View>
        <View style={[styles.idleBottom,{paddingBottom:insets.bottom+40}]}>
          <Pressable style={styles.startBtn} onPress={handleStart}>
            <LinearGradient colors={[PRIMARY,"#2D8A55"]} style={styles.startBtnGrad}>
              <Ionicons name="scan-outline" size={22} color="#fff"/>
              <Text style={styles.startBtnText}>点击开启 AR 之旅</Text>
              <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)"/>
            </LinearGradient>
          </Pressable>
          <Text style={styles.idleHint}>点击按钮，将镜头对准建筑物</Text>
        </View>
      </View>
    );
  }

  /* ════ SCANNING ════ */
  if (phase === "scanning") {
    return (
      <View style={styles.root}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back"/>
        <LinearGradient
          colors={["rgba(0,0,0,0.4)","transparent","transparent","rgba(0,0,0,0.55)"]}
          locations={[0,0.2,0.65,1]} style={StyleSheet.absoluteFill} pointerEvents="none"
        />
        <View style={[styles.header,{paddingTop:topPad+8}]}>
          <Pressable style={styles.backBtn} onPress={()=>setPhase("idle")}>
            <Ionicons name="chevron-back" size={22} color="#fff"/>
          </Pressable>
          <Text style={styles.headerTitle}>AR 扫描中</Text>
          <View style={{width:36}}/>
        </View>
        <View style={styles.viewfinderWrap} pointerEvents="none">
          <View style={styles.viewfinder}>
            <View style={[styles.corner,styles.cornerTL]}/>
            <View style={[styles.corner,styles.cornerTR]}/>
            <View style={[styles.corner,styles.cornerBL]}/>
            <View style={[styles.corner,styles.cornerBR]}/>
            <View style={styles.crosshairH}/><View style={styles.crosshairV}/>
            <Animated.View style={[styles.scanLineInner,{
              transform:[{translateY:scanLineAnim.interpolate({inputRange:[0,1],outputRange:[-110,110]})}],
            }]}/>
            <Text style={styles.viewfinderText}>对准建筑物</Text>
          </View>
        </View>
        <View style={[styles.shutterArea,{paddingBottom:insets.bottom+36}]}>
          <Text style={styles.shutterHint}>拍摄或上传照片开启 AR 识别</Text>
          <View style={styles.shutterRow}>
            {/* Gallery button */}
            <Pressable onPress={handleGalleryPick} disabled={capturing} style={styles.galleryBtn}>
              <Ionicons name="images-outline" size={22} color="#fff"/>
              <Text style={styles.galleryBtnText}>相册</Text>
            </Pressable>

            {/* Shutter button (center, larger) */}
            <Animated.View style={{transform:[{scale:shutterScale}]}}>
              <Pressable onPress={handleCapture} disabled={capturing} style={styles.shutterOuter}>
                <LinearGradient colors={[PRIMARY,"#2D8A55"]} style={styles.shutterInner}>
                  <Ionicons name="camera" size={30} color="#fff"/>
                </LinearGradient>
              </Pressable>
            </Animated.View>

          </View>
          <Text style={styles.shutterSub}>拍摄后自动进入 AR 模式</Text>
        </View>
        <Animated.View pointerEvents="none"
          style={[StyleSheet.absoluteFill,{backgroundColor:"#fff",opacity:flashAnim}]}/>
      </View>
    );
  }

  /* ════ RESULT (processing overlay + AR content — both always mounted) ════ */
  return (
    <View style={styles.root}>
      {/* ── Photo background ── */}
      {photoUri
        ? <Animated.Image source={{uri:photoUri}} style={[StyleSheet.absoluteFill,{opacity:photoOpacity}]} resizeMode="cover"/>
        : <LinearGradient colors={["#071820","#0B1F10","#071820"]} style={StyleSheet.absoluteFill}/>
      }
      <View style={[StyleSheet.absoluteFill,{backgroundColor:"rgba(0,0,0,0.28)"}]} pointerEvents="none"/>

      {/* 3D model */}
      <Animated.View pointerEvents={viewMode==="3d"?"auto":"none"}
        style={[StyleSheet.absoluteFill,styles.model3dWrap,{opacity:d3ModeAlpha}]}>
        <Animated.View style={[styles.model3dBox,{transform:[{rotateY:rotateDeg}]}]}>
          <LinearGradient colors={[PRIMARY+"99","#2D8A5599"]} style={styles.model3dFace}>
            <ArHexIcon size={52} color="#fff"/>
            <Text style={styles.model3dLabel}>3D 建筑模型</Text>
            <Text style={styles.model3dSub}>古风建筑群 · 清代</Text>
          </LinearGradient>
        </Animated.View>
        <Text style={styles.model3dHint}>拖动旋转 · 双指缩放</Text>
      </Animated.View>

      {/* Header */}
      <Animated.View style={{opacity:headerAlpha}}>
        <View style={[styles.header,{paddingTop:topPad+8}]}>
          <Pressable style={styles.backBtn} onPress={()=>router.back()}>
            <Ionicons name="chevron-back" size={22} color="#fff"/>
          </Pressable>
          <Text style={styles.headerTitleLeft}>AR 实景畅游</Text>
          <View style={{flex:1}}/>
          <View style={styles.modeToggle}>
            <Pressable style={[styles.modeBtn,viewMode==="ar"&&styles.modeBtnActive]} onPress={()=>switchViewMode("ar")}>
              <Text style={[styles.modeBtnText,viewMode==="ar"&&styles.modeBtnTextActive]}>AR</Text>
            </Pressable>
            <Pressable style={[styles.modeBtn,viewMode==="3d"&&styles.modeBtnActive]} onPress={()=>switchViewMode("3d")}>
              <Text style={[styles.modeBtnText,viewMode==="3d"&&styles.modeBtnTextActive]}>3D</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* Info panel — bottom anchored, expands upward on drag */}
      <Animated.View
        {...panelPanResponder.panHandlers}
        style={[styles.infoPanel,{paddingBottom:insets.bottom+16,transform:[{translateY:infoPanelY}]}]}>

        {/* ── Always visible: handle ── */}
        <View style={styles.infoPanelHandle}/>

        {/* ── Always visible: badge + title ── */}
        <View style={styles.infoPanelRow}>
          <View style={styles.infoBadge}>
            <Ionicons name="checkmark-circle" size={13} color={PRIMARY}/>
            <Text style={styles.infoBadgeText}>已识别</Text>
          </View>
          <Text style={styles.infoPanelTitle}>古风建筑群 · 清代遗址</Text>
        </View>

        {/* ── Expanding: description text (between title and tags) ── */}
        <Animated.View style={{
          height: panelExpandAnim.interpolate({inputRange:[0,1],outputRange:[0,EXPAND_HEIGHT]}),
          marginTop: panelExpandAnim.interpolate({inputRange:[0,1],outputRange:[0,4]}),
          overflow:"hidden",
        }}>
          <Animated.Text style={[styles.infoPanelDesc,{opacity:panelExpandAnim}]}>
            该建筑始建于清代乾隆年间，保留了典型的徽派建筑风格，是当地重要的文化遗产保护单位。
          </Animated.Text>
        </Animated.View>

        {/* ── Always visible: tags + actions ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.infoTagsScroll}>
          {["历史文化","清代建筑","徽派风格","文保单位","非遗体验"].map(tag=>(
            <View key={tag} style={styles.infoTag}><Text style={styles.infoTagText}>{tag}</Text></View>
          ))}
        </ScrollView>
        <View style={styles.infoActions}>
          <Pressable style={styles.infoAction}>
            <Ionicons name="volume-high-outline" size={18} color={PRIMARY}/>
            <Text style={styles.infoActionText}>语音讲解</Text>
          </Pressable>
          <Pressable style={styles.infoAction} onPress={()=>setLiked(v=>!v)}>
            <Ionicons name={liked?"heart":"heart-outline"} size={18} color={liked?"#FF5A6E":PRIMARY}/>
            <Text style={[styles.infoActionText,liked&&{color:"#FF5A6E"}]}>
              {liked?"已点赞":"点赞"}
            </Text>
          </Pressable>
          <Pressable style={styles.infoAction}>
            <Ionicons name="bookmark-outline" size={18} color={PRIMARY}/>
            <Text style={styles.infoActionText}>收藏</Text>
          </Pressable>
          <Pressable style={styles.infoAction} onPress={()=>setPhase("scanning")}>
            <Ionicons name="camera-outline" size={18} color={PRIMARY}/>
            <Text style={styles.infoActionText}>重新扫描</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* ── Processing overlay (opacity starts 1, fades to 0) — rendered ON TOP of AR content ── */}
      <Animated.View pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.procOverlay, {opacity:procOpacity}]}>
        <View style={styles.procContent}>
          {/* Spinning rings */}
          <View style={{alignItems:"center",justifyContent:"center"}}>
            <SpinArc size={96} speed={2800}/>
            <View style={{position:"absolute"}}>
              <SpinArc size={68} speed={1600}/>
            </View>
            <View style={{position:"absolute"}}>
              <ArHexIcon size={34} color="#fff"/>
            </View>
          </View>
          <Text style={styles.procTitle}>正在识别建筑结构</Text>
          <LoadingDots/>
          <View style={styles.procBarWrap}>
            <Animated.View style={[styles.procBar,{width:progressW as any}]}/>
          </View>
          <Text style={styles.procSub}>AI 模型分析中，请稍候...</Text>
        </View>
      </Animated.View>
    </View>
  );
}

/* ═══════════════════════════════
   Styles
   ═══════════════════════════════ */
const styles = StyleSheet.create({
  root:{ flex:1, backgroundColor:"#060E18" },
  star:{ position:"absolute", backgroundColor:"#fff", borderRadius:1 },

  header:{ flexDirection:"row", alignItems:"center", paddingHorizontal:14, paddingBottom:10, zIndex:20 },
  backBtn:{ width:36,height:36,borderRadius:18, backgroundColor:"rgba(255,255,255,0.18)", alignItems:"center",justifyContent:"center" },
  headerTitle:{ flex:1, textAlign:"center", fontSize:17, fontWeight:"700", color:"#fff" },
  headerTitleLeft:{ fontSize:17, fontWeight:"700", color:"#fff", marginLeft:10 },

  /* Idle */
  idleCenter:{ flex:1, alignItems:"center", justifyContent:"center", gap:16 },
  idleCircle:{ width:128,height:128,borderRadius:64,overflow:"hidden", shadowColor:PRIMARY,shadowOffset:{width:0,height:8},shadowOpacity:0.5,shadowRadius:20,elevation:12 },
  idleCircleInner:{ flex:1, alignItems:"center", justifyContent:"center" },
  idleTitle:{ fontSize:24, fontWeight:"800", color:"#fff", marginTop:8 },
  idleSub:{ fontSize:14, color:"rgba(255,255,255,0.6)", textAlign:"center", lineHeight:22 },
  idleTags:{ flexDirection:"row", flexWrap:"wrap", gap:8, justifyContent:"center", paddingHorizontal:32, marginTop:4 },
  idleTag:{ backgroundColor:"rgba(255,255,255,0.09)", borderRadius:20, paddingHorizontal:12, paddingVertical:5, borderWidth:1, borderColor:"rgba(255,255,255,0.14)" },
  idleTagText:{ fontSize:12, color:"rgba(255,255,255,0.78)", fontWeight:"600" },
  idleBottom:{ alignItems:"center", gap:12, paddingHorizontal:32 },
  startBtn:{ width:"100%", borderRadius:28, overflow:"hidden" },
  startBtnGrad:{ flexDirection:"row", alignItems:"center", justifyContent:"center", gap:10, paddingVertical:16, paddingHorizontal:24 },
  startBtnText:{ fontSize:17, fontWeight:"800", color:"#fff", flex:1, textAlign:"center" },
  idleHint:{ fontSize:12, color:"rgba(255,255,255,0.38)" },

  /* Scanning */
  viewfinderWrap:{ flex:1, alignItems:"center", justifyContent:"center" },
  viewfinder:{ width:SW*0.76, height:SW*0.76, alignItems:"center", justifyContent:"center", overflow:"hidden" },
  corner:{ position:"absolute", width:30, height:30, borderColor:PRIMARY, borderWidth:3 },
  cornerTL:{ top:0,left:0,borderRightWidth:0,borderBottomWidth:0,borderTopLeftRadius:4 },
  cornerTR:{ top:0,right:0,borderLeftWidth:0,borderBottomWidth:0,borderTopRightRadius:4 },
  cornerBL:{ bottom:0,left:0,borderRightWidth:0,borderTopWidth:0,borderBottomLeftRadius:4 },
  cornerBR:{ bottom:0,right:0,borderLeftWidth:0,borderTopWidth:0,borderBottomRightRadius:4 },
  crosshairH:{ position:"absolute",left:"12%",right:"12%",height:1,backgroundColor:"rgba(61,170,110,0.35)" },
  crosshairV:{ position:"absolute",top:"12%",bottom:"12%",width:1,backgroundColor:"rgba(61,170,110,0.35)" },
  scanLineInner:{ position:"absolute",left:0,right:0,height:2,backgroundColor:PRIMARY,opacity:0.75,shadowColor:PRIMARY,shadowRadius:6,shadowOpacity:0.9 },
  viewfinderText:{ fontSize:12, color:"rgba(255,255,255,0.5)", position:"absolute", bottom:10 },
  shutterArea:{ alignItems:"center", gap:14, paddingTop:8 },
  shutterHint:{ fontSize:13, color:"rgba(255,255,255,0.7)", fontWeight:"600" },
  shutterRow:{ flexDirection:"row", alignItems:"center", justifyContent:"center", gap:32 },
  shutterOuter:{ width:80,height:80,borderRadius:40,borderWidth:3,borderColor:"rgba(255,255,255,0.28)",overflow:"hidden",shadowColor:PRIMARY,shadowOffset:{width:0,height:4},shadowOpacity:0.55,shadowRadius:14,elevation:12 },
  shutterInner:{ flex:1, alignItems:"center", justifyContent:"center" },
  shutterSub:{ fontSize:11, color:"rgba(255,255,255,0.35)" },
  galleryBtn:{ width:56,height:56,borderRadius:28,borderWidth:2,borderColor:"rgba(255,255,255,0.25)",backgroundColor:"rgba(255,255,255,0.1)",alignItems:"center",justifyContent:"center",gap:3 },
  galleryBtnText:{ fontSize:10, color:"rgba(255,255,255,0.8)", fontWeight:"600" },

  /* Processing overlay */
  procOverlay:{ backgroundColor:"rgba(4,12,7,0.9)", alignItems:"center", justifyContent:"center", zIndex:40 },
  procContent:{ alignItems:"center", gap:20 },
  procTitle:{ fontSize:17, fontWeight:"700", color:"#fff", marginTop:4 },
  procBarWrap:{ width:200,height:3,backgroundColor:"rgba(255,255,255,0.12)",borderRadius:2,overflow:"hidden" },
  procBar:{ height:3, backgroundColor:PRIMARY, borderRadius:2 },
  procSub:{ fontSize:12, color:"rgba(255,255,255,0.45)" },

  /* AR result */
  scanLine:{ position:"absolute",left:0,right:0,height:2,backgroundColor:PRIMARY,shadowColor:PRIMARY,shadowRadius:8,shadowOpacity:0.85,zIndex:5 },
  modeToggle:{ flexDirection:"row", backgroundColor:"rgba(255,255,255,0.15)", borderRadius:12, padding:3, gap:2 },
  modeBtn:{ paddingHorizontal:12, paddingVertical:5, borderRadius:9 },
  modeBtnActive:{ backgroundColor:PRIMARY },
  modeBtnText:{ fontSize:12, fontWeight:"700", color:"rgba(255,255,255,0.6)" },
  modeBtnTextActive:{ color:"#fff" },

  model3dWrap:{ alignItems:"center", justifyContent:"center", gap:16 },
  model3dBox:{ width:200,height:180,borderRadius:20,overflow:"hidden",shadowColor:PRIMARY,shadowRadius:20,shadowOpacity:0.6,elevation:16 },
  model3dFace:{ flex:1,alignItems:"center",justifyContent:"center",gap:10,borderWidth:1.5,borderColor:PRIMARY+"80",borderRadius:20 },
  model3dLabel:{ fontSize:16, fontWeight:"800", color:"#fff" },
  model3dSub:{ fontSize:12, color:"rgba(255,255,255,0.7)" },
  model3dHint:{ fontSize:12, color:"rgba(255,255,255,0.4)" },

  infoPanel:{ position:"absolute",left:0,right:0,bottom:0,backgroundColor:"rgba(8,16,10,0.94)",borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,paddingTop:12,gap:12,zIndex:20 },
  infoPanelHandle:{ width:36,height:4,borderRadius:2,backgroundColor:"rgba(255,255,255,0.22)",alignSelf:"center",marginBottom:4 },
  infoPanelRow:{ flexDirection:"row", alignItems:"center", gap:10 },
  infoBadge:{ flexDirection:"row",alignItems:"center",gap:4,backgroundColor:PRIMARY+"22",borderRadius:8,paddingHorizontal:8,paddingVertical:3 },
  infoBadgeText:{ fontSize:11, fontWeight:"600", color:PRIMARY },
  infoPanelTitle:{ fontSize:16, fontWeight:"800", color:"#fff", flex:1 },
  infoPanelDesc:{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:20 },
  infoTagsScroll:{ marginHorizontal:-20 },
  infoTag:{ backgroundColor:"rgba(255,255,255,0.09)",borderRadius:16,paddingHorizontal:12,paddingVertical:5,marginLeft:8,borderWidth:1,borderColor:"rgba(255,255,255,0.13)" },
  infoTagText:{ fontSize:11, fontWeight:"600", color:"rgba(255,255,255,0.75)" },
  infoActions:{ flexDirection:"row", justifyContent:"space-around" },
  infoAction:{ alignItems:"center", gap:5 },
  infoActionText:{ fontSize:11, color:"rgba(255,255,255,0.65)", fontWeight:"600" },
});
