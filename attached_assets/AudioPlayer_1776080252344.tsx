import { useState, useEffect } from 'react';
import { Play, Pause, X, SkipBack, SkipForward, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  audio: {
    id: string;
    title: string;
    author: string;
    category: string;
    duration: string;
  };
  onClose: () => void;
}

export function AudioPlayer({ audio, onClose }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    // Parse duration from mm:ss format
    const [mins, secs] = audio.duration.split(':').map(Number);
    setDuration(mins * 60 + secs);
  }, [audio.duration]);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setCurrentTime((time) => {
        if (time >= duration) {
          setIsPlaying(false);
          return 0;
        }
        return time + 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-white border-t border-stone-100 px-6 py-5 shrink-0 shadow-2xl">
      {/* Now Playing Info */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shrink-0 shadow-md">
          <Volume2 className="w-6 h-6 text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm text-stone-900 truncate mb-1">{audio.title}</h4>
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span>{audio.author}</span>
            <span>·</span>
            <span>{audio.category}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors shrink-0"
        >
          <X className="w-5 h-5 text-stone-500" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="relative h-1.5 bg-stone-200 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-600 to-orange-600 transition-all shadow-sm"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-stone-600">{formatTime(currentTime)}</span>
          <span className="text-xs text-stone-500">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-8">
        <button className="w-9 h-9 flex items-center justify-center text-stone-500 hover:text-stone-700 transition-colors">
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 flex items-center justify-center text-white hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </button>

        <button className="w-9 h-9 flex items-center justify-center text-stone-500 hover:text-stone-700 transition-colors">
          <SkipForward className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
