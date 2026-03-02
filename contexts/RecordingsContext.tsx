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
}

interface RecordingsContextValue {
  myRecordings: PublishedRecording[];
  addMyRecording: (rec: PublishedRecording) => void;
}

const RecordingsContext = createContext<RecordingsContextValue>({
  myRecordings: [],
  addMyRecording: () => {},
});

export function RecordingsProvider({ children }: { children: React.ReactNode }) {
  const [myRecordings, setMyRecordings] = useState<PublishedRecording[]>([]);

  const addMyRecording = useCallback((rec: PublishedRecording) => {
    setMyRecordings((prev) => [rec, ...prev]);
  }, []);

  return (
    <RecordingsContext.Provider value={{ myRecordings, addMyRecording }}>
      {children}
    </RecordingsContext.Provider>
  );
}

export function useRecordings() {
  return useContext(RecordingsContext);
}
