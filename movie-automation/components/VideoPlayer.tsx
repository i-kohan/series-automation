"use client";

import { Play, Pause, Volume2, VolumeX, X } from "lucide-react";
import ReactPlayer from "react-player";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/utils";
import { ProgressState, PlayerError } from "@/hooks/usePlayer";

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  isPlaying: boolean;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
  volume: number;
  played: number;
  displayCurrentTime: number;
  displayDuration: number;
  currentTime: number;
  onClose?: () => void;
  onPlay: () => void;
  onMute: () => void;
  playerRef: React.MutableRefObject<ReactPlayer | null>;
  onSeekMouseDown: () => void;
  onSeekChange: (value: number) => void;
  onSeekMouseUp: (value: number) => void;
  onVolumeChange: (value: number) => void;
  onProgress: (state: ProgressState) => void;
  onDuration: (duration: number) => void;
  onReady: () => void;
  onError: (error: PlayerError) => void;
  onTimeUpdate?: (currentSeconds: number) => void;
}

export default function VideoPlayer({
  videoUrl,
  title,
  isPlaying,
  isMuted,
  isLoading,
  error,
  volume,
  played,
  displayCurrentTime,
  displayDuration,
  currentTime,
  onClose,
  onPlay,
  onMute,
  playerRef,
  onSeekMouseDown,
  onSeekChange,
  onSeekMouseUp,
  onVolumeChange,
  onProgress,
  onDuration,
  onReady,
  onError,
  onTimeUpdate,
}: VideoPlayerProps) {
  // Форматируем время для отображения
  const formattedCurrentTime = formatTime(displayCurrentTime);
  const formattedDuration = formatTime(displayDuration);

  // Добавляем отладочную информацию об абсолютном времени
  const absoluteTime = formatTime(currentTime);

  return (
    <div className="relative overflow-hidden rounded-lg bg-black shadow-xl w-full max-w-4xl mx-auto">
      {/* Заголовок */}
      {title && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-20">
          <h3 className="text-white font-medium">
            {title}
            <span className="ml-2 text-xs text-white/80">
              Продолжительность: {formattedDuration} (Абс: {absoluteTime})
            </span>
          </h3>
        </div>
      )}

      {/* Кнопка закрытия */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-30 bg-black/50 rounded-full p-1 text-white hover:bg-black/70 transition-colors"
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Индикатор загрузки */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="animate-pulse text-white">Загрузка видео...</div>
        </div>
      )}

      {/* Сообщение об ошибке */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
          <div className="text-white bg-red-600/80 px-4 py-2 rounded-md">
            {error}
          </div>
        </div>
      )}

      {/* Видео элемент */}
      <div className="aspect-video bg-black" onClick={onPlay}>
        <ReactPlayer
          ref={playerRef}
          url={videoUrl}
          playing={isPlaying}
          volume={volume}
          muted={isMuted}
          width="100%"
          height="100%"
          onReady={onReady}
          onDuration={onDuration}
          onProgress={onProgress}
          onError={onError}
          progressInterval={100}
          playsinline
          onPlaybackRateChange={() => {}}
          onSeek={(seconds) => onTimeUpdate?.(seconds)}
          config={{
            file: {
              attributes: {
                crossOrigin: "anonymous",
                controlsList: "nodownload",
                disablePictureInPicture: true,
                playsInline: true,
              },
              forceVideo: true,
              forceAudio: true,
            },
          }}
        />
      </div>

      {/* Элементы управления */}
      <div className="bg-black/90 p-4 z-20 flex flex-col gap-2">
        {/* Слайдер прогресса */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white min-w-12 text-center">
            {formattedCurrentTime}
          </span>
          <Slider
            value={[played * 100]}
            min={0}
            max={100}
            step={0.01}
            className="flex-1 cursor-pointer"
            onValueChange={(value) => onSeekChange(value[0] / 100)}
            onValueCommit={(value) => onSeekMouseUp(value[0] / 100)}
            onPointerDown={onSeekMouseDown}
          />
          <span className="text-xs text-white min-w-12 text-center">
            {formattedDuration}
          </span>
        </div>

        {/* Кнопки управления */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Кнопка play/pause */}
            <button
              onClick={onPlay}
              className="bg-white/20 rounded-full p-2 flex items-center justify-center hover:bg-white/30 transition-colors"
              disabled={isLoading || !!error}
              aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 text-white" />
              ) : (
                <Play className="h-5 w-5 text-white" />
              )}
            </button>

            {/* Кнопка mute/unmute */}
            <button
              onClick={onMute}
              className="bg-white/20 rounded-full p-2 flex items-center justify-center hover:bg-white/30 transition-colors"
              disabled={isLoading || !!error}
              aria-label={isMuted ? "Включить звук" : "Выключить звук"}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5 text-white" />
              ) : (
                <Volume2 className="h-5 w-5 text-white" />
              )}
            </button>
          </div>

          {/* Слайдер громкости */}
          <div className="flex items-center gap-2 w-32">
            <Slider
              value={[volume * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={(value) => onVolumeChange(value[0] / 100)}
              aria-label="Громкость"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
