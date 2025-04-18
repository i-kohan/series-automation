"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  getSampleVideos,
  startVideoAnalysis,
  getAnalysisStatus,
} from "@/services/videoAnalysisService";

export function VideoSelector() {
  const [videos, setVideos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [numStorylines, setNumStorylines] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const router = useRouter();

  // Загрузка списка доступных видео
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        const videoList = await getSampleVideos();
        setVideos(videoList);
        if (videoList.length > 0) {
          setSelectedVideo(videoList[0]);
        }
      } catch (err) {
        setError(
          "Не удалось загрузить список видео. Убедитесь, что сервер запущен."
        );
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  // Отслеживание прогресса анализа
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkStatus = async () => {
      if (!taskId) return;

      try {
        const status = await getAnalysisStatus(taskId);

        if (status.status === "completed") {
          setAnalyzing(false);
          setProgress(100);
          setStatusMessage("Анализ завершен успешно!");
          // Перенаправляем на страницу результатов
          router.push(`/results/${taskId}`);
        } else if (status.status === "error") {
          setAnalyzing(false);
          setError(status.message || "Произошла ошибка при анализе видео");
        } else if (status.status === "processing") {
          setProgress(status.progress ? status.progress * 100 : 0);
          setStatusMessage(status.message || "Обработка видео...");
        }
      } catch (err) {
        console.error(err);
        setError("Ошибка при получении статуса анализа");
        setAnalyzing(false);
      }
    };

    if (analyzing && taskId) {
      // Проверяем статус каждые 2 секунды
      intervalId = setInterval(checkStatus, 2000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [analyzing, taskId, router]);

  const handleAnalyze = async () => {
    if (!selectedVideo) return;

    try {
      setAnalyzing(true);
      setError(null);
      setProgress(0);
      setStatusMessage("Запуск анализа...");

      const response = await startVideoAnalysis(selectedVideo, numStorylines);
      setTaskId(response.task_id);
    } catch (err) {
      console.error(err);
      setError("Не удалось запустить анализ видео");
      setAnalyzing(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Анализ видео</CardTitle>
        <CardDescription>
          Выберите видео для анализа и создания клипов
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error && !analyzing && videos.length === 0 ? (
          <div className="text-center p-6 text-destructive">
            <p>{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Повторить
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="video-select">Доступные видео</Label>
              <Select
                disabled={analyzing}
                value={selectedVideo}
                onValueChange={setSelectedVideo}
              >
                <SelectTrigger id="video-select">
                  <SelectValue placeholder="Выберите видео" />
                </SelectTrigger>
                <SelectContent>
                  {videos.map((video) => (
                    <SelectItem key={video} value={video}>
                      {video}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storylines">Количество сюжетных линий</Label>
              <Input
                id="storylines"
                type="number"
                min={1}
                max={10}
                value={numStorylines}
                onChange={(e) =>
                  setNumStorylines(parseInt(e.target.value) || 3)
                }
                disabled={analyzing}
              />
              <p className="text-xs text-muted-foreground">
                Укажите желаемое количество сюжетных линий для выделения из
                видео
              </p>
            </div>

            {analyzing && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Прогресс анализа</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-center">{statusMessage}</p>
              </div>
            )}

            {error && !analyzing && (
              <div className="text-sm text-destructive text-center">
                {error}
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleAnalyze}
          className="w-full"
          disabled={!selectedVideo || analyzing || videos.length === 0}
        >
          {analyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Анализ видео...
            </>
          ) : (
            "Анализировать видео"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
