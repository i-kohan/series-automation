"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Clock, Play } from "lucide-react";
import {
  getAnalysisStatus,
  AnalysisResponse,
  Storyline,
  Scene,
} from "@/services/videoAnalysisService";
import VideoPlayer from "@/components/VideoPlayer";
import { usePlayer } from "@/hooks/usePlayer";

export default function ResultsPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const [analysisData, setAnalysisData] = useState<AnalysisResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Используем хук usePlayer для управления видеоплеером
  const {
    isPlaying,
    isMuted,
    isLoading: videoLoading,
    error: videoError,
    activeFragment,
    playerRef,
    volume,
    played,
    currentTime,
    displayCurrentTime,
    displayDuration,
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
  } = usePlayer();

  const router = useRouter();
  const { taskId } = use(params);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        const data = await getAnalysisStatus(taskId);
        setAnalysisData(data);

        if (data.status === "processing") {
          // Если анализ еще выполняется, перенаправляем на главную
          router.push("/");
        } else if (data.status === "error" || data.status === "not_found") {
          setError(data.message || "Не удалось получить результаты анализа");
        }
      } catch (err) {
        console.error(err);
        setError("Ошибка при загрузке результатов");
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [taskId, router]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Функция для воспроизведения сцены
  const playScene = (scene: Scene) => {
    if (!analysisData || !analysisData.result) return;

    // Формируем URL для доступа к видео с учетом имени файла
    const videoUrl = `/api/videos/${taskId}?filename=${encodeURIComponent(
      analysisData.result.video_filename
    )}`;

    // Проверяем корректность временных меток
    const sceneDuration = scene.end_time - scene.start_time;
    console.log(`Playing scene ${scene.id}:`, {
      start: scene.start_time,
      end: scene.end_time,
      duration: sceneDuration,
      formattedDuration: formatTime(sceneDuration),
    });

    // Валидация данных сцены
    if (scene.start_time >= scene.end_time) {
      console.error(
        `Invalid scene timing: start=${scene.start_time}, end=${scene.end_time}`
      );
      return;
    }

    if (scene.start_time < 0) {
      console.error(`Invalid scene start time: ${scene.start_time}`);
      return;
    }

    playFragment({
      videoUrl,
      title: `Сцена ${scene.id} (${formatTime(scene.start_time)} - ${formatTime(
        scene.end_time
      )})`,
      startTime: scene.start_time,
      endTime: scene.end_time,
    });
  };

  // Функция для воспроизведения сюжетной линии
  const playStoryline = (storyline: Storyline) => {
    if (!analysisData || !analysisData.result) return;

    // Формируем URL для доступа к видео с учетом имени файла
    const videoUrl = `/api/videos/${taskId}?filename=${encodeURIComponent(
      analysisData.result.video_filename
    )}`;

    playFragment({
      videoUrl,
      title: storyline.name,
      startTime: storyline.start_time,
      endTime: storyline.end_time,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p>Загрузка результатов...</p>
      </div>
    );
  }

  if (error || !analysisData || !analysisData.result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-destructive">Ошибка</h1>
          <p>{error || "Не удалось загрузить результаты анализа"}</p>
          <Button onClick={() => router.push("/")}>Вернуться на главную</Button>
        </div>
      </div>
    );
  }

  // Безопасно извлекаем result после проверки на null
  const { result } = analysisData;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Модальное окно с видеоплеером */}
      {activeFragment && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            <VideoPlayer
              videoUrl={activeFragment.videoUrl}
              title={activeFragment.title}
              isPlaying={isPlaying}
              isMuted={isMuted}
              isLoading={videoLoading}
              error={videoError}
              volume={volume}
              played={played}
              currentTime={currentTime}
              displayCurrentTime={displayCurrentTime}
              displayDuration={displayDuration}
              playerRef={playerRef}
              onClose={closePlayer}
              onPlay={togglePlay}
              onMute={toggleMute}
              onVolumeChange={handleVolumeChange}
              onSeekChange={handleSeekChange}
              onSeekMouseDown={handleSeekMouseDown}
              onSeekMouseUp={handleSeekMouseUp}
              onProgress={handleProgress}
              onDuration={handleDuration}
              onReady={handleReady}
              onError={handleError}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>
        </div>
      )}

      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Результаты анализа видео</h1>
          <p className="text-muted-foreground">
            {result.video_filename} (длительность: {formatTime(result.duration)}
            )
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/")}>
          Назад
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Общая информация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <div className="text-sm text-muted-foreground">Всего сцен</div>
              <div className="text-lg font-semibold">{result.total_scenes}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">
                Сюжетных линий
              </div>
              <div className="text-lg font-semibold">
                {result.storylines.length}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Время анализа</div>
              <div className="text-lg font-semibold">
                {result.metadata.analysis_time_seconds.toFixed(1)} сек
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-xl font-bold mb-4">Сюжетные линии</h2>

      <Tabs defaultValue={result.storylines[0]?.id || "storyline_1"}>
        <TabsList className="mb-4">
          {result.storylines.map((storyline: Storyline) => (
            <TabsTrigger key={storyline.id} value={storyline.id}>
              {storyline.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {result.storylines.map((storyline: Storyline) => (
          <TabsContent
            key={storyline.id}
            value={storyline.id}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle>{storyline.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <p>{storyline.description}</p>
                  <div className="flex items-center gap-6 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        Длительность: {formatTime(storyline.duration)}
                      </span>
                    </div>
                    <div>
                      Интервал: {formatTime(storyline.start_time)} -{" "}
                      {formatTime(storyline.end_time)}
                    </div>
                  </div>
                </div>

                <h3 className="text-lg font-medium mb-3">
                  Сцены в сюжетной линии
                </h3>
                <div className="space-y-2">
                  {storyline.scenes.map((scene: Scene) => (
                    <div
                      key={scene.id}
                      className="border rounded-md p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-full"
                            title="Воспроизвести сцену"
                            onClick={() => playScene(scene)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <div>
                            <div className="font-medium">{scene.id}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatTime(scene.start_time)} -{" "}
                              {formatTime(scene.end_time)}
                              <span className="ml-2">
                                ({formatTime(scene.duration)})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => playStoryline(storyline)}
              >
                Предпросмотр
              </Button>
              <Button>Экспортировать клип</Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
