import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { createHash } from "crypto";
import { storage, type InsertRecording } from "./storage";

const PW_SALT = "xiangyin_banlu_2026";

function hashPassword(pw: string) {
  return createHash("sha256").update(pw + PW_SALT).digest("hex");
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ── Auth ──────────────────────────────────────────────────────────────────

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

  // ── Recordings ────────────────────────────────────────────────────────────

  app.post("/api/recordings", async (req, res) => {
    try {
      const { title, locationName, lat, lng, durationSeconds, author, quote, tags } = req.body as InsertRecording;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ error: "lat and lng are required numbers" });
      }
      const rec = await storage.addRecording({
        title: title || "声音随记",
        locationName: locationName || "未知位置",
        lat,
        lng,
        durationSeconds: durationSeconds ?? 0,
        author: author || "附近的旅人",
        quote: quote ?? null,
        tags: Array.isArray(tags) ? tags : ["#声音随记"],
      });
      return res.json(rec);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to save recording" });
    }
  });

  app.get("/api/recordings/nearby", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 100;
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "lat and lng are required" });
      }
      const recordings = await storage.getNearbyRecordings(lat, lng, radius);
      return res.json(recordings);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch recordings" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
