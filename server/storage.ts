import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import { Pool } from "pg";

const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

export interface UserProfile {
  userId: string;
  displayName: string | null;
  bio: string | null;
  gender: string | null;
  birthYear: string | null;
  birthMonth: string | null;
  region: string | null;
  phone: string | null;
  address: string | null;
  avatarUrl: string | null;
  updatedAt: string;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface SoundRecording {
  id: string;
  userId?: string;
  title: string;
  locationName: string;
  lat: number;
  lng: number;
  durationSeconds: number;
  publishedAt: string;
  author: string;
  quote: string | null;
  tags: string[];
  audioData?: string;
  imageUri?: string;
  audioUri?: string;
  audioUrl?: string;
  likeCount?: number;
  comments?: RecordingComment[];
  isLiked?: boolean;
}

export type InsertRecording = Omit<SoundRecording, "id" | "publishedAt" | "audioUri" | "likeCount" | "comments" | "isLiked">;

export interface RecordingComment {
  id: string;
  recordingId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
  voiceUrl?: string | null;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(username: string, hashedPassword: string): Promise<boolean>;

  getProfile(userId: string): Promise<UserProfile | null>;
  upsertProfile(userId: string, data: Partial<Omit<UserProfile, "userId" | "updatedAt">>): Promise<UserProfile>;

  addRecording(r: InsertRecording): Promise<SoundRecording>;
  getRecordingAudio(id: string): Promise<string | null>;
  getNearbyRecordings(lat: number, lng: number, radiusMeters: number, viewerUserId?: string): Promise<SoundRecording[]>;
  getRecordingsByUser(userId: string): Promise<SoundRecording[]>;

  toggleLike(recordingId: string, userId: string): Promise<{ liked: boolean; likeCount: number }>;
  addComment(recordingId: string, userId: string, username: string, text: string, voiceData?: string): Promise<RecordingComment>;
  getCommentVoice(commentId: string): Promise<string | null>;
  getInteractions(recordingId: string, viewerUserId?: string): Promise<{ likeCount: number; isLiked: boolean; comments: RecordingComment[] }>;
}

export class HybridStorage implements IStorage {

  async getUser(id: string): Promise<User | undefined> {
    const res = await pgPool.query(
      "SELECT id, username, password FROM users WHERE id = $1",
      [id]
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return { id: row.id, username: row.username, password: row.password };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const res = await pgPool.query(
      "SELECT id, username, password FROM users WHERE username = $1",
      [username]
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return { id: row.id, username: row.username, password: row.password };
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const res = await pgPool.query(
      "INSERT INTO users (id, username, password) VALUES ($1, $2, $3) RETURNING id, username, password",
      [id, insertUser.username, insertUser.password]
    );
    const row = res.rows[0];
    return { id: row.id, username: row.username, password: row.password };
  }

  async updateUserPassword(username: string, hashedPassword: string): Promise<boolean> {
    const res = await pgPool.query(
      "UPDATE users SET password = $1 WHERE username = $2 RETURNING id",
      [hashedPassword, username]
    );
    return (res.rowCount ?? 0) > 0;
  }

  private rowToProfile(row: Record<string, unknown>): UserProfile {
    return {
      userId:      row.user_id as string,
      displayName: row.display_name as string | null,
      bio:         row.bio as string | null,
      gender:      row.gender as string | null,
      birthYear:   row.birth_year as string | null,
      birthMonth:  row.birth_month as string | null,
      region:      row.region as string | null,
      phone:       row.phone as string | null,
      address:     row.address as string | null,
      avatarUrl:   row.avatar_url as string | null,
      updatedAt:   row.updated_at as string,
    };
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const res = await pgPool.query(
      "SELECT * FROM profiles WHERE user_id = $1",
      [userId]
    );
    if (res.rows.length === 0) return null;
    return this.rowToProfile(res.rows[0]);
  }

  async upsertProfile(
    userId: string,
    data: Partial<Omit<UserProfile, "userId" | "updatedAt">>
  ): Promise<UserProfile> {
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
        data.avatarUrl ?? null,
      ]
    );
    return this.rowToProfile(res.rows[0]);
  }

  private rowToRecording(row: Record<string, unknown>): SoundRecording {
    return {
      id: row.id as string,
      userId: row.user_id as string | undefined,
      title: row.title as string,
      locationName: row.location_name as string,
      lat: row.lat as number,
      lng: row.lng as number,
      durationSeconds: row.duration_seconds as number,
      publishedAt: (row.published_at as Date).toISOString(),
      author: row.author as string,
      quote: row.quote as string | null,
      tags: (row.tags as string[]) || [],
      imageUri: row.image_uri as string | undefined,
      audioUrl: row.audio_url as string | undefined,
    };
  }

