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
