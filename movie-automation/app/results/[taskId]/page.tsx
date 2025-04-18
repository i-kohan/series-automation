"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import {
  getAnalysisStatus,
  AnalysisResponse,
  Storyline,
} from "@/services/videoAnalysisService";

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

  return (
    <div className="container mx-auto py-8 px-4">
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
                  <p className="text-sm text-muted-foreground mt-1">
                    Длительность: {formatTime(storyline.duration)} | Начало:{" "}
                    {formatTime(storyline.start_time)} | Конец:{" "}
                    {formatTime(storyline.end_time)}
                  </p>
                </div>

                <h3 className="text-lg font-medium mb-3">
                  Сцены в сюжетной линии
                </h3>
                <div className="space-y-3">
                  {storyline.scenes.map((scene) => (
                    <div key={scene.id} className="border rounded-md p-3">
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-medium">{scene.id}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatTime(scene.duration)}
                        </div>
                      </div>
                      <div className="text-sm">
                        <div className="flex justify-between mb-1">
                          <span>Начало:</span>
                          <span>{formatTime(scene.start_time)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Конец:</span>
                          <span>{formatTime(scene.end_time)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline">Предпросмотр</Button>
              <Button>Экспортировать клип</Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
