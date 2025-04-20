import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AnalysisResult,
  Scene,
  Storyline,
} from "@/services/videoAnalysisService";
import { formatTime } from "@/lib/utils";

interface VideoDetailsDialogProps {
  analysisResult: AnalysisResult | undefined;
  isLoading?: boolean;
}

export function VideoDetailsDialog({
  analysisResult,
  isLoading = false,
}: VideoDetailsDialogProps) {
  const [open, setOpen] = useState(false);

  if (!analysisResult && !isLoading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Детали видео</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>
            {isLoading
              ? "Загрузка деталей видео..."
              : `Детали видео: ${analysisResult?.video_filename}`}
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Пожалуйста, подождите, идет загрузка информации."
              : `Общая длительность: ${formatTime(
                  analysisResult?.duration || 0
                )}, количество сцен: ${analysisResult?.total_scenes || 0}`}
          </DialogDescription>
        </DialogHeader>

        {!isLoading && analysisResult && (
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <h3 className="text-lg font-medium mb-2">Метаданные видео</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted rounded p-2">
                  <span className="font-medium">FPS:</span>{" "}
                  {analysisResult.metadata.fps}
                </div>
                <div className="bg-muted rounded p-2">
                  <span className="font-medium">Размер:</span>{" "}
                  {analysisResult.metadata.size[0]} x{" "}
                  {analysisResult.metadata.size[1]}
                </div>
                <div className="bg-muted rounded p-2">
                  <span className="font-medium">Время анализа:</span>{" "}
                  {analysisResult.metadata.analysis_time_seconds.toFixed(2)} сек
                </div>
                <div className="bg-muted rounded p-2">
                  <span className="font-medium">Дата анализа:</span>{" "}
                  {analysisResult.timestamp}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Сюжетные линии</h3>
              <div className="space-y-3">
                {analysisResult.storylines.map((storyline, index) => (
                  <StorylineCard
                    key={storyline.id}
                    storyline={storyline}
                    index={index}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StorylineCard({
  storyline,
  index,
}: {
  storyline: Storyline;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-3">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">
          Сюжетная линия {index + 1}: {storyline.name}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Свернуть" : "Развернуть"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{storyline.description}</p>
      <p className="text-sm mt-1">
        Продолжительность: {formatTime(storyline.duration)}, сцен:{" "}
        {storyline.scenes.length}
      </p>

      {expanded && (
        <div className="mt-3 space-y-2">
          <h5 className="text-sm font-medium">Сцены:</h5>
          <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
            {storyline.scenes.map((scene) => (
              <SceneCard key={scene.id} scene={scene} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SceneCard({ scene }: { scene: Scene }) {
  return (
    <div className="bg-muted/50 p-2 rounded text-sm">
      <div className="flex justify-between">
        <span>
          {formatTime(scene.start_time)} - {formatTime(scene.end_time)}
        </span>
        <span className="text-muted-foreground">
          {formatTime(scene.duration)}
        </span>
      </div>
      {scene.audio_analysis?.transcript && (
        <div className="mt-1 text-xs line-clamp-2">
          {scene.audio_analysis.transcript}
        </div>
      )}
    </div>
  );
}
