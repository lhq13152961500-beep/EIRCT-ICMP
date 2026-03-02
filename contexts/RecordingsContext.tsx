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

interface RecordingsContextValue {
  myRecordings: PublishedRecording[];
  addMyRecording: (rec: PublishedRecording) => void;
  newIds: string[];
  acknowledgeNew: () => void;
}

const RecordingsContext = createContext<RecordingsContextValue>({
  myRecordings: [],
  addMyRecording: () => {},
  newIds: [],
  acknowledgeNew: () => {},
});

export function RecordingsProvider({ children }: { children: React.ReactNode }) {
  const [myRecordings, setMyRecordings] = useState<PublishedRecording[]>([]);
  const [newIds, setNewIds] = useState<string[]>([]);

  const addMyRecording = useCallback((rec: PublishedRecording) => {
    setMyRecordings((prev) => [rec, ...prev]);
    setNewIds((prev) => [rec.id, ...prev]);
  }, []);

  const acknowledgeNew = useCallback(() => {
    setNewIds([]);
  }, []);

  return (
    <RecordingsContext.Provider value={{ myRecordings, addMyRecording, newIds, acknowledgeNew }}>
      {children}
    </RecordingsContext.Provider>
  );
}

export function useRecordings() {
  return useContext(RecordingsContext);
}
