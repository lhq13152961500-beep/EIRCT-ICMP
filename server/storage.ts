import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import { supabase } from "./supabase";
import { Pool } from "pg";

const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Profile ──────────────────────────────────────────────────────────────────

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

// ─── Haversine (server-side distance check) ───────────────────────────────────

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

// ─── Sound Recording ──────────────────────────────────────────────────────────

export interface SoundRecording {
  id: string;
  title: string;
  locationName: string;
  lat: number;
  lng: number;
  durationSeconds: number;
  publishedAt: string;
  author: string;
  quote: string | null;
  tags: string[];
}

export type InsertRecording = Omit<SoundRecording, "id" | "publishedAt">;

// ─── Storage Interface ────────────────────────────────────────────────────────

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(username: string, hashedPassword: string): Promise<boolean>;

  getProfile(userId: string): Promise<UserProfile | null>;
  upsertProfile(userId: string, data: Partial<Omit<UserProfile, "userId" | "updatedAt">>): Promise<UserProfile>;

  addRecording(r: InsertRecording): Promise<SoundRecording>;
  getNearbyRecordings(lat: number, lng: number, radiusMeters: number): Promise<SoundRecording[]>;
}

// ─── Supabase + In-Memory Hybrid Implementation ───────────────────────────────
// Users → Supabase (persistent)
// Recordings → In-memory (ephemeral, by design)

export class HybridStorage implements IStorage {
  private recordings: Map<string, SoundRecording> = new Map();

  // ── Users via Supabase ──────────────────────────────────────────────────────

  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from("users")
      .select("id, username, password")
      .eq("id", id)
      .single();
    if (error || !data) return undefined;
    return { id: data.id, username: data.username, password: data.password };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from("users")
      .select("id, username, password")
      .eq("username", username)
      .single();
    if (error || !data) return undefined;
    return { id: data.id, username: data.username, password: data.password };
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const { data, error } = await supabase
      .from("users")
      .insert({ id, username: insertUser.username, password: insertUser.password })
      .select("id, username, password")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create user");
    return { id: data.id, username: data.username, password: data.password };
  }

  async updateUserPassword(username: string, hashedPassword: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("users")
      .update({ password: hashedPassword })
      .eq("username", username)
      .select("id")
      .single();
    if (error || !data) return false;
    return true;
  }

  // ── Profiles via Replit PostgreSQL ─────────────────────────────────────────

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

  // ── Recordings in-memory ────────────────────────────────────────────────────

  async addRecording(r: InsertRecording): Promise<SoundRecording> {
    const id = randomUUID();
    const rec: SoundRecording = { ...r, id, publishedAt: new Date().toISOString() };
    this.recordings.set(id, rec);
    return rec;
  }

  async getNearbyRecordings(lat: number, lng: number, radiusMeters: number): Promise<SoundRecording[]> {
    return Array.from(this.recordings.values()).filter(
      (r) => haversineMeters(lat, lng, r.lat, r.lng) <= radiusMeters
    );
  }
}

export const storage = new HybridStorage();
