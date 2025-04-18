"use client";

import { useState, useEffect, use } from "react";
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

// Интерфейс для выбранного фрагмента видео
interface VideoFragment {
  type: "scene" | "storyline";
  title: string;
  startTime: number;
  endTime: number;
}

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
  const [videoFragment, setVideoFragment] = useState<VideoFragment | null>(
    null
  );
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
    setVideoFragment({
      type: "scene",
      title: `Сцена ${scene.id}`,
      startTime: scene.start_time,
      endTime: scene.end_time,
    });
  };

  // Функция для воспроизведения сюжетной линии
  const playStoryline = (storyline: Storyline) => {
    setVideoFragment({
      type: "storyline",
      title: storyline.name,
      startTime: storyline.start_time,
      endTime: storyline.end_time,
    });
  };

  // Закрыть видеоплеер
  const closePlayer = () => {
    setVideoFragment(null);
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

  const { result } = analysisData;
  const videoUrl = `/api/videos/${taskId}`; // Предполагаем такой эндпоинт для доступа к видео

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Модальное окно с видеоплеером */}
      {videoFragment && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            <VideoPlayer
              videoUrl={videoUrl}
              startTime={videoFragment.startTime}
              endTime={videoFragment.endTime}
              title={videoFragment.title}
              onClose={closePlayer}
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
          {result.storylines.map((storyline) => (
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
                  {storyline.scenes.map((scene) => (
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
