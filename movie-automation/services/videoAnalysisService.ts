/**
 * Сервис для взаимодействия с Python API для анализа видео
 */

const API_URL = "http://localhost:8000";

/**
 * Получение списка доступных видео
 */
export async function getSampleVideos() {
  try {
    const response = await fetch(`${API_URL}/api/sample-videos`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data.videos;
  } catch (error) {
    console.error("Error fetching sample videos:", error);
    throw error;
  }
}

/**
 * Запуск анализа видео
 * @param filename Имя файла видео
 * @param numStorylines Желаемое количество сюжетных линий
 */
export async function startVideoAnalysis(
  filename: string,
  numStorylines: number = 3
) {
  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename,
        num_storylines: numStorylines,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error starting video analysis:", error);
    throw error;
  }
}

/**
 * Получение статуса или результатов анализа
 * @param taskId ID задачи анализа
 */
export async function getAnalysisStatus(taskId: string) {
  try {
    const response = await fetch(`${API_URL}/api/analysis/${taskId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching analysis status:", error);
    throw error;
  }
}

/**
 * Интерфейс для сцены
 */
export interface Scene {
  id: string;
  start_time: number;
  end_time: number;
  duration: number;
  start_frame: number;
  end_frame: number;
}

/**
 * Интерфейс для сюжетной линии
 */
export interface Storyline {
  id: string;
  name: string;
  description: string;
  scenes: Scene[];
  duration: number;
  start_time: number;
  end_time: number;
}

/**
 * Интерфейс для результатов анализа
 */
export interface AnalysisResult {
  video_filename: string;
  duration: number;
  total_scenes: number;
  storylines: Storyline[];
  timestamp: string;
  metadata: {
    fps: number;
    size: [number, number];
    analysis_time_seconds: number;
  };
}

/**
 * Формат ответа сервера для результатов анализа
 */
export interface AnalysisResponse {
  status: "completed" | "processing" | "error" | "not_found";
  task_id: string;
  message?: string;
  progress?: number;
  result?: AnalysisResult;
}
