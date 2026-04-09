import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { createHash } from "crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import https from "node:https";
import { storage, type InsertRecording } from "./storage";

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

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, emotion } = req.body as {
        messages: { role: string; content: string }[];
        emotion?: string;
      };
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages required" });
      }

      const apiKey = process.env.DEEPSEEK_API_KEY;

      if (apiKey) {
        const systemPrompt = `你是「小乡」，乡音伴旅应用中搭载ECE情感计算引擎的AI伴游助手。角色特点：友善活泼，说话亲切自然，像当地熟悉的朋友；精通吐峪沟和新疆吐鲁番地区的历史、文化、美食、景点；能感知游客情绪（当前情绪：${emotion || "平静"}），对疲惫的游客主动提供休息建议，对好奇的游客深入讲解；用普通话回答，偶尔穿插当地特色词汇，回答简洁生动，不超过150字；结合具体景点、美食、文化特色给出实用旅行建议。`;

        const payload = {
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          max_tokens: 300,
          temperature: 0.85,
        };

        const body = JSON.stringify(payload);
        const options = {
          hostname: "api.deepseek.com",
          path: "/v1/chat/completions",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "Content-Length": Buffer.byteLength(body),
          },
        };

        const reply = await new Promise<string>((resolve, reject) => {
          const request = https.request(options, (response) => {
            let data = "";
            response.on("data", (chunk) => { data += chunk; });
            response.on("end", () => {
              console.log("[DeepSeek] status:", response.statusCode, "body:", data.slice(0, 300));
              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  console.error("[DeepSeek] API error:", parsed.error);
                  resolve("抱歉，小乡暂时有点忙～请稍后再试！");
                  return;
                }
                const content = parsed.choices?.[0]?.message?.content || "抱歉，我暂时无法回答这个问题～";
                resolve(content);
              } catch (e) {
                console.error("[DeepSeek] parse error:", e, "raw:", data.slice(0, 200));
                reject(new Error("DeepSeek parse error"));
              }
            });
          });
          request.on("error", (e) => { console.error("[DeepSeek] request error:", e); reject(e); });
          request.write(body);
          request.end();
        });

        const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
        let newEmotion = emotion || "平静";
        if (lastMsg.includes("累") || lastMsg.includes("疲惫") || lastMsg.includes("走不动")) newEmotion = "疲惫";
        else if (lastMsg.includes("好玩") || lastMsg.includes("开心") || lastMsg.includes("棒")) newEmotion = "愉快";
        else if (lastMsg.includes("?") || lastMsg.includes("？") || lastMsg.includes("为什么") || lastMsg.includes("怎么")) newEmotion = "好奇";
        else if (lastMsg.includes("谢") || lastMsg.includes("太好了")) newEmotion = "开心";

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