  async addRecording(r: InsertRecording): Promise<SoundRecording> {
    let audioData: string | null = null;

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
        r.imageUri ?? null,
      ]
    );
    const rec = this.rowToRecording(res.rows[0]);
    if (audioData) {
      rec.audioUri = `/api/recordings/${rec.id}/audio`;
    }
    return rec;
  }

  async getRecordingAudio(id: string): Promise<string | null> {
    const res = await pgPool.query(
      "SELECT audio_url, audio_data FROM recordings WHERE id = $1",
      [id]
    );
    if (res.rows.length === 0) return null;
    if (res.rows[0].audio_url) return res.rows[0].audio_url;
    return res.rows[0].audio_data ?? null;
  }

  async getNearbyRecordings(lat: number, lng: number, radiusMeters: number, viewerUserId?: string): Promise<SoundRecording[]> {
    const res = await pgPool.query(
      `SELECT id, user_id, title, location_name, lat, lng, duration_seconds, published_at, author, quote, tags, image_uri, audio_url,
              (audio_data IS NOT NULL OR audio_url IS NOT NULL) AS has_audio
       FROM recordings
       ORDER BY published_at DESC
       LIMIT 200`
    );
    const nearby = res.rows
      .filter((r: any) => haversineMeters(lat, lng, r.lat, r.lng) <= radiusMeters)
      .map((r: any) => {
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
    const likeMap: Record<string, number> = {};
    for (const row of likesRes.rows) likeMap[row.recording_id] = row.cnt;

    const commentsRes = await pgPool.query(
      `SELECT id, recording_id, user_id, username, text, created_at, voice_url FROM recording_comments WHERE recording_id = ANY($1) ORDER BY created_at ASC`,
      [ids]
    );
    const commentMap: Record<string, RecordingComment[]> = {};
    for (const row of commentsRes.rows) {
      const rid = row.recording_id;
      if (!commentMap[rid]) commentMap[rid] = [];
      commentMap[rid].push({
        id: row.id,
        recordingId: rid,
        userId: row.user_id,
        username: row.username,
        text: row.text,
        createdAt: (row.created_at as Date).toISOString(),
        voiceUrl: row.voice_url,
      });
    }

    let userLikeSet = new Set<string>();
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

  async getRecordingsByUser(userId: string): Promise<SoundRecording[]> {
    const res = await pgPool.query(
      `SELECT id, user_id, title, location_name, lat, lng, duration_seconds, published_at, author, quote, tags, image_uri, audio_url,
              (audio_data IS NOT NULL OR audio_url IS NOT NULL) AS has_audio
       FROM recordings
       WHERE user_id = $1
       ORDER BY published_at DESC`,
      [userId]
    );
    const recs = res.rows.map((r: any) => {
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
    const likeMap: Record<string, number> = {};
    for (const row of likesRes.rows) likeMap[row.recording_id] = row.cnt;

    const commentsRes = await pgPool.query(
      `SELECT id, recording_id, user_id, username, text, created_at, voice_url FROM recording_comments WHERE recording_id = ANY($1) ORDER BY created_at ASC`,
      [ids]
    );
    const commentMap: Record<string, RecordingComment[]> = {};
    for (const row of commentsRes.rows) {
      const rid = row.recording_id;
      if (!commentMap[rid]) commentMap[rid] = [];
      commentMap[rid].push({
        id: row.id,
        recordingId: rid,
        userId: row.user_id,
        username: row.username,
        text: row.text,
        createdAt: (row.created_at as Date).toISOString(),
        voiceUrl: row.voice_url,
      });
    }

    for (const rec of recs) {
      rec.likeCount = likeMap[rec.id] ?? 0;
      rec.comments = commentMap[rec.id] ?? [];
    }

    return recs;
  }

  async toggleLike(recordingId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const delRes = await pgPool.query(
      `DELETE FROM recording_likes WHERE recording_id = $1 AND user_id = $2 RETURNING id`,
      [recordingId, userId]
    );
    let liked: boolean;
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

  async addComment(recordingId: string, userId: string, username: string, text: string, voiceData?: string): Promise<RecordingComment> {
    let voiceUrl: string | null = null;

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
      createdAt: (row.created_at as Date).toISOString(),
      voiceUrl: voiceData ? voiceUrl : row.voice_url,
    };
  }

  async getCommentVoice(commentId: string): Promise<string | null> {
    const res = await pgPool.query(
      "SELECT voice_data FROM recording_comments WHERE id = $1",
      [commentId]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0].voice_data ?? null;
  }

  async getInteractions(recordingId: string, viewerUserId?: string): Promise<{ likeCount: number; isLiked: boolean; comments: RecordingComment[] }> {
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
    const comments: RecordingComment[] = commentsRes.rows.map((row: any) => ({
      id: row.id,
      recordingId: row.recording_id,
      userId: row.user_id,
      username: row.username,
      text: row.text,
      createdAt: (row.created_at as Date).toISOString(),
      voiceUrl: row.voice_url,
    }));
    return { likeCount: likeRes.rows[0].cnt, isLiked, comments };
  }
}

export const storage = new HybridStorage();
