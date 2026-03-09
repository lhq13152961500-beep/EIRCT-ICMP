import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { apiRequest, getApiUrl } from "@/lib/query-client";

export interface PublishedRecording {
  id: string;
  userId?: string;
  title: string;
  locationName: string;
  lat: number;
  lng: number;
  durationSeconds: number;
  publishedAt: string;
  imageUri?: string;
  audioUri?: string;
  audioUrl?: string;
  likeCount?: number;
  comments?: RecordingComment[];
  isLiked?: boolean;
}

export interface RecordingNotification {
  id: string;
  recordingId: string;
  type: "like" | "comment";
}

export interface RecordingComment {
  id: string;
  recordingId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
  time: string;
}

export interface DeviceLocation {
  lat: number;
  lng: number;
}

interface RecordingsContextValue {
  myRecordings: PublishedRecording[];
  addMyRecording: (rec: PublishedRecording) => void;
  refreshMyRecordings: () => void;
  newIds: string[];
  acknowledgeNew: () => void;
  notifications: RecordingNotification[];
  acknowledgeNotifications: () => void;
  likeCounts: Record<string, number>;
  commentsByRecording: Record<string, RecordingComment[]>;
  deviceLocation: DeviceLocation | null;
  setDeviceLocation: (loc: DeviceLocation) => void;
  currentUserId: string | null;
  setCurrentUserId: (id: string | null) => void;
}

const RecordingsContext = createContext<RecordingsContextValue>({
  myRecordings: [],
  addMyRecording: () => {},
  refreshMyRecordings: () => {},
  newIds: [],
  acknowledgeNew: () => {},
  notifications: [],
  acknowledgeNotifications: () => {},
  likeCounts: {},
  commentsByRecording: {},
  deviceLocation: null,
  setDeviceLocation: () => {},
  currentUserId: null,
  setCurrentUserId: () => {},
});

export function RecordingsProvider({ children }: { children: React.ReactNode }) {
  const [myRecordings, setMyRecordings] = useState<PublishedRecording[]>([]);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<RecordingNotification[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentsByRecording, setCommentsByRecording] = useState<Record<string, RecordingComment[]>>({});
  const [deviceLocation, setDeviceLocationState] = useState<DeviceLocation | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const setDeviceLocation = useCallback((loc: DeviceLocation) => {
    setDeviceLocationState(loc);
  }, []);

  const fetchMyRecordings = useCallback(async () => {
    if (!currentUserId || fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const url = new URL(`/api/recordings/my/${encodeURIComponent(currentUserId)}`, getApiUrl());
      const resp = await fetch(url.href);
      if (resp.ok) {
        const data = await resp.json() as PublishedRecording[];
        setMyRecordings(data);
        const lc: Record<string, number> = {};
        const cb: Record<string, RecordingComment[]> = {};
        for (const r of data) {
          lc[r.id] = r.likeCount ?? 0;
          cb[r.id] = ((r.comments ?? []) as any[]).map((c: any) => {
            const d = new Date(c.createdAt);
            const time = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            return { ...c, time } as RecordingComment;
          });
        }
        setLikeCounts(lc);
        setCommentsByRecording(cb);
      }
    } catch (e) {
      console.log("[recordings] Failed to fetch my recordings:", e);
    } finally {
      fetchingRef.current = false;
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      fetchMyRecordings();
    } else {
      setMyRecordings([]);
      setLikeCounts({});
      setCommentsByRecording({});
    }
  }, [currentUserId, fetchMyRecordings]);

  useEffect(() => {
    if (!currentUserId) return;
    const interval = setInterval(fetchMyRecordings, 15000);
    return () => clearInterval(interval);
  }, [currentUserId, fetchMyRecordings]);

  const addMyRecording = useCallback((rec: PublishedRecording) => {
    setMyRecordings((prev) => [rec, ...prev]);
    setNewIds((prev) => [rec.id, ...prev]);
    setCommentsByRecording((prev) => ({ ...prev, [rec.id]: [] }));
    setLikeCounts((prev) => ({ ...prev, [rec.id]: 0 }));
  }, []);

  const refreshMyRecordings = useCallback(() => {
    fetchMyRecordings();
  }, [fetchMyRecordings]);

  const acknowledgeNew = useCallback(() => {
    setNewIds([]);
  }, []);

  const acknowledgeNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <RecordingsContext.Provider value={{
      myRecordings,
      addMyRecording,
      refreshMyRecordings,
      newIds,
      acknowledgeNew,
      notifications,
      acknowledgeNotifications,
      likeCounts,
      commentsByRecording,
      deviceLocation,
      setDeviceLocation,
      currentUserId,
      setCurrentUserId,
    }}>
      {children}
    </RecordingsContext.Provider>
  );
}

export function useRecordings() {
  return useContext(RecordingsContext);
}
