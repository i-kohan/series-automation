"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactPlayer from "react-player";

// Типы для фрагмента видео
export interface VideoFragment {
  videoUrl: string;
  title?: string;
  startTime?: number;
  endTime?: number;
}

// Типы для ошибки плеера
export interface PlayerError {
  message: string;
  code?: string;
  [key: string]: unknown;
}

// Типы для состояния прогресса
export interface ProgressState {
  played: number;
  playedSeconds: number;
  loaded: number;
  loadedSeconds: number;
}

// Типы для возвращаемого значения хука
export interface UsePlayerReturn {
  // Состояния
  isPlaying: boolean;
  isMuted: boolean;
  isLoading: boolean;
  error: string | null;
  activeFragment: VideoFragment | null;
  volume: number;
  played: number;
  duration: number;
  seeking: boolean;
  currentTime: number;
  displayCurrentTime: number;
  displayDuration: number;

  // Реф - используем тип MutableRefObject, чтобы обойти ошибку с RefObject
  playerRef: React.MutableRefObject<ReactPlayer | null>;

  // Действия
  playFragment: (fragment: VideoFragment) => void;
  closePlayer: () => void;
  togglePlay: () => void;
  toggleMute: () => void;
  handleVolumeChange: (newVolume: number) => void;
  handleSeekChange: (newPosition: number) => void;
  handleSeekMouseDown: () => void;
  handleSeekMouseUp: (newPosition: number) => void;
  handleProgress: (state: ProgressState) => void;
  handleDuration: (duration: number) => void;
  handleReady: () => void;
  handleError: (error: PlayerError) => void;
  handleTimeUpdate: (currentSeconds: number) => void;
}

