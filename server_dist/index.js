// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import { createHash } from "crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import https from "node:https";
import OpenAI, { toFile } from "openai";

// server/storage.ts
import { randomUUID } from "crypto";
import { Pool } from "pg";
var pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const toRad = (v) => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
var HybridStorage = class {
  async getUser(id) {
    const res = await pgPool.query(
      "SELECT id, username, password FROM users WHERE id = $1",
      [id]
    );
    if (res.rows.length === 0) return void 0;
    const row = res.rows[0];
    return { id: row.id, username: row.username, password: row.password };
  }
  async getUserByUsername(username) {
    const res = await pgPool.query(
      "SELECT id, username, password FROM users WHERE username = $1",
      [username]
    );
    if (res.rows.length === 0) return void 0;
    const row = res.rows[0];
    return { id: row.id, username: row.username, password: row.password };
  }
  async createUser(insertUser) {
    const id = randomUUID();
    const res = await pgPool.query(
      "INSERT INTO users (id, username, password) VALUES ($1, $2, $3) RETURNING id, username, password",
      [id, insertUser.username, insertUser.password]
    );
    const row = res.rows[0];
    return { id: row.id, username: row.username, password: row.password };
  }
  async updateUserPassword(username, hashedPassword) {
    const res = await pgPool.query(
      "UPDATE users SET password = $1 WHERE username = $2 RETURNING id",
      [hashedPassword, username]
    );
    return (res.rowCount ?? 0) > 0;
  }
  rowToProfile(row) {
    return {
      userId: row.user_id,
      displayName: row.display_name,
      bio: row.bio,
      gender: row.gender,
      birthYear: row.birth_year,
      birthMonth: row.birth_month,
      region: row.region,
      phone: row.phone,
      address: row.address,
      avatarUrl: row.avatar_url,
      updatedAt: row.updated_at
    };
  }
  async getProfile(userId) {
    const res = await pgPool.query(
      "SELECT * FROM profiles WHERE user_id = $1",
      [userId]
    );
    if (res.rows.length === 0) return null;
    return this.rowToProfile(res.rows[0]);
  }
  async upsertProfile(userId, data) {
    const res = await pgPool.query(
      `INSERT INTO profiles (user_id, display_name, bio, gender, birth_year, birth_month, region, phone, address, avatar_url, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = COALESCE($2, profiles.display_name),
         bio          = COALESCE($3, profiles.bio),
         gender       = COALESCE($4, profiles.gender),
         birth_year   = COALESCE($5, profiles.birth_year),
         birth_month  = COALESCE($6, profiles.birth_month),
         region       = COALESCE($7, profiles.region),
         phone        = COALESCE($8, profiles.phone),
         address      = COALESCE($9, profiles.address),
         avatar_url   = COALESCE($10, profiles.avatar_url),
         updated_at   = NOW()
       RETURNING *`,
      [
        userId,
        data.displayName ?? null,
        data.bio ?? null,
        data.gender ?? null,
        data.birthYear ?? null,
        data.birthMonth ?? null,
        data.region ?? null,
        data.phone ?? null,
        data.address ?? null,
        data.avatarUrl ?? null
      ]
    );
    return this.rowToProfile(res.rows[0]);
  }
  rowToRecording(row) {
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      locationName: row.location_name,
      lat: row.lat,
      lng: row.lng,
      durationSeconds: row.duration_seconds,
      publishedAt: row.published_at.toISOString(),
      author: row.author,
      quote: row.quote,
      tags: row.tags || [],
      imageUri: row.image_uri,
      audioUrl: row.audio_url
    };
  }
  async addRecording(r) {
    let audioData = null;
    if (r.audioData && r.audioData.length > 0) {
      audioData = r.audioData;
    }
    const res = await pgPool.query(
      `INSERT INTO recordings (user_id, title, location_name, lat, lng, duration_seconds, author, quote, tags, audio_data, image_uri)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, user_id, title, location_name, lat, lng, duration_seconds, published_at, author, quote, tags, image_uri, audio_url`,
      [
        r.userId ?? null,
        r.title,
        r.locationName,
        r.lat,
        r.lng,
        r.durationSeconds,
        r.author,
        r.quote,
        r.tags,
        audioData,
        r.imageUri ?? null
      ]
    );
    const rec = this.rowToRecording(res.rows[0]);
    if (audioData) {
      rec.audioUri = `/api/recordings/${rec.id}/audio`;
    }
    return rec;
  }
  async getRecordingAudio(id) {
    const res = await pgPool.query(
      "SELECT audio_url, audio_data FROM recordings WHERE id = $1",
      [id]
    );
    if (res.rows.length === 0) return null;
    if (res.rows[0].audio_url) return res.rows[0].audio_url;
    return res.rows[0].audio_data ?? null;
  }
  async getNearbyRecordings(lat, lng, radiusMeters, viewerUserId) {
    const res = await pgPool.query(
      `SELECT id, user_id, title, location_name, lat, lng, duration_seconds, published_at, author, quote, tags, image_uri, audio_url,
              (audio_data IS NOT NULL OR audio_url IS NOT NULL) AS has_audio
       FROM recordings
       ORDER BY published_at DESC
       LIMIT 200`
    );
    const nearby = res.rows.filter((r) => haversineMeters(lat, lng, r.lat, r.lng) <= radiusMeters).map((r) => {
      const rec = this.rowToRecording(r);
      if (rec.audioUrl) {
        rec.audioUri = rec.audioUrl;
      } else if (r.has_audio) {
        rec.audioUri = `/api/recordings/${rec.id}/audio`;
      }
      return rec;
    });
    if (nearby.length === 0) return nearby;
    const ids = nearby.map((r) => r.id);
    const likesRes = await pgPool.query(
      `SELECT recording_id, COUNT(*)::int AS cnt FROM recording_likes WHERE recording_id = ANY($1) GROUP BY recording_id`,
      [ids]
    );
    const likeMap = {};
    for (const row of likesRes.rows) likeMap[row.recording_id] = row.cnt;
    const commentsRes = await pgPool.query(
      `SELECT id, recording_id, user_id, username, text, created_at, voice_url FROM recording_comments WHERE recording_id = ANY($1) ORDER BY created_at ASC`,
      [ids]
    );
    const commentMap = {};
    for (const row of commentsRes.rows) {
      const rid = row.recording_id;
      if (!commentMap[rid]) commentMap[rid] = [];
      commentMap[rid].push({
        id: row.id,
        recordingId: rid,
        userId: row.user_id,
        username: row.username,
        text: row.text,
        createdAt: row.created_at.toISOString(),
        voiceUrl: row.voice_url
      });
    }
    let userLikeSet = /* @__PURE__ */ new Set();
    if (viewerUserId) {
      const ulRes = await pgPool.query(
        `SELECT recording_id FROM recording_likes WHERE user_id = $1 AND recording_id = ANY($2)`,
        [viewerUserId, ids]
      );
      for (const row of ulRes.rows) userLikeSet.add(row.recording_id);
    }
    for (const rec of nearby) {
      rec.likeCount = likeMap[rec.id] ?? 0;
      rec.comments = commentMap[rec.id] ?? [];
      rec.isLiked = userLikeSet.has(rec.id);
    }
    return nearby;
  }
  async getRecordingsByUser(userId) {
    const res = await pgPool.query(
      `SELECT id, user_id, title, location_name, lat, lng, duration_seconds, published_at, author, quote, tags, image_uri, audio_url,
              (audio_data IS NOT NULL OR audio_url IS NOT NULL) AS has_audio
       FROM recordings
       WHERE user_id = $1
       ORDER BY published_at DESC`,
      [userId]
    );
    const recs = res.rows.map((r) => {
      const rec = this.rowToRecording(r);
      if (rec.audioUrl) {
        rec.audioUri = rec.audioUrl;
      } else if (r.has_audio) {
        rec.audioUri = `/api/recordings/${rec.id}/audio`;
      }
      return rec;
    });
    if (recs.length === 0) return recs;
    const ids = recs.map((r) => r.id);
    const likesRes = await pgPool.query(
      `SELECT recording_id, COUNT(*)::int AS cnt FROM recording_likes WHERE recording_id = ANY($1) GROUP BY recording_id`,
      [ids]
    );
    const likeMap = {};
    for (const row of likesRes.rows) likeMap[row.recording_id] = row.cnt;
    const commentsRes = await pgPool.query(
      `SELECT id, recording_id, user_id, username, text, created_at, voice_url FROM recording_comments WHERE recording_id = ANY($1) ORDER BY created_at ASC`,
      [ids]
    );
    const commentMap = {};
    for (const row of commentsRes.rows) {
      const rid = row.recording_id;
      if (!commentMap[rid]) commentMap[rid] = [];
      commentMap[rid].push({
        id: row.id,
        recordingId: rid,
        userId: row.user_id,
        username: row.username,
        text: row.text,
        createdAt: row.created_at.toISOString(),
        voiceUrl: row.voice_url
      });
    }
    for (const rec of recs) {
      rec.likeCount = likeMap[rec.id] ?? 0;
      rec.comments = commentMap[rec.id] ?? [];
    }
    return recs;
  }
  async toggleLike(recordingId, userId) {
    const delRes = await pgPool.query(
      `DELETE FROM recording_likes WHERE recording_id = $1 AND user_id = $2 RETURNING id`,
      [recordingId, userId]
    );
    let liked;
    if (delRes.rowCount && delRes.rowCount > 0) {
      liked = false;
    } else {
      await pgPool.query(
        `INSERT INTO recording_likes (recording_id, user_id) VALUES ($1, $2) ON CONFLICT (recording_id, user_id) DO NOTHING`,
        [recordingId, userId]
      );
      liked = true;
    }
    const countRes = await pgPool.query(
      `SELECT COUNT(*)::int AS cnt FROM recording_likes WHERE recording_id = $1`,
      [recordingId]
    );
    return { liked, likeCount: countRes.rows[0].cnt };
  }
  async addComment(recordingId, userId, username, text, voiceData) {
    let voiceUrl = null;
    const res = await pgPool.query(
      `INSERT INTO recording_comments (recording_id, user_id, username, text, voice_url, voice_data) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [recordingId, userId, username, text, voiceUrl, voiceData ?? null]
    );
    const row = res.rows[0];
    if (voiceData) {
      voiceUrl = `/api/comments/${row.id}/voice`;
      await pgPool.query(
        "UPDATE recording_comments SET voice_url = $1 WHERE id = $2",
        [voiceUrl, row.id]
      );
    }
    return {
      id: row.id,
      recordingId: row.recording_id,
      userId: row.user_id,
      username: row.username,
      text: row.text,
      createdAt: row.created_at.toISOString(),
      voiceUrl: voiceData ? voiceUrl : row.voice_url
    };
  }
  async getCommentVoice(commentId) {
    const res = await pgPool.query(
      "SELECT voice_data FROM recording_comments WHERE id = $1",
      [commentId]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0].voice_data ?? null;
  }
  async getInteractions(recordingId, viewerUserId) {
    const likeRes = await pgPool.query(
      `SELECT COUNT(*)::int AS cnt FROM recording_likes WHERE recording_id = $1`,
      [recordingId]
    );
    let isLiked = false;
    if (viewerUserId) {
      const ul = await pgPool.query(
        `SELECT id FROM recording_likes WHERE recording_id = $1 AND user_id = $2`,
        [recordingId, viewerUserId]
      );
      isLiked = ul.rows.length > 0;
    }
    const commentsRes = await pgPool.query(
      `SELECT id, recording_id, user_id, username, text, created_at, voice_url FROM recording_comments WHERE recording_id = $1 ORDER BY created_at ASC`,
      [recordingId]
    );
    const comments = commentsRes.rows.map((row) => ({
      id: row.id,
      recordingId: row.recording_id,
      userId: row.user_id,
      username: row.username,
      text: row.text,
      createdAt: row.created_at.toISOString(),
      voiceUrl: row.voice_url
    }));
    return { likeCount: likeRes.rows[0].cnt, isLiked, comments };
  }
};
var storage = new HybridStorage();

// server/routes.ts
var PW_SALT = "xiangyin_banlu_2026";
function hashPassword(pw) {
  return createHash("sha256").update(pw + PW_SALT).digest("hex");
}
async function registerRoutes(app2) {
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username?.trim() || !password) {
        return res.status(400).json({ error: "\u7528\u6237\u540D\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" });
      }
      if (username.trim().length < 2) {
        return res.status(400).json({ error: "\u7528\u6237\u540D\u81F3\u5C11\u9700\u89812\u4E2A\u5B57\u7B26" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "\u5BC6\u7801\u81F3\u5C11\u9700\u89816\u4F4D" });
      }
      const existing = await storage.getUserByUsername(username.trim());
      if (existing) {
        return res.status(400).json({ error: "\u8BE5\u7528\u6237\u540D\u5DF2\u88AB\u6CE8\u518C" });
      }
      const user = await storage.createUser({
        username: username.trim(),
        password: hashPassword(password)
      });
      return res.json({ user: { id: user.id, username: user.username } });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "\u6CE8\u518C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username?.trim() || !password) {
        return res.status(400).json({ error: "\u8BF7\u8F93\u5165\u7528\u6237\u540D\u548C\u5BC6\u7801" });
      }
      const user = await storage.getUserByUsername(username.trim());
      if (!user || user.password !== hashPassword(password)) {
        return res.status(401).json({ error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" });
      }
      return res.json({ user: { id: user.id, username: user.username } });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "\u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" });
    }
  });
  app2.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username?.trim() || !password) {
        return res.status(400).json({ error: "\u53C2\u6570\u4E0D\u5B8C\u6574" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "\u5BC6\u7801\u81F3\u5C11\u9700\u89816\u4F4D" });
      }
      const ok = await storage.updateUserPassword(username.trim(), hashPassword(password));
      if (!ok) {
        return res.status(404).json({ error: "\u8BE5\u624B\u673A\u53F7\u672A\u6CE8\u518C" });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "\u91CD\u7F6E\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" });
    }
  });
  app2.get("/api/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "userId required" });
      const profile = await storage.getProfile(userId);
      return res.json({ profile });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "\u83B7\u53D6\u8D44\u6599\u5931\u8D25" });
    }
  });
  app2.put("/api/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ error: "userId required" });
      const { displayName, bio, gender, birthYear, birthMonth, region, phone, address, avatarUrl } = req.body;
      const profile = await storage.upsertProfile(userId, {
        displayName: displayName ?? void 0,
        bio: bio ?? void 0,
        gender: gender ?? void 0,
        birthYear: birthYear ?? void 0,
        birthMonth: birthMonth ?? void 0,
        region: region ?? void 0,
        phone: phone ?? void 0,
        address: address ?? void 0,
        avatarUrl: avatarUrl ?? void 0
      });
      return res.json({ profile });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "\u4FDD\u5B58\u8D44\u6599\u5931\u8D25" });
    }
  });
  const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
  app2.post("/api/recordings", async (req, res) => {
    try {
      const { title, locationName, lat, lng, durationSeconds, author, quote, tags, audioData, userId, imageUri } = req.body;
      console.log(`[recordings] POST /api/recordings - userId: ${userId}, hasAudio: ${typeof audioData === "string" ? audioData.length : "none"}, lat: ${lat}, lng: ${lng}`);
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ error: "lat and lng are required numbers" });
      }
      let validAudio;
      if (typeof audioData === "string" && audioData.length > 0) {
        const estimatedBytes = Math.ceil(audioData.length * 0.75);
        if (estimatedBytes > MAX_AUDIO_BYTES) {
          return res.status(413).json({ error: "Audio file too large (max 5MB)" });
        }
        validAudio = audioData;
      }
      const rec = await storage.addRecording({
        userId: userId || null,
        title: title || "\u58F0\u97F3\u968F\u8BB0",
        locationName: locationName || "\u672A\u77E5\u4F4D\u7F6E",
        lat,
        lng,
        durationSeconds: durationSeconds ?? 0,
        author: author || "\u9644\u8FD1\u7684\u65C5\u4EBA",
        quote: quote ?? null,
        tags: Array.isArray(tags) ? tags : ["#\u58F0\u97F3\u968F\u8BB0"],
        audioData: validAudio,
        imageUri: imageUri || null
      });
      return res.json(rec);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to save recording" });
    }
  });
  app2.get("/api/recordings/:id/audio", async (req, res) => {
    try {
      const result = await storage.getRecordingAudio(req.params.id);
      if (!result) return res.status(404).json({ error: "Audio not found" });
      if (result.startsWith("http")) {
        return res.redirect(result);
      }
      const buf = Buffer.from(result, "base64");
      let mime = "audio/mp4";
      if (buf[0] === 26 && buf[1] === 69 && buf[2] === 223 && buf[3] === 163) {
        mime = "audio/webm";
      } else if (buf[0] === 79 && buf[1] === 103 && buf[2] === 103 && buf[3] === 83) {
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
  app2.get("/api/recordings/my/:userId", async (req, res) => {
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
  app2.post("/api/recordings/:id/like", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId required" });
      const result = await storage.toggleLike(req.params.id, userId);
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to toggle like" });
    }
  });
  app2.post("/api/recordings/:id/comment", async (req, res) => {
    try {
      const { userId, username, text, voiceData } = req.body;
      if (!userId || !text?.trim()) return res.status(400).json({ error: "userId and text required" });
      console.log(`[comment] POST /api/recordings/${req.params.id}/comment - hasVoice: ${!!voiceData}, voiceLen: ${voiceData?.length ?? 0}`);
      const comment = await storage.addComment(req.params.id, userId, username || "\u533F\u540D", text.trim(), voiceData);
      console.log(`[comment] Saved comment ${comment.id}, voiceUrl: ${comment.voiceUrl ?? "none"}`);
      return res.json(comment);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to add comment" });
    }
  });
  app2.get("/api/recordings/:id/interactions", async (req, res) => {
    try {
      const viewerUserId = req.query.viewerUserId;
      const result = await storage.getInteractions(req.params.id, viewerUserId);
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch interactions" });
    }
  });
  app2.get("/api/recordings/nearby", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      const radius = parseFloat(req.query.radius) || 100;
      const viewerUserId = req.query.viewerUserId;
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
  app2.get("/api/config/amap-key", (_req, res) => {
    const key = process.env.AMAP_API_KEY;
    if (!key) return res.status(500).json({ error: "AMAP_API_KEY not configured" });
    return res.json({ key });
  });
  app2.get("/api/amap-locate", (_req, res) => {
    const key = process.env.AMAP_API_KEY;
    const securityKey = process.env.AMAP_SECURITY_KEY || "";
    if (!key) return res.status(500).send("AMAP_API_KEY not configured");
    try {
      const candidates = [
        join(process.cwd(), "server_dist", "amap-locate.html"),
        join(process.cwd(), "server", "amap-locate.html")
      ];
      const htmlPath = candidates.find((p) => existsSync(p));
      if (!htmlPath) return res.status(500).send("amap-locate.html not found");
      const html = readFileSync(htmlPath, "utf-8");
      const page = html.replace(/__AMAP_KEY__/g, key).replace(/__AMAP_SECURITY_KEY__/g, securityKey);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      return res.send(page);
    } catch (e) {
      return res.status(500).send("Failed to load locate page");
    }
  });
  app2.get("/api/speech-recognition", (_req, res) => {
    try {
      const candidates = [
        join(process.cwd(), "server_dist", "speech-recognition.html"),
        join(process.cwd(), "server", "speech-recognition.html")
      ];
      const htmlPath = candidates.find((p) => existsSync(p));
      if (!htmlPath) return res.status(500).send("speech-recognition.html not found");
      const html = readFileSync(htmlPath, "utf-8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.send(html);
    } catch (e) {
      return res.status(500).send("Failed to load speech recognition page");
    }
  });
  app2.get("/api/tiles/:z/:x/:y", (req, res) => {
    const { z, x, y } = req.params;
    const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    const options = {
      headers: {
        "User-Agent": "XiangyinBanlu/1.0 (https://replit.com; cultural-travel-app)",
        "Referer": "https://www.openstreetmap.org/"
      }
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
  app2.get("/api/map-voice-guide", (_req, res) => {
    try {
      const candidates = [
        join(process.cwd(), "server_dist", "map-voice-guide.html"),
        join(process.cwd(), "server", "map-voice-guide.html")
      ];
      const htmlPath = candidates.find((p) => existsSync(p));
      if (!htmlPath) return res.status(500).send("map-voice-guide.html not found");
      const html = readFileSync(htmlPath, "utf-8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      return res.send(html);
    } catch (e) {
      return res.status(500).send("Failed to load map-voice-guide page");
    }
  });
  app2.get("/api/map-tuyugou", (_req, res) => {
    const key = process.env.AMAP_API_KEY;
    const securityKey = process.env.AMAP_SECURITY_KEY || "";
    if (!key) return res.status(500).send("AMAP_API_KEY not configured");
    try {
      const candidates = [
        join(process.cwd(), "server_dist", "map-tuyugou.html"),
        join(process.cwd(), "server", "map-tuyugou.html")
      ];
      const htmlPath = candidates.find((p) => existsSync(p));
      if (!htmlPath) return res.status(500).send("map-tuyugou.html not found");
      const html = readFileSync(htmlPath, "utf-8");
      const page = html.replace(/__AMAP_KEY__/g, key).replace(/__AMAP_SECURITY_KEY__/g, securityKey);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      return res.send(page);
    } catch (e) {
      return res.status(500).send("Failed to load map page");
    }
  });
  app2.get("/api/geocode/reverse", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ error: "lat and lng are required" });
      }
      const amapKey = process.env.AMAP_SERVER_KEY || process.env.AMAP_API_KEY;
      if (!amapKey) {
        return res.status(500).json({ error: "AMAP_SERVER_KEY not configured" });
      }
      const location = `${lng},${lat}`;
      const amapRes = await fetch(
        `https://restapi.amap.com/v3/geocode/regeo?key=${amapKey}&location=${location}&extensions=base&output=json`
      );
      if (!amapRes.ok) {
        return res.status(502).json({ error: "Amap API request failed" });
      }
      const data = await amapRes.json();
      if (data.status !== "1") {
        return res.status(502).json({ error: data.info || "Amap API error" });
      }
      const comp = data.regeocode?.addressComponent ?? {};
      const poi = data.regeocode?.pois?.[0]?.name;
      const township = typeof comp.township === "string" && comp.township ? comp.township : null;
      const neighborhood = typeof comp.neighborhood?.name === "string" && comp.neighborhood.name ? comp.neighborhood.name : null;
      const streetName = typeof comp.streetNumber?.street === "string" && comp.streetNumber.street ? comp.streetNumber.street : null;
      const district = typeof comp.district === "string" && comp.district ? comp.district : null;
      const city = typeof comp.city === "string" && comp.city ? comp.city : typeof comp.province === "string" ? comp.province : null;
      const detailed = poi || neighborhood || streetName || township;
      const area = district || city;
      const parts = [detailed, area].filter(Boolean);
      const name = parts.length > 0 ? parts.join(" \xB7 ") : data.regeocode?.formatted_address || "\u5F53\u524D\u4F4D\u7F6E";
      return res.json({ name, raw: data.regeocode });
    } catch (err) {
      console.error("Reverse geocode error:", err);
      return res.status(500).json({ error: "Reverse geocode failed" });
    }
  });
  app2.get("/api/geocode/ip", async (req, res) => {
    try {
      const amapKey = process.env.AMAP_SERVER_KEY || process.env.AMAP_API_KEY;
      if (!amapKey) {
        return res.status(500).json({ error: "AMAP_SERVER_KEY not configured" });
      }
      const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
      const amapRes = await fetch(
        `https://restapi.amap.com/v3/ip?key=${amapKey}&ip=${clientIp}&output=json`
      );
      if (!amapRes.ok) {
        return res.status(502).json({ error: "Amap IP API failed" });
      }
      const data = await amapRes.json();
      if (data.status !== "1") {
        return res.status(502).json({ error: data.info || "Amap IP error" });
      }
      const city = data.city || data.province || "\u672A\u77E5\u4F4D\u7F6E";
      const rectangle = data.rectangle;
      let lat = null;
      let lng = null;
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
  app2.get("/api/comments/:id/voice", async (req, res) => {
    try {
      const result = await storage.getCommentVoice(req.params.id);
      if (!result) return res.status(404).json({ error: "Voice not found" });
      const buf = Buffer.from(result, "base64");
      let mime = "audio/mp4";
      if (buf[0] === 26 && buf[1] === 69 && buf[2] === 223 && buf[3] === 163) {
        mime = "audio/webm";
      } else if (buf[0] === 79 && buf[1] === 103 && buf[2] === 103 && buf[3] === 83) {
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
  app2.get("/api/ai/voice-status", (_req, res) => {
    const hasKey = !!(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
    res.set("Cache-Control", "no-store");
    res.json({ available: hasKey });
  });
  app2.post("/api/ai/transcribe", async (req, res) => {
    const { audio, mime } = req.body;
    if (!audio) return res.status(400).json({ error: "audio required" });
    const groqKey = process.env.GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!groqKey && !openaiKey) {
      console.log("[Transcribe] No STT API key configured (GROQ_API_KEY or OPENAI_API_KEY)");
      return res.json({ text: "", error: "no_key" });
    }
    try {
      const client = groqKey ? new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1" }) : new OpenAI({ apiKey: openaiKey });
      const model = groqKey ? "whisper-large-v3" : "whisper-1";
      const audioBuffer = Buffer.from(audio, "base64");
      const file = await toFile(audioBuffer, "audio.m4a", { type: mime || "audio/m4a" });
      const transcription = await client.audio.transcriptions.create({
        file,
        model,
        language: "zh"
      });
      console.log(`[Transcribe] text="${transcription.text}"`);
      return res.json({ text: transcription.text });
    } catch (err) {
      console.error("[Transcribe] error:", err?.message);
      return res.status(500).json({ error: "transcription_failed", text: "" });
    }
  });
  app2.post("/api/ai/chat", async (req, res) => {
    try {
      const { messages, emotion, userLocation } = req.body;
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages required" });
      }
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (apiKey) {
        let weatherInfo = "\u6682\u65E0\u5B9E\u65F6\u5929\u6C14\u6570\u636E";
        const amapKey = process.env.AMAP_SERVER_KEY;
        if (amapKey) {
          try {
            const weatherData = await new Promise((resolve2) => {
              https.get(`https://restapi.amap.com/v3/weather/weatherInfo?city=650400&extensions=base&key=${amapKey}`, (res2) => {
                let d = "";
                res2.on("data", (c) => d += c);
                res2.on("end", () => {
                  try {
                    const w = JSON.parse(d);
                    const live = w.lives?.[0];
                    if (live) {
                      resolve2(`${live.weather}\uFF0C\u6C14\u6E29${live.temperature}\xB0C\uFF0C${live.winddirection}\u98CE${live.windpower}\u7EA7\uFF0C\u6E7F\u5EA6${live.humidity}%\uFF08\u6570\u636E\u65F6\u95F4\uFF1A${live.reporttime}\uFF09`);
                    } else {
                      resolve2("\u6682\u65E0\u5B9E\u65F6\u5929\u6C14\u6570\u636E");
                    }
                  } catch {
                    resolve2("\u6682\u65E0\u5B9E\u65F6\u5929\u6C14\u6570\u636E");
                  }
                });
              }).on("error", () => resolve2("\u6682\u65E0\u5B9E\u65F6\u5929\u6C14\u6570\u636E"));
            });
            weatherInfo = weatherData;
          } catch {
          }
        }
        let distanceInfo = "\u4F4D\u7F6E\u672A\u77E5\uFF0C\u65E0\u6CD5\u8BA1\u7B97\u8DDD\u79BB";
        if (userLocation) {
          const R = 6371;
          const dLat = (42.849 - userLocation.lat) * Math.PI / 180;
          const dLng = (89.565 - userLocation.lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(42.849 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
          const km = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
          const hours = km < 80 ? "\u7EA61\u5C0F\u65F6" : km < 150 ? "\u7EA61.5-2\u5C0F\u65F6" : "\u7EA62.5-3\u5C0F\u65F6";
          distanceInfo = `\u7EA6${km}\u516C\u91CC\uFF08${hours}\u8F66\u7A0B\uFF09`;
        }
        const systemPrompt = `\u4F60\u662F\u300C\u5C0F\u4E61\u300D\uFF0C\u4E61\u97F3\u4F34\u65C5APP\u7684AI\u4F34\u6E38\u52A9\u624B\uFF0C\u4E13\u95E8\u670D\u52A1\u4E8E\u65B0\u7586\u5410\u9C81\u756A\u5410\u5CEA\u6C9F\u666F\u533A\u3002

\u3010\u4F60\u7684\u6027\u683C\u3011\u53CB\u5584\u6D3B\u6CFC\u3001\u8BF4\u8BDD\u4EB2\u5207\u81EA\u7136\uFF0C\u50CF\u719F\u6089\u5F53\u5730\u7684\u670B\u53CB\uFF0C\u5076\u5C14\u7A7F\u63D2\u7EF4\u543E\u5C14\u8BED\u8BCD\u6C47\uFF08\u5982"\u4E9A\u514B\u897F"=\u5F88\u597D\uFF0C"\u70ED\u5408\u4E70\u63D0"=\u8C22\u8C22\uFF09\u3002

\u3010\u666F\u533A\u6838\u5FC3\u666F\u70B9\uFF0812\u5904\uFF09\u3011
1. \u666F\u533A\u5165\u53E3\u5927\u95E8\uFF1A\u53E4\u6734\u77F3\u780C\u62F1\u95E8\uFF0C\u6E05\u4EE3\u5EFA\u7B51\uFF0C\u662F\u666F\u533A\u6807\u5FD7\u6027\u5165\u53E3
2. \u9EBB\u624E\u6751\uFF1A\u5343\u5E74\u7EF4\u543E\u5C14\u65CF\u53E4\u6751\u843D\uFF0C\u5B8C\u6574\u751F\u571F\u5EFA\u7B51\u7FA4\uFF0C\u51AC\u6696\u590F\u51C9
3. \u5410\u5CEA\u6C9F\u6E05\u771F\u5BFA\uFF1A\u5386\u53F2\u60A0\u4E45\u4F0A\u65AF\u5170\u5EFA\u7B51\uFF0C\u7CBE\u7F8E\u6728\u96D5\u88C5\u9970
4. \u5343\u5E74\u6D1E\u7A9F\uFF1A\u516C\u51434\u4E16\u7EAA\u4F5B\u6559\u77F3\u7A9F\u7FA4\uFF0C\u58C1\u753B\u4FDD\u5B58\u5B8C\u597D\uFF0C\u4E1D\u8DEF\u9057\u73CD
5. \u53E4\u9EBB\u624E\u9057\u5740\uFF1A\u65B0\u7586\u6700\u53E4\u8001\u7684\u4F0A\u65AF\u5170\u5723\u7960\u9057\u5740
6. \u975E\u9057\u6587\u5316\u9986\uFF1A\u7EF4\u543E\u5C14\u65CF\u975E\u9057\u5C55\u793A\uFF0C\u542B\u6728\u5361\u59C6\u97F3\u4E50\u3001\u90FD\u5B83\u5C14\u4E50\u5668
7. \u6C11\u4FD7\u4F53\u9A8C\u9986\uFF1A\u4F20\u7EDF\u624B\u5DE5\u827A\u5C55\u793A\u4E0E\u4E92\u52A8\u4F53\u9A8C
8. \u8461\u8404\u667E\u623F\uFF1A\u4F20\u7EDF\u571F\u576F\u667E\u623F\uFF0C\u79CB\u5B63\u8461\u8404\u5E72\u9999\u6C14\u56DB\u6EA2
9. \u7279\u4EA7\u96C6\u5E02\uFF1A\u8461\u8404\u5E72\u3001\u65E0\u82B1\u679C\u3001\u9995\u997C\u7B49\u7279\u8272\u519C\u4EA7\u54C1
10. \u70E4\u9995\u9986\uFF1A\u73B0\u70E4\u5751\u7089\u9995\u997C\uFF0C\u5916\u8106\u5185\u8F6F\uFF0C\u5F53\u5730\u7279\u8272\u4E3B\u98DF
11. \u74DC\u679C\u957F\u5ECA\uFF1A\u54C8\u5BC6\u74DC\u3001\u767D\u674F\u7B49\u7279\u8272\u74DC\u679C\uFF0C\u53EF\u73B0\u573A\u54C1\u5C1D
12. \u6E38\u5BA2\u670D\u52A1\u4E2D\u5FC3\uFF1A\u666F\u533A\u5BFC\u89C8\u3001\u79DF\u8D41\u3001\u6025\u6551\u7EFC\u5408\u670D\u52A1

\u3010\u5410\u9C81\u756A\u5B9E\u65F6\u5929\u6C14\u3011${weatherInfo}

\u3010\u6E38\u5BA2\u5F53\u524D\u4FE1\u606F\u3011
- \u60C5\u7EEA\u72B6\u6001\uFF1A${emotion || "\u5E73\u9759"}\uFF08\u75B2\u60EB\u65F6\u5EFA\u8BAE\u4F11\u606F\u666F\u70B9\uFF0C\u597D\u5947\u65F6\u6DF1\u5165\u8BB2\u89E3\uFF0C\u6109\u5FEB\u65F6\u5206\u4EAB\u8DA3\u5473\u7EC6\u8282\uFF09
- \u5F53\u524D\u4F4D\u7F6E\uFF1A${userLocation ? userLocation.name : "\u4F4D\u7F6E\u672A\u77E5"}
- \u8DDD\u5410\u5CEA\u6C9F\u666F\u533A\u7684\u8DDD\u79BB\uFF1A${distanceInfo}

\u3010\u56DE\u7B54\u539F\u5219\u3011
- \u76F4\u63A5\u56DE\u7B54\u7528\u6237\u7684\u5177\u4F53\u95EE\u9898\uFF0C\u4E0D\u8981\u7B54\u975E\u6240\u95EE
- \u6D89\u53CA\u4EA4\u901A/\u8DDD\u79BB\u65F6\uFF0C\u5FC5\u987B\u6839\u636E\u7528\u6237\u5F53\u524D\u4F4D\u7F6E\u7ED9\u51FA\u51C6\u786E\u4FE1\u606F
- \u7ED3\u5408\u4EE5\u4E0A\u5177\u4F53\u666F\u70B9\u4FE1\u606F\u7ED9\u51FA\u5B9E\u7528\u5EFA\u8BAE
- \u56DE\u7B54\u7B80\u6D01\u751F\u52A8\uFF0C\u63A7\u5236\u5728200\u5B57\u4EE5\u5185
- \u5982\u679C\u95EE\u9898\u4E0E\u5410\u5CEA\u6C9F/\u5410\u9C81\u756A\u65E0\u5173\uFF0C\u5F15\u5BFC\u8BDD\u9898\u56DE\u5230\u65C5\u6E38\u76F8\u5173\u5185\u5BB9`;
        const deepseekClient = new OpenAI({
          baseURL: "https://api.deepseek.com",
          apiKey
        });
        const completion = await deepseekClient.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages
          ],
          max_tokens: 300,
          temperature: 0.85
        });
        console.log("[DeepSeek] usage:", completion.usage);
        const reply2 = completion.choices[0]?.message?.content || "\u62B1\u6B49\uFF0C\u6211\u6682\u65F6\u65E0\u6CD5\u56DE\u7B54\u8FD9\u4E2A\u95EE\u9898\uFF5E";
        const lastMsg2 = messages[messages.length - 1]?.content?.toLowerCase() || "";
        let newEmotion2 = emotion || "\u5E73\u9759";
        if (lastMsg2.includes("\u7D2F") || lastMsg2.includes("\u75B2\u60EB") || lastMsg2.includes("\u8D70\u4E0D\u52A8")) newEmotion2 = "\u75B2\u60EB";
        else if (lastMsg2.includes("\u597D\u73A9") || lastMsg2.includes("\u5F00\u5FC3") || lastMsg2.includes("\u68D2")) newEmotion2 = "\u6109\u5FEB";
        else if (lastMsg2.includes("?") || lastMsg2.includes("\uFF1F") || lastMsg2.includes("\u4E3A\u4EC0\u4E48") || lastMsg2.includes("\u600E\u4E48")) newEmotion2 = "\u597D\u5947";
        else if (lastMsg2.includes("\u8C22") || lastMsg2.includes("\u592A\u597D\u4E86")) newEmotion2 = "\u5F00\u5FC3";
        return res.json({ reply: reply2, emotion: newEmotion2 });
      }
      const lastMsg = messages[messages.length - 1]?.content || "";
      const mocks = {
        "\u5386\u53F2": "\u5410\u5CEA\u6C9F\u662F\u65B0\u7586\u6700\u53E4\u8001\u7684\u5343\u5E74\u7EF4\u543E\u5C14\u65CF\u6751\u843D\u4E4B\u4E00\uFF0C\u8FD9\u91CC\u7684\u9EC4\u571F\u7A91\u6D1E\u5DF2\u67091700\u591A\u5E74\u5386\u53F2\uFF01\u9EBB\u624E\u6751\u91CC\u7684\u53E4\u7ECF\u6587\u6D1E\u66F4\u662F\u4E1D\u7EF8\u4E4B\u8DEF\u4E0A\u7684\u6587\u5316\u7470\u5B9D\uFF0C\u8981\u4E0D\u8981\u6211\u5E26\u4F60\u53BB\u63A2\u79D8\uFF1F",
        "\u7F8E\u98DF": "\u5410\u9C81\u756A\u6700\u4E0D\u80FD\u9519\u8FC7\u7684\u5C31\u662F\u70E4\u7F8A\u8089\u4E32\u548C\u8461\u8404\u5E72\u5566\uFF01\u9995\u5751\u70E4\u8089\u9999\u6C14\u56DB\u6EA2\uFF0C\u518D\u6765\u4E00\u4E32\u51B0\u9547\u77F3\u69B4\u6C41\uFF0C\u75B2\u60EB\u5168\u6D88\uFF5E\u672C\u5730\u5927\u5988\u81EA\u5236\u7684\u674F\u5E72\u9178\u751C\u723D\u53E3\uFF0C\u8BB0\u5F97\u5E26\u4E00\u888B\u56DE\u53BB\uFF01",
        "\u666F\u70B9": "\u5410\u5CEA\u6C9F\u5927\u5CE1\u8C37\u5C42\u5C42\u53E0\u53E0\uFF0C\u5149\u7EBF\u89D2\u5EA6\u4E0D\u540C\u989C\u8272\u4E5F\u4E0D\u540C\uFF0C\u4E0B\u5348\u4E09\u70B9\u662F\u62CD\u7167\u9EC4\u91D1\u65F6\u6BB5\u54E6\uFF01\u5343\u4F5B\u6D1E\u91CC\u7684\u58C1\u753B\u5386\u7ECF\u5343\u5E74\uFF0C\u6BCF\u4E00\u5E45\u90FD\u662F\u6545\u4E8B\u3002\u6211\u5E2E\u4F60\u89C4\u5212\u4E00\u6761\u6700\u7F8E\u8DEF\u7EBF\uFF1F",
        "\u62CD\u7167": "\u6700\u4F73\u62CD\u6444\u5730\uFF1A\u2460\u5410\u5CEA\u6C9F\u6751\u53E3\u7684\u767E\u5E74\u6838\u6843\u6811\u4E0B\uFF0C\u2461\u5927\u5CE1\u8C37\u7EA2\u8272\u5CA9\u58C1\u524D\uFF0C\u2462\u5343\u4F5B\u6D1E\u5149\u5F71\u4EA4\u9519\u5904\u3002\u63A8\u8350\u65E9\u66688-10\u70B9\uFF0C\u5149\u7EBF\u6700\u67D4\u548C\uFF0C\u4EBA\u4E5F\u5C11\uFF01\u9700\u8981\u59FF\u52BF\u5EFA\u8BAE\u5417\uFF1F",
        "\u7D2F": "\u542C\u8D77\u6765\u4F60\u8D70\u4E86\u4E0D\u5C11\u8DEF\u5462\uFF5E\u9644\u8FD1\u6709\u4E2A\u5C0F\u8336\u9986\uFF0C\u7EF4\u543E\u5C14\u65CF\u8001\u5976\u5976\u4F1A\u6CE1\u9999\u6D53\u7684\u73AB\u7470\u82B1\u8336\uFF0C\u5750\u4E0B\u6765\u6B47\u6B47\u811A\uFF0C\u987A\u4FBF\u5C1D\u5C1D\u521A\u51FA\u7089\u7684\u9995\uFF0C\u4FDD\u8BC1\u7CBE\u529B\u6EE1\u6EE1\uFF01"
      };
      let reply = "\u4F60\u597D\u5440\uFF01\u6211\u662F\u5C0F\u4E61\uFF0C\u4F60\u7684\u4E13\u5C5E\u65C5\u884C\u4F34\u6E38\uFF5E\u4ECA\u5929\u60F3\u63A2\u7D22\u5410\u5CEA\u6C9F\u7684\u54EA\u4E2A\u89D2\u843D\uFF1F\u5386\u53F2\u6587\u5316\u3001\u7279\u8272\u7F8E\u98DF\u3001\u7EDD\u7F8E\u666F\u70B9\uFF0C\u6211\u90FD\u80FD\u7ED9\u4F60\u6700\u68D2\u7684\u653B\u7565\uFF01";
      for (const [key, val] of Object.entries(mocks)) {
        if (lastMsg.includes(key)) {
          reply = val;
          break;
        }
      }
      let newEmotion = emotion || "\u5E73\u9759";
      if (lastMsg.includes("\u7D2F") || lastMsg.includes("\u75B2\u60EB")) newEmotion = "\u75B2\u60EB";
      else if (lastMsg.includes("\u597D\u73A9") || lastMsg.includes("\u68D2")) newEmotion = "\u6109\u5FEB";
      else if (lastMsg.includes("?") || lastMsg.includes("\uFF1F") || lastMsg.includes("\u4E3A\u4EC0\u4E48")) newEmotion = "\u597D\u5947";
      else if (lastMsg.includes("\u8C22")) newEmotion = "\u5F00\u5FC3";
      return res.json({ reply, emotion: newEmotion });
    } catch (err) {
      console.error("[ai/chat]", err);
      return res.status(500).json({ error: "AI\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs from "fs";
import * as path from "path";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      limit: "10mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app2.use(express.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
