import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";

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
  publishedAt: string; // ISO
}

export type InsertRecording = Omit<SoundRecording, "id" | "publishedAt">;

// ─── Storage Interface ────────────────────────────────────────────────────────

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  addRecording(r: InsertRecording): Promise<SoundRecording>;
  getNearbyRecordings(lat: number, lng: number, radiusMeters: number): Promise<SoundRecording[]>;
}

// ─── In-Memory Implementation ─────────────────────────────────────────────────

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private recordings: Map<string, SoundRecording> = new Map();

  async getUser(id: string) { return this.users.get(id); }
  async getUserByUsername(username: string) {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

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

export const storage = new MemStorage();
