import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage, type InsertRecording } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // POST /api/recordings — publish a sound recording with GPS location
  app.post("/api/recordings", async (req, res) => {
    try {
      const { locationName, lat, lng, durationSeconds } = req.body as InsertRecording;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ error: "lat and lng are required numbers" });
      }
      const rec = await storage.addRecording({
        locationName: locationName || "未知位置",
        lat,
        lng,
        durationSeconds: durationSeconds ?? 0,
      });
      return res.json(rec);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to save recording" });
    }
  });

  // GET /api/recordings/nearby?lat=X&lng=Y&radius=50 — fetch recordings near a location
  app.get("/api/recordings/nearby", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 50;
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
