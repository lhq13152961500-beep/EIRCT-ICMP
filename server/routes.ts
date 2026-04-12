import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { createHash, randomUUID } from "crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import https from "node:https";
import OpenAI, { toFile } from "openai";
import { storage, type InsertRecording } from "./storage";
import { doublaoRealtimeTurn } from "./doubao-realtime";
const uuidv4 = () => randomUUID();

const PW_SALT = "xiangyin_banlu_2026";

function hashPassword(pw: string) {
  return createHash("sha256").update(pw + PW_SALT).digest("hex");
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body as { username?: string; password?: string };
      if (!username?.trim() || !password) {
        return res.status(400).json({ error: "用户名和密码不能为空" });
      }
      if (username.trim().length < 2) {
        return res.status(400).json({ error: "用户名至少需要2个字符" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "密码至少需要6位" });
      }
      const existing = await storage.getUserByUsername(username.trim());
      if (existing) {
        return res.status(400).json({ error: "该用户名已被注册" });
      }
      const user = await storage.createUser({
        username: username.trim(),
        password: hashPassword(password),
      });
      return res.json({ user: { id: user.id, username: user.username } });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "注册失败，请稍后重试" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body as { username?: string; password?: string };
      if (!username?.trim() || !password) {
        return res.status(400).json({ error: "请输入用户名和密码" });
      }
      const user = await storage.getUserByUsername(username.trim());
      if (!user || user.password !== hashPassword(password)) {
        return res.status(401).json({ error: "用户名或密码错误" });
      }
      return res.json({ user: { id: user.id, username: user.username } });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "登录失败，请稍后重试" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { username, password } = req.body as { username?: string; password?: string };
      if (!username?.trim() || !password) {
        return res.status(400).json({ error: "参数不完整" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "密码至少需要6位" });
      }
      const ok = await storage.updateUserPassword(username.trim(), hashPassword(password));
      if (!ok) {
        return res.status(404).json({ error: "该手机号未注册" });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "重置失败，请稍后重试" });
    }
  });

  app.get("/api/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "userId required" });
      const profile = await storage.getProfile(userId);
      return res.json({ profile });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "获取资料失败" });
    }
  });

  app.put("/api/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "userId required" });
      const { displayName, bio, gender, birthYear, birthMonth, region, phone, address, avatarUrl } = req.body as {
        displayName?: string;
        bio?: string;
        gender?: string;
        birthYear?: string;
        birthMonth?: string;
        region?: string;
        phone?: string;
        address?: string;
        avatarUrl?: string;
      };
      const profile = await storage.upsertProfile(userId, {
        displayName: displayName ?? undefined,
        bio: bio ?? undefined,
        gender: gender ?? undefined,
        birthYear: birthYear ?? undefined,
        birthMonth: birthMonth ?? undefined,
        region: region ?? undefined,
        phone: phone ?? undefined,
        address: address ?? undefined,
        avatarUrl: avatarUrl ?? undefined,
      });
      return res.json({ profile });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "保存资料失败" });
    }
  });

  const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

  app.post("/api/recordings", async (req, res) => {
    try {
      const { title, locationName, lat, lng, durationSeconds, author, quote, tags, audioData, userId, imageUri } = req.body;
      console.log(`[recordings] POST /api/recordings - userId: ${userId}, hasAudio: ${typeof audioData === "string" ? audioData.length : "none"}, lat: ${lat}, lng: ${lng}`);
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ error: "lat and lng are required numbers" });
      }
      let validAudio: string | undefined;
      if (typeof audioData === "string" && audioData.length > 0) {
        const estimatedBytes = Math.ceil(audioData.length * 0.75);
        if (estimatedBytes > MAX_AUDIO_BYTES) {
          return res.status(413).json({ error: "Audio file too large (max 5MB)" });
        }
        validAudio = audioData;
      }
      const rec = await storage.addRecording({
        userId: userId || null,
        title: title || "声音随记",
        locationName: locationName || "未知位置",
        lat,
        lng,
        durationSeconds: durationSeconds ?? 0,
        author: author || "附近的旅人",
        quote: quote ?? null,
        tags: Array.isArray(tags) ? tags : ["#声音随记"],
        audioData: validAudio,
        imageUri: imageUri || null,
      });
      return res.json(rec);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to save recording" });
    }
  });

  app.get("/api/recordings/:id/audio", async (req, res) => {
    try {
      const result = await storage.getRecordingAudio(req.params.id);
      if (!result) return res.status(404).json({ error: "Audio not found" });
      if (result.startsWith("http")) {
        return res.redirect(result);
      }
      const buf = Buffer.from(result, "base64");
      let mime = "audio/mp4";
      if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) {
        mime = "audio/webm";
      } else if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
        mime = "audio/ogg";
      }
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Length", buf.length);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(buf);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to serve audio" });
    }
  });

  app.get("/api/recordings/my/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "userId required" });
      const recordings = await storage.getRecordingsByUser(userId);
      return res.json(recordings);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch recordings" });
    }
  });

  app.post("/api/recordings/:id/like", async (req, res) => {
    try {
      const { userId } = req.body as { userId?: string };
      if (!userId) return res.status(400).json({ error: "userId required" });
      const result = await storage.toggleLike(req.params.id, userId);
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to toggle like" });
    }
  });

  app.post("/api/recordings/:id/comment", async (req, res) => {
    try {
      const { userId, username, text, voiceData } = req.body as { userId?: string; username?: string; text?: string; voiceData?: string };
      if (!userId || !text?.trim()) return res.status(400).json({ error: "userId and text required" });
      console.log(`[comment] POST /api/recordings/${req.params.id}/comment - hasVoice: ${!!voiceData}, voiceLen: ${voiceData?.length ?? 0}`);
      const comment = await storage.addComment(req.params.id, userId, username || "匿名", text.trim(), voiceData);
      console.log(`[comment] Saved comment ${comment.id}, voiceUrl: ${comment.voiceUrl ?? 'none'}`);
      return res.json(comment);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to add comment" });
    }
  });

  app.get("/api/recordings/:id/interactions", async (req, res) => {
    try {
      const viewerUserId = req.query.viewerUserId as string | undefined;
      const result = await storage.getInteractions(req.params.id, viewerUserId);
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch interactions" });
    }
  });

  app.get("/api/recordings/nearby", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 100;
      const viewerUserId = req.query.viewerUserId as string | undefined;
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "lat and lng are required" });
      }
      const recordings = await storage.getNearbyRecordings(lat, lng, radius, viewerUserId);
      return res.json(recordings);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch recordings" });
    }
  });

  app.get("/api/config/amap-key", (_req, res) => {
    const key = process.env.AMAP_API_KEY;
    if (!key) return res.status(500).json({ error: "AMAP_API_KEY not configured" });
    return res.json({ key });
  });

  app.get("/api/amap-locate", (_req, res) => {
    const key = process.env.AMAP_API_KEY;
    const securityKey = process.env.AMAP_SECURITY_KEY || "";
    if (!key) return res.status(500).send("AMAP_API_KEY not configured");
    try {
      const candidates = [
        join(process.cwd(), "server_dist", "amap-locate.html"),
        join(process.cwd(), "server", "amap-locate.html"),
      ];
      const htmlPath = candidates.find(p => existsSync(p));
      if (!htmlPath) return res.status(500).send("amap-locate.html not found");
      const html = readFileSync(htmlPath, "utf-8");
      const page = html
        .replace(/__AMAP_KEY__/g, key)
        .replace(/__AMAP_SECURITY_KEY__/g, securityKey);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      return res.send(page);
    } catch (e) {
      return res.status(500).send("Failed to load locate page");
    }
  });

  app.get("/api/speech-recognition", (_req, res) => {
    try {
      const candidates = [
        join(process.cwd(), "server_dist", "speech-recognition.html"),
        join(process.cwd(), "server", "speech-recognition.html"),
      ];
      const htmlPath = candidates.find(p => existsSync(p));
      if (!htmlPath) return res.status(500).send("speech-recognition.html not found");
      const html = readFileSync(htmlPath, "utf-8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.send(html);
    } catch (e) {
      return res.status(500).send("Failed to load speech recognition page");
    }
  });

  app.get("/api/tiles/:z/:x/:y", (req, res) => {
    const { z, x, y } = req.params;
    const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    const options = {
      headers: {
        "User-Agent": "XiangyinBanlu/1.0 (https://replit.com; cultural-travel-app)",
        "Referer": "https://www.openstreetmap.org/",
      },
    };
    https.get(tileUrl, options, (upstream) => {
      if (upstream.statusCode && upstream.statusCode >= 400) {
        res.status(upstream.statusCode).end();
        return;
      }
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Access-Control-Allow-Origin", "*");
      upstream.pipe(res);
    }).on("error", () => {
      res.status(502).end();
    });
  });

  app.get("/api/map-voice-guide", (_req, res) => {
    try {
      const candidates = [
        join(process.cwd(), "server_dist", "map-voice-guide.html"),
        join(process.cwd(), "server", "map-voice-guide.html"),
      ];
      const htmlPath = candidates.find(p => existsSync(p));
      if (!htmlPath) return res.status(500).send("map-voice-guide.html not found");
      const html = readFileSync(htmlPath, "utf-8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      return res.send(html);
    } catch (e) {
      return res.status(500).send("Failed to load map-voice-guide page");
    }
  });

  app.get("/api/map-tuyugou", (_req, res) => {
    const key = process.env.AMAP_API_KEY;
    const securityKey = process.env.AMAP_SECURITY_KEY || "";
    if (!key) return res.status(500).send("AMAP_API_KEY not configured");
    try {
      const candidates = [
        join(process.cwd(), "server_dist", "map-tuyugou.html"),
        join(process.cwd(), "server", "map-tuyugou.html"),
      ];
      const htmlPath = candidates.find(p => existsSync(p));
      if (!htmlPath) return res.status(500).send("map-tuyugou.html not found");
      const html = readFileSync(htmlPath, "utf-8");
      const page = html
        .replace(/__AMAP_KEY__/g, key)
        .replace(/__AMAP_SECURITY_KEY__/g, securityKey);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      /* Cache 5 min — Leaflet + POI data is static, no runtime secrets in this map */
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      return res.send(page);
    } catch (e) {
      return res.status(500).send("Failed to load map page");
    }
  });

  app.get("/api/geocode/reverse", async (req, res) => {
    try {
      const { lat, lng } = req.query as { lat?: string; lng?: string };
      if (!lat || !lng) {
        return res.status(400).json({ error: "lat and lng are required" });
      }
      const amapKey = process.env.AMAP_SERVER_KEY || process.env.AMAP_API_KEY;
      if (!amapKey) {
        return res.status(500).json({ error: "AMAP_SERVER_KEY not configured" });
      }
      const location = `${lng},${lat}`;
      const amapRes = await fetch(
        `https://restapi.amap.com/v3/geocode/regeo?key=${amapKey}&location=${location}&extensions=base&output=json`,
      );
      if (!amapRes.ok) {
        return res.status(502).json({ error: "Amap API request failed" });
      }
      const data = await amapRes.json() as any;
      if (data.status !== "1") {
        return res.status(502).json({ error: data.info || "Amap API error" });
      }
      const comp = data.regeocode?.addressComponent ?? {};
      const poi = data.regeocode?.pois?.[0]?.name;
      const township = typeof comp.township === "string" && comp.township ? comp.township : null;
      const neighborhood = typeof comp.neighborhood?.name === "string" && comp.neighborhood.name ? comp.neighborhood.name : null;
      const streetName = typeof comp.streetNumber?.street === "string" && comp.streetNumber.street ? comp.streetNumber.street : null;
      const district = typeof comp.district === "string" && comp.district ? comp.district : null;
      const city = typeof comp.city === "string" && comp.city ? comp.city : (typeof comp.province === "string" ? comp.province : null);
      const detailed = poi || neighborhood || streetName || township;
      const area = district || city;
      const parts = [detailed, area].filter(Boolean);
      const name = parts.length > 0 ? parts.join(" · ") : (data.regeocode?.formatted_address || "当前位置");
      return res.json({ name, raw: data.regeocode });
    } catch (err) {
      console.error("Reverse geocode error:", err);
      return res.status(500).json({ error: "Reverse geocode failed" });
    }
  });

  app.get("/api/geocode/ip", async (req, res) => {
    try {
      const amapKey = process.env.AMAP_SERVER_KEY || process.env.AMAP_API_KEY;
      if (!amapKey) {
        return res.status(500).json({ error: "AMAP_SERVER_KEY not configured" });
      }
      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip;
      const amapRes = await fetch(
        `https://restapi.amap.com/v3/ip?key=${amapKey}&ip=${clientIp}&output=json`,
      );
      if (!amapRes.ok) {
        return res.status(502).json({ error: "Amap IP API failed" });
      }
      const data = await amapRes.json() as any;
      if (data.status !== "1") {
        return res.status(502).json({ error: data.info || "Amap IP error" });
      }
      const city = data.city || data.province || "未知位置";
      const rectangle = data.rectangle;
      let lat: number | null = null;
      let lng: number | null = null;
      if (typeof rectangle === "string" && rectangle.includes(";")) {
        const [p1, p2] = rectangle.split(";");
        const [lng1, lat1] = p1.split(",").map(Number);
        const [lng2, lat2] = p2.split(",").map(Number);
        lat = (lat1 + lat2) / 2;
        lng = (lng1 + lng2) / 2;
      }
      return res.json({ city, lat, lng });
    } catch (err) {
      console.error("IP geocode error:", err);
      return res.status(500).json({ error: "IP geocode failed" });
    }
  });

  app.get("/api/comments/:id/voice", async (req, res) => {
    try {
      const result = await storage.getCommentVoice(req.params.id);
      if (!result) return res.status(404).json({ error: "Voice not found" });
      const buf = Buffer.from(result, "base64");
      let mime = "audio/mp4";
      if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) {
        mime = "audio/webm";
      } else if (buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
        mime = "audio/ogg";
      }
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Length", buf.length);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(buf);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to serve comment voice" });
    }
  });

  app.get("/api/ai/voice-status", (_req, res) => {
    const hasKey = !!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
    res.set("Cache-Control", "no-store");
    res.json({ available: hasKey });
  });

  // ── Doubao (豆包) Voice Routes ──────────────────────────────────────────
  app.get("/api/doubao/status", (_req, res) => {
    const configured = !!(process.env.VOLCENGINE_APP_ID && process.env.VOLCENGINE_ACCESS_TOKEN);
    res.set("Cache-Control", "no-store");
    res.json({ configured });
  });

  // Doubao TTS – text → base64 MP3
  app.post("/api/doubao/tts", async (req, res) => {
    const { text, voice } = req.body as { text?: string; voice?: string };
    const appId = process.env.VOLCENGINE_APP_ID;
    const token = process.env.VOLCENGINE_ACCESS_TOKEN;
    if (!appId || !token) return res.status(503).json({ error: "doubao_not_configured" });
    if (!text?.trim()) return res.status(400).json({ error: "text required" });

    // Try BigTTS (volcano_mega) first for better quality, fall back to standard (volcano_tts)
    const attempts = [
      { cluster: "volcano_mega", voice_type: voice || "BV700_V2_streaming" },
      { cluster: "volcano_tts",  voice_type: "BV700_streaming" },
    ];

    for (const { cluster, voice_type } of attempts) {
      const payload = {
        app: { appid: appId, token, cluster },
        user: { uid: "xiaoxiang_companion" },
        audio: { voice_type, encoding: "mp3", speed_ratio: 1.0, volume_ratio: 1.0, pitch_ratio: 1.0 },
        request: { reqid: uuidv4(), text: text.slice(0, 2000), text_type: "plain", operation: "query" },
      };
      try {
        const resp = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
          method: "POST",
          headers: { Authorization: `Bearer;${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await resp.json()) as { code?: number; message?: string; data?: string };
        console.log(`[DoubaoTTS] cluster=${cluster} voice=${voice_type} code=${data.code} msg=${data.message}`);
        if (data.code === 3000 && data.data) {
          return res.json({ audio: data.data, encoding: "mp3" });
        }
        // code 4000-4999: auth/access error → try next
        console.warn(`[DoubaoTTS] cluster=${cluster} failed, trying next…`);
      } catch (err: any) {
        console.error("[DoubaoTTS] fetch error:", err?.message);
      }
    }
    return res.status(500).json({ error: "tts_failed_all_clusters" });
  });

  // Doubao ASR – base64 audio → transcript text
  app.post("/api/doubao/asr", async (req, res) => {
    const { audio, mime } = req.body as { audio?: string; mime?: string };
    const appId = process.env.VOLCENGINE_APP_ID;
    const token = process.env.VOLCENGINE_ACCESS_TOKEN;
    if (!appId || !token) return res.status(503).json({ error: "doubao_not_configured", text: "" });
    if (!audio) return res.status(400).json({ error: "audio required", text: "" });

    const fmt = (mime || "audio/m4a").includes("m4a") ? "mp4" : "mp3";
    const payload: Record<string, unknown> = {
      app: { appid: appId, token, cluster: "volcengine_input_common" },
      user: { uid: "xiaoxiang_companion" },
      audio: { format: fmt, rate: 16000, language: "zh-CN", bits: 16, channel: 1 },
      request: { reqid: uuidv4(), nbest: 1, show_utterances: false, sequence: -1 },
      audio_data: audio,
    };

    try {
      const resp = await fetch("https://openspeech.bytedance.com/api/v1/asr", {
        method: "POST",
        headers: {
          Authorization: `Bearer;${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as { code?: number; message?: string; resp?: { result?: { text: string }[] } };
      console.log(`[DoubaoASR] code=${data.code} msg=${data.message}`);
      if (data.code === 1000) {
        const text = data.resp?.result?.[0]?.text ?? "";
        return res.json({ text });
      }
      return res.status(500).json({ error: data.message || "asr_failed", text: "" });
    } catch (err: any) {
      console.error("[DoubaoASR] error:", err?.message);
      return res.status(500).json({ error: "asr_request_failed", text: "" });
    }
  });

  // Doubao S2S RealtimeAPI – audio → AI response audio (end-to-end)
  app.post("/api/doubao/s2s", async (req, res) => {
    const { audioBase64, mimeType, systemRole, emotion, location } = req.body as {
      audioBase64?: string;
      mimeType?: string;
      systemRole?: string;
      emotion?: string;
      location?: string;
    };
    if (!audioBase64) return res.status(400).json({ error: "audioBase64 required" });
    if (!process.env.VOLCENGINE_APP_ID || !process.env.VOLCENGINE_ACCESS_TOKEN) {
      return res.status(503).json({ error: "doubao_not_configured" });
    }
    try {
      const result = await doublaoRealtimeTurn({ audioBase64, mimeType, systemRole, emotion, location });
      return res.json(result);
    } catch (err: any) {
      console.error("[DoubaoS2S] error:", err?.message);
      return res.status(500).json({ error: err?.message || "s2s_failed" });
    }
  });

  app.post("/api/ai/transcribe", async (req, res) => {
    const { audio, mime, prompt: clientPrompt } = req.body as { audio?: string; mime?: string; prompt?: string };
    if (!audio) return res.status(400).json({ error: "audio required" });

    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!groqKey && !openaiKey) {
      console.log("[Transcribe] No STT API key configured (GROQ_API_KEY or OPENAI_API_KEY)");
      return res.json({ text: "", error: "no_key" });
    }

    // Merge geo-context terms with user's enrolled voice prompt for better recognition
    const geoContext = "吐峪沟，吐鲁番，新疆，麻扎村，维吾尔族，坎儿井，葡萄沟，火焰山，柏孜克里克，交河古城，鄯善县，克拉玛依，乌鲁木齐，天山，伊犁，喀什，和田";
    const finalPrompt = clientPrompt ? `${clientPrompt}。${geoContext}` : geoContext;

    try {
      const client = groqKey
        ? new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1" })
        : new OpenAI({ apiKey: openaiKey });
      const model = groqKey ? "whisper-large-v3" : "whisper-1";
      const audioBuffer = Buffer.from(audio, "base64");
      const file = await toFile(audioBuffer, "audio.m4a", { type: mime || "audio/m4a" });
      const transcription = await client.audio.transcriptions.create({
        file,
        model,
        language: "zh",
        prompt: finalPrompt,
      });
      console.log(`[Transcribe] text="${transcription.text}" prompt_len=${finalPrompt.length}`);
      return res.json({ text: transcription.text });
    } catch (err: any) {
      console.error("[Transcribe] error:", err?.message);
      return res.status(500).json({ error: "transcription_failed", text: "" });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, emotion, userLocation, activityData } = req.body as {
        messages: { role: string; content: any }[];
        emotion?: string;
        userLocation?: { name: string; lat: number; lng: number } | null;
        activityData?: { hint: string; stepRate: number } | null;
      };
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages required" });
      }

      const apiKey = process.env.ARK_API_KEY;

      if (apiKey) {
        // Fetch real-time weather for Turpan from Amap
        let weatherInfo = "暂无实时天气数据";
        const amapKey = process.env.AMAP_SERVER_KEY;
        if (amapKey) {
          try {
            const weatherData = await new Promise<string>((resolve) => {
              https.get(`https://restapi.amap.com/v3/weather/weatherInfo?city=650400&extensions=base&key=${amapKey}`, (res) => {
                let d = "";
                res.on("data", (c) => d += c);
                res.on("end", () => {
                  try {
                    const w = JSON.parse(d);
                    const live = w.lives?.[0];
                    if (live) {
                      resolve(`${live.weather}，气温${live.temperature}°C，${live.winddirection}风${live.windpower}级，湿度${live.humidity}%（数据时间：${live.reporttime}）`);
                    } else {
                      resolve("暂无实时天气数据");
                    }
                  } catch { resolve("暂无实时天气数据"); }
                });
              }).on("error", () => resolve("暂无实时天气数据"));
            });
            weatherInfo = weatherData;
          } catch { /* ignore */ }
        }

        // Compute distance from user to Tuyugou (42.849°N, 89.565°E)
        let distanceInfo = "位置未知，无法计算距离";
        if (userLocation) {
          const R = 6371;
          const dLat = (42.849 - userLocation.lat) * Math.PI / 180;
          const dLng = (89.565 - userLocation.lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(42.849 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
          const km = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
          const hours = km < 80 ? "约1小时" : km < 150 ? "约1.5-2小时" : "约2.5-3小时";
          distanceInfo = `约${km}公里（${hours}车程）`;
        }

        const systemPrompt = `你是「小乡」，乡音伴旅APP的AI伴游助手，专门服务于新疆吐鲁番吐峪沟景区。

【你的性格】友善活泼、说话亲切自然，像熟悉当地的朋友，偶尔穿插维吾尔语词汇（如"亚克西"=很好，"热合买提"=谢谢）。

【景区核心景点（12处）】
1. 景区入口大门：古朴石砌拱门，清代建筑，是景区标志性入口
2. 麻扎村：千年维吾尔族古村落，完整生土建筑群，冬暖夏凉
3. 吐峪沟清真寺：历史悠久伊斯兰建筑，精美木雕装饰
4. 千年洞窟：公元4世纪佛教石窟群，壁画保存完好，丝路遗珍
5. 古麻扎遗址：新疆最古老的伊斯兰圣祠遗址
6. 非遗文化馆：维吾尔族非遗展示，含木卡姆音乐、都它尔乐器
7. 民俗体验馆：传统手工艺展示与互动体验
8. 葡萄晾房：传统土坯晾房，秋季葡萄干香气四溢
9. 特产集市：葡萄干、无花果、馕饼等特色农产品
10. 烤馕馆：现烤坑炉馕饼，外脆内软，当地特色主食
11. 瓜果长廊：哈密瓜、白杏等特色瓜果，可现场品尝
12. 游客服务中心：景区导览、租赁、急救综合服务

【吐鲁番实时天气】${weatherInfo}

【游客当前信息】
- 情绪状态：${emotion || "平静"}
- 游览状态：${activityData?.hint || "静候中"}（步频约${activityData?.stepRate ?? 0}步/分钟）
- 当前位置：${userLocation ? userLocation.name : "位置未知"}
- 距吐峪沟景区的距离：${distanceInfo}

【根据游览状态动态调整风格】
- 「正在休息/疲惫」：语气轻柔，主动关心是否需要休息，推荐附近的休息区和轻松景点
- 「缓步游览中」：娓娓道来，深入讲解历史文化，配合悠闲节奏
- 「探索中/好奇」：详细解说，多讲趣味典故，满足求知欲
- 「活力游览/开心」：语气活泼，分享有趣互动体验，推荐拍照打卡点
- 「精力充沛/愉快」：充满热情，推荐全程游览路线，激发探索欲

【回答原则】
- 直接回答用户的具体问题，不要答非所问
- 根据游览状态自然融入关怀（如疲惫时主动提醒休息）
- 涉及交通/距离时，必须根据用户当前位置给出准确信息
- 结合以上具体景点信息给出实用建议
- 回答简洁生动，控制在200字以内
- 如果问题与吐峪沟/吐鲁番无关，引导话题回到旅游相关内容`;

        const doubaoClient = new OpenAI({
          baseURL: "https://ark.cn-beijing.volces.com/api/v3",
          apiKey,
        });

        const formattedMessages = (messages as { role: string; content: any }[]).map((m) => {
          if (Array.isArray(m.content)) {
            return {
              role: m.role as "user" | "assistant",
              content: m.content.map((part: any) => {
                if (part.type === "image_url") {
                  return { type: "image_url", image_url: { url: part.image_url.url } };
                }
                return { type: "text", text: part.text };
              }),
            };
          }
          return { role: m.role as "user" | "assistant", content: m.content as string };
        });

        const model = "doubao-seed-2-0-lite-260215";

        const completion = await doubaoClient.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...formattedMessages,
          ],
          max_tokens: 300,
          temperature: 0.85,
        });

        console.log("[Doubao] model:", model, "usage:", completion.usage);
        const reply = completion.choices[0]?.message?.content || "抱歉，我暂时无法回答这个问题～";

        const lastContent = messages[messages.length - 1]?.content;
        const lastText = (Array.isArray(lastContent)
          ? lastContent.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ")
          : (lastContent as string) || "").toLowerCase();
        let newEmotion = emotion || "平静";
        if (lastText.includes("累") || lastText.includes("疲惫") || lastText.includes("走不动")) newEmotion = "疲惫";
        else if (lastText.includes("好玩") || lastText.includes("开心") || lastText.includes("棒")) newEmotion = "愉快";
        else if (lastText.includes("?") || lastText.includes("？") || lastText.includes("为什么") || lastText.includes("怎么")) newEmotion = "好奇";
        else if (lastText.includes("谢") || lastText.includes("太好了")) newEmotion = "开心";

        return res.json({ reply, emotion: newEmotion });
      }

      const lastMsg = messages[messages.length - 1]?.content || "";
      const mocks: Record<string, string> = {
        "历史": "吐峪沟是新疆最古老的千年维吾尔族村落之一，这里的黄土窑洞已有1700多年历史！麻扎村里的古经文洞更是丝绸之路上的文化瑰宝，要不要我带你去探秘？",
        "美食": "吐鲁番最不能错过的就是烤羊肉串和葡萄干啦！馕坑烤肉香气四溢，再来一串冰镇石榴汁，疲惫全消～本地大妈自制的杏干酸甜爽口，记得带一袋回去！",
        "景点": "吐峪沟大峡谷层层叠叠，光线角度不同颜色也不同，下午三点是拍照黄金时段哦！千佛洞里的壁画历经千年，每一幅都是故事。我帮你规划一条最美路线？",
        "拍照": "最佳拍摄地：①吐峪沟村口的百年核桃树下，②大峡谷红色岩壁前，③千佛洞光影交错处。推荐早晨8-10点，光线最柔和，人也少！需要姿势建议吗？",
        "累": "听起来你走了不少路呢～附近有个小茶馆，维吾尔族老奶奶会泡香浓的玫瑰花茶，坐下来歇歇脚，顺便尝尝刚出炉的馕，保证精力满满！",
      };

      let reply = "你好呀！我是小乡，你的专属旅行伴游～今天想探索吐峪沟的哪个角落？历史文化、特色美食、绝美景点，我都能给你最棒的攻略！";
      for (const [key, val] of Object.entries(mocks)) {
        if (lastMsg.includes(key)) { reply = val; break; }
      }

      let newEmotion = emotion || "平静";
      if (lastMsg.includes("累") || lastMsg.includes("疲惫")) newEmotion = "疲惫";
      else if (lastMsg.includes("好玩") || lastMsg.includes("棒")) newEmotion = "愉快";
      else if (lastMsg.includes("?") || lastMsg.includes("？") || lastMsg.includes("为什么")) newEmotion = "好奇";
      else if (lastMsg.includes("谢")) newEmotion = "开心";

      return res.json({ reply, emotion: newEmotion });
    } catch (err) {
      console.error("[ai/chat]", err);
      return res.status(500).json({ error: "AI服务暂时不可用，请稍后再试" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
