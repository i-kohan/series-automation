"use client";

import { useState, useRef } from "react";
import ReactPlayer from "react-player";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, VolumeX, X } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  startTime?: number;
  endTime?: number;
  title?: string;
  onClose?: () => void;
}

export default function VideoPlayer({
  videoUrl,
  startTime = 0,
  endTime,
  title,
  onClose,
}: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<ReactPlayer>(null);

  // Управление видео
  const handlePlayPause = () => {
    setPlaying(!playing);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setMuted(value[0] === 0);
  };

  const handleMuteToggle = () => {
    setMuted(!muted);
  };

  const handleProgress = (state: { played: number; playedSeconds: number }) => {
    setProgress(state.playedSeconds);

    // Если достигнут конец фрагмента, перематываем на начало
    if (endTime && state.playedSeconds >= endTime) {
      playerRef.current?.seekTo(startTime);
    }
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
  };

  const handleSliderChange = (value: number[]) => {
    if (playerRef.current) {
      playerRef.current.seekTo(value[0]);
      setProgress(value[0]);
    }
  };

  // Форматирование времени
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-card rounded-lg overflow-hidden shadow-lg">
      <div className="relative">
        <div className="aspect-video bg-black">
          <ReactPlayer
            ref={playerRef}
            url={videoUrl}
            playing={playing}
            volume={volume}
            muted={muted}
            width="100%"
            height="100%"
            onProgress={handleProgress}
            onDuration={handleDuration}
            progressInterval={100}
            config={{
              file: {
                attributes: {
                  controlsList: "nodownload",
                },
              },
            }}
          />
        </div>

        {onClose && (
          <Button
            onClick={onClose}
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 text-white bg-black/40 hover:bg-black/60"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="p-4">
        {title && <div className="font-medium mb-2">{title}</div>}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePlayPause}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
            >
              {playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            <Button
              onClick={handleMuteToggle}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>

            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs">{formatTime(progress)}</span>
              <div className="flex-1">
                <Slider
                  value={[progress]}
                  min={startTime}
                  max={endTime || duration}
                  step={0.1}
                  onValueChange={handleSliderChange}
                  className="cursor-pointer"
                />
              </div>
              <span className="text-xs">{formatTime(endTime || duration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pl-1">
            <Volume2 className="h-3 w-3 text-muted-foreground" />
            <div className="w-24">
              <Slider
                value={[volume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
