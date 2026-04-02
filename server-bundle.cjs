"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/index.ts
var import_express = __toESM(require("express"));

// server/routes.ts
var import_node_http = require("node:http");
var import_crypto2 = require("crypto");
var import_node_fs = require("node:fs");
var import_node_path = require("node:path");

// server/storage.ts
var import_crypto = require("crypto");
var import_pg = require("pg");
var pgPool = new import_pg.Pool({ connectionString: process.env.DATABASE_URL });
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
    const id = (0, import_crypto.randomUUID)();
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
  return (0, import_crypto2.createHash)("sha256").update(pw + PW_SALT).digest("hex");
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
      const html = (0, import_node_fs.readFileSync)((0, import_node_path.join)(__dirname, "amap-locate.html"), "utf-8");
      const page = html.replace(/__AMAP_KEY__/g, key).replace(/__AMAP_SECURITY_KEY__/g, securityKey);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      return res.send(page);
    } catch (e) {
      return res.status(500).send("Failed to load locate page");
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
  const httpServer = (0, import_node_http.createServer)(app2);
  return httpServer;
}

// server/index.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var app = (0, import_express.default)();
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
    import_express.default.json({
      limit: "10mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(import_express.default.urlencoded({ extended: false }));
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
  app2.use("/assets", import_express.default.static(path.resolve(process.cwd(), "assets")));
  app2.use(import_express.default.static(path.resolve(process.cwd(), "static-build")));
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
