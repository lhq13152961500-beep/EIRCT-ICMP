import React, { createContext, useContext, useState, useCallback } from "react";

export interface PublishedRecording {
  id: string;
  title: string;
  locationName: string;
  lat: number;
  lng: number;
  durationSeconds: number;
  publishedAt: string;
  imageUri?: string;
  audioUri?: string;
}

export interface RecordingNotification {
  id: string;
  recordingId: string;
  type: "like" | "comment";
}

export interface RecordingComment {
  id: string;
  username: string;
  time: string;
  text: string;
}

export interface DeviceLocation {
  lat: number;
  lng: number;
}

interface RecordingsContextValue {
  myRecordings: PublishedRecording[];
  addMyRecording: (rec: PublishedRecording) => void;
  newIds: string[];
  acknowledgeNew: () => void;
  notifications: RecordingNotification[];
  acknowledgeNotifications: () => void;
  likeCounts: Record<string, number>;
  commentsByRecording: Record<string, RecordingComment[]>;
  deviceLocation: DeviceLocation | null;
  setDeviceLocation: (loc: DeviceLocation) => void;
}

const RecordingsContext = createContext<RecordingsContextValue>({
  myRecordings: [],
  addMyRecording: () => {},
  newIds: [],
  acknowledgeNew: () => {},
  notifications: [],
  acknowledgeNotifications: () => {},
  likeCounts: {},
  commentsByRecording: {},
  deviceLocation: null,
  setDeviceLocation: () => {},
});

const SIMULATED_COMMENTERS = [
  { username: "聪明的一休", text: "这段声音真的太治愈了，谢谢你的分享！" },
  { username: "山野行者", text: "听了好几遍，感觉自己也在那里了。" },
  { username: "绿野探客", text: "好美的声音，下次我也要去这里录一段。" },
  { username: "读论文的silan学长", text: "这种宁静的感觉太难得了，收藏了！" },
];

export function RecordingsProvider({ children }: { children: React.ReactNode }) {
  const [myRecordings, setMyRecordings] = useState<PublishedRecording[]>([]);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<RecordingNotification[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentsByRecording, setCommentsByRecording] = useState<Record<string, RecordingComment[]>>({});
  const [deviceLocation, setDeviceLocationState] = useState<DeviceLocation | null>(null);

  const setDeviceLocation = useCallback((loc: DeviceLocation) => {
    setDeviceLocationState(loc);
  }, []);

  const addMyRecording = useCallback((rec: PublishedRecording) => {
    setMyRecordings((prev) => [rec, ...prev]);
    setNewIds((prev) => [rec.id, ...prev]);
    setCommentsByRecording((prev) => ({ ...prev, [rec.id]: [] }));

    setTimeout(() => {
      setLikeCounts((prev) => ({ ...prev, [rec.id]: (prev[rec.id] ?? 0) + 1 }));
      setNotifications((prev) => [
        ...prev,
        { id: Date.now().toString() + "l", recordingId: rec.id, type: "like" },
      ]);
    }, 12000);

    setTimeout(() => {
      const commenter = SIMULATED_COMMENTERS[Math.floor(Math.random() * SIMULATED_COMMENTERS.length)];
      const now = new Date();
      const time = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const newComment: RecordingComment = {
        id: Date.now().toString() + "c",
        username: commenter.username,
        time,
        text: commenter.text,
      };
      setCommentsByRecording((prev) => ({
        ...prev,
        [rec.id]: [...(prev[rec.id] ?? []), newComment],
      }));
      setNotifications((prev) => [
        ...prev,
        { id: Date.now().toString() + "cn", recordingId: rec.id, type: "comment" },
      ]);
    }, 24000);
  }, []);

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
      newIds,
      acknowledgeNew,
      notifications,
      acknowledgeNotifications,
      likeCounts,
      commentsByRecording,
      deviceLocation,
      setDeviceLocation,
    }}>
      {children}
    </RecordingsContext.Provider>
  );
}

export function useRecordings() {
  return useContext(RecordingsContext);
}
