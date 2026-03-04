import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import { supabase } from "./supabase";

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