export function usePlayer(): UsePlayerReturn {
  // Состояния
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFragment, setActiveFragment] = useState<VideoFragment | null>(
    null
  );
  const [volume, setVolume] = useState(0.8);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [readyToPlay, setReadyToPlay] = useState(false);

  // Ссылка на плеер
  const playerRef = useRef<ReactPlayer | null>(null);

  // Вычисляемые значения для времени относительно фрагмента
  const displayCurrentTime = activeFragment?.startTime
    ? Math.max(0, currentTime - (activeFragment.startTime || 0))
    : currentTime;

  const displayDuration =
    activeFragment?.startTime !== undefined &&
    activeFragment?.endTime !== undefined
      ? activeFragment.endTime - activeFragment.startTime
      : duration;

  // Эффект для управления воспроизведением
  useEffect(() => {
    // Очистка при размонтировании
    return () => {
      if (playerRef.current) {
        setIsPlaying(false);
      }
    };
  }, []);

  // Эффект для установки начального времени при загрузке фрагмента
  useEffect(() => {
    if (activeFragment && readyToPlay && playerRef.current) {
      const startTime = activeFragment.startTime || 0;

      // Сбрасываем состояние, чтобы можно было переиспользовать уже загруженный фрагмент
      setHasInitialized(false);

      // Устанавливаем начальную позицию воспроизведения
      playerRef.current.seekTo(startTime, "seconds");

      // Явно устанавливаем текущее время для обновления интерфейса
      setCurrentTime(startTime);

      // Устанавливаем длительность для фрагмента, если она определена
      if (
        activeFragment.startTime !== undefined &&
        activeFragment.endTime !== undefined
      ) {
        const fragmentDuration =
          activeFragment.endTime - activeFragment.startTime;
        console.log(
          `Fragment duration: ${fragmentDuration}s (${activeFragment.startTime}s - ${activeFragment.endTime}s)`
        );
      }

      // Небольшая задержка перед началом воспроизведения, чтобы видео успело прогрузиться
      setTimeout(() => {
        setIsPlaying(true);
      }, 300);
    }
  }, [activeFragment, readyToPlay]);

  // Эффект для контроля окончания воспроизведения фрагмента
  useEffect(() => {
    if (
      activeFragment?.endTime &&
      currentTime >= activeFragment.endTime &&
      isPlaying
    ) {
      setIsPlaying(false);
    }
  }, [activeFragment, currentTime, isPlaying]);

  // Обработчик готовности плеера
  const handleReady = useCallback(() => {
    setIsLoading(false);
    setReadyToPlay(true);

    if (activeFragment?.startTime && playerRef.current && !hasInitialized) {
      // Устанавливаем начальное время при первой загрузке
      playerRef.current.seekTo(activeFragment.startTime);
      setCurrentTime(activeFragment.startTime);

      // Для гарантии установки правильной позиции
      setTimeout(() => {
        if (playerRef.current && activeFragment.startTime !== undefined) {
          playerRef.current.seekTo(activeFragment.startTime);
          console.log(
            "Enforcing initial position at:",
            activeFragment.startTime
          );
        }
      }, 500);

      setHasInitialized(true);
    }
  }, [activeFragment, hasInitialized]);

  // Обработчик ошибки
  const handleError = useCallback((error: PlayerError) => {
    console.error("Ошибка воспроизведения:", error);
    setError("Произошла ошибка при воспроизведении видео");
    setIsLoading(false);
    setReadyToPlay(false);
  }, []);

  // Обработчик прогресса воспроизведения
  const handleProgress = useCallback(
    (state: ProgressState) => {
      // Обновляем текущее время воспроизведения
      setCurrentTime(state.playedSeconds);

      // Проверяем, находится ли текущее время в пределах фрагмента
      if (
        activeFragment?.startTime !== undefined &&
        activeFragment?.endTime !== undefined
      ) {
        // Если текущее время меньше начального времени фрагмента,
        // перемотаем на начало фрагмента
        if (state.playedSeconds < activeFragment.startTime) {
          if (playerRef.current) {
            console.log(
              `Seeking to fragment start: ${activeFragment.startTime}s (current: ${state.playedSeconds}s)`
            );
            playerRef.current.seekTo(activeFragment.startTime, "seconds");
          }
          return;
        }

        // Если текущее время больше конечного времени фрагмента,
        // останавливаем воспроизведение
        if (state.playedSeconds > activeFragment.endTime && isPlaying) {
          console.log(
            `Reached fragment end: ${activeFragment.endTime}s (current: ${state.playedSeconds}s)`
          );
          setIsPlaying(false);
          return;
        }
      }

      // Если не в режиме перемотки, обновляем прогресс
      if (!seeking) {
        // Высчитываем относительное значение прогресса для фрагмента
        if (
          activeFragment?.startTime !== undefined &&
          activeFragment?.endTime !== undefined
        ) {
          const fragmentDuration =
            activeFragment.endTime - activeFragment.startTime;
          const fragmentPlayed =
            (state.playedSeconds - activeFragment.startTime) / fragmentDuration;

          // Устанавливаем значение в диапазоне [0, 1]
          const boundedPlayed = Math.max(0, Math.min(1, fragmentPlayed));
          setPlayed(boundedPlayed);
        } else {
          setPlayed(state.played);
        }
      }
    },
    [seeking, activeFragment, playerRef, isPlaying]
  );

  // Обработчик длительности видео
  const handleDuration = useCallback((duration: number) => {
    setDuration(duration);
  }, []);

  // Функции для слайдера
  const handleSeekMouseDown = useCallback(() => {
    setSeeking(true);
  }, []);

  const handleSeekChange = useCallback((newPosition: number) => {
    setPlayed(newPosition);
  }, []);

  const handleSeekMouseUp = useCallback(
    (newPosition: number) => {
      setSeeking(false);

      if (playerRef.current && activeFragment) {
        // Вычисляем абсолютное время для перемотки с учетом фрагмента
        let seekTime = newPosition;

        if (
          activeFragment.startTime !== undefined &&
          activeFragment.endTime !== undefined
        ) {
          const fragmentDuration =
            activeFragment.endTime - activeFragment.startTime;
          seekTime = activeFragment.startTime + fragmentDuration * newPosition;
        } else {
          seekTime = duration * newPosition;
        }

        playerRef.current.seekTo(seekTime, "seconds");
      }
    },
    [activeFragment, duration]
  );

  // Функция изменения громкости
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  // Функция переключения воспроизведения
  const togglePlay = useCallback(() => {
    if (activeFragment?.endTime && currentTime >= activeFragment.endTime) {
      // Если достигли конца фрагмента, начинаем с начала
      if (playerRef.current && activeFragment.startTime !== undefined) {
        playerRef.current.seekTo(activeFragment.startTime, "seconds");
        setCurrentTime(activeFragment.startTime);
      }
    }

    setIsPlaying((prev) => !prev);
  }, [activeFragment, currentTime, playerRef]);

  // Функция переключения звука
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  // Функция для воспроизведения конкретного фрагмента
  const playFragment = useCallback((fragment: VideoFragment) => {
    // Останавливаем воспроизведение перед сменой фрагмента
    setIsPlaying(false);

    // Меняем фрагмент
    setActiveFragment(fragment);
    setIsLoading(true);
    setError(null);
    setReadyToPlay(false);
    setHasInitialized(false);

    // Сбрасываем состояние прогресса
    setPlayed(0);
    setCurrentTime(fragment.startTime || 0);
  }, []);

  // Функция закрытия плеера
  const closePlayer = useCallback(() => {
    // Останавливаем воспроизведение перед закрытием
    setIsPlaying(false);

    // Сбрасываем все состояния
    setActiveFragment(null);
    setError(null);
    setIsLoading(false);
    setPlayed(0);
    setCurrentTime(0);
    setReadyToPlay(false);
    setHasInitialized(false);
  }, []);

  // Добавляем обработчик для события timeUpdate
  const handleTimeUpdate = useCallback(
    (currentSeconds: number) => {
      if (
        activeFragment?.startTime !== undefined &&
        activeFragment?.endTime !== undefined
      ) {
        // Если текущее время вышло за пределы фрагмента (в начале)
        if (currentSeconds < activeFragment.startTime) {
          if (playerRef.current) {
            console.log(
              `TimeUpdate: Enforcing start time ${activeFragment.startTime}s`
            );
            playerRef.current.seekTo(activeFragment.startTime, "seconds");
            setCurrentTime(activeFragment.startTime);
          }
        }

        // Если текущее время вышло за пределы фрагмента (в конце)
        if (currentSeconds > activeFragment.endTime && isPlaying) {
          console.log(
            `TimeUpdate: Reached end time ${activeFragment.endTime}s`
          );
          setIsPlaying(false);
        }
      }
    },
    [activeFragment, isPlaying, playerRef]
  );

  return {
    // Состояния
    isPlaying,
    isMuted,
    isLoading,
    error,
    activeFragment,
    volume,
    played,
    duration,
    seeking,
    currentTime,
    displayCurrentTime,
    displayDuration,

    // Реф
    playerRef,

    // Действия
    playFragment,
    closePlayer,
    togglePlay,
    toggleMute,
    handleVolumeChange,
    handleSeekChange,
    handleSeekMouseDown,
    handleSeekMouseUp,
    handleProgress,
    handleDuration,
    handleReady,
    handleError,
    handleTimeUpdate,
  };
}
