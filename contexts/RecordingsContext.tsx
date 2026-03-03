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

interface RecordingsContextValue {
  myRecordings: PublishedRecording[];
  addMyRecording: (rec: PublishedRecording) => void;
  newIds: string[];
  acknowledgeNew: () => void;
  notifications: RecordingNotification[];
  acknowledgeNotifications: () => void;
  likeCounts: Record<string, number>;
  commentCounts: Record<string, number>;
}

const RecordingsContext = createContext<RecordingsContextValue>({
  myRecordings: [],
  addMyRecording: () => {},
  newIds: [],
  acknowledgeNew: () => {},
  notifications: [],
  acknowledgeNotifications: () => {},
  likeCounts: {},
  commentCounts: {},
});

export function RecordingsProvider({ children }: { children: React.ReactNode }) {
  const [myRecordings, setMyRecordings] = useState<PublishedRecording[]>([]);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<RecordingNotification[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const addMyRecording = useCallback((rec: PublishedRecording) => {
    setMyRecordings((prev) => [rec, ...prev]);
    setNewIds((prev) => [rec.id, ...prev]);

    setTimeout(() => {
      setLikeCounts((prev) => ({ ...prev, [rec.id]: (prev[rec.id] ?? 0) + 1 }));
      setNotifications((prev) => [
        ...prev,
        { id: Date.now().toString() + "l", recordingId: rec.id, type: "like" },
      ]);
    }, 12000);

    setTimeout(() => {
      setCommentCounts((prev) => ({ ...prev, [rec.id]: (prev[rec.id] ?? 0) + 1 }));
      setNotifications((prev) => [
        ...prev,
        { id: Date.now().toString() + "c", recordingId: rec.id, type: "comment" },
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
      commentCounts,
    }}>
      {children}
    </RecordingsContext.Provider>
  );
}

export function useRecordings() {
  return useContext(RecordingsContext);
}
