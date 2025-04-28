import os
import logging
import json
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.services.frame_analyzer import FrameAnalyzer

router = APIRouter(
    prefix="/api/frame-analyzer",
    tags=["frame-analyzer"],
    responses={404: {"description": "Not found"}}
)

logger = logging.getLogger(__name__)

class FrameAnalysisRequest(BaseModel):
    """Запрос на анализ кадров видео"""
    filename: str
    task_id: Optional[str] = None

class FrameAnalysisResponse(BaseModel):
    """Ответ на запрос анализа кадров"""
    status: str
    message: str
    task_id: str
    scenes_processed: int = 0
    frames_analyzed: int = 0

class FrameAnalysisResultResponse(BaseModel):
    """Ответ с результатами анализа кадров"""
    task_id: str
    status: str
    message: str
    scenes_processed: int = 0
    frames_analyzed: int = 0
    results: Optional[List[Dict[str, Any]]] = None

def get_data_root() -> str:
    """
    Возвращает корневую директорию для данных, учитывая разницу
    между локальной разработкой и Docker окружением
    """
    # Проверяем, есть ли путь в Docker
    docker_path = "/app/shared-data"
    if os.path.exists(docker_path):
        return docker_path
    
    # Возвращаем относительный путь для локальной разработки
    return "../shared-data"

def load_scenes() -> List[Dict[str, Any]]:
    """Загружает сцены из файла сцен с аудио"""
    try:
        data_root = get_data_root()
        scenes_path = os.path.join(data_root, "scenes-with-audio/scenes.json")
        
        if not os.path.exists(scenes_path):
            logger.error(f"Файл сцен не найден: {scenes_path}")
            return []
            
        with open(scenes_path, "r", encoding="utf-8") as f:
            scenes_data = json.load(f)
            
        logger.info(f"Загружено {len(scenes_data)} сцен из {scenes_path}")
        return scenes_data
    except Exception as e:
        logger.error(f"Ошибка при загрузке сцен: {str(e)}")
        return []

def save_scenes_with_frames(scenes_with_frames: List[Dict[str, Any]], task_id: str) -> None:
    """Сохраняет сцены с результатами анализа кадров в файл"""
    try:
        data_root = get_data_root()
        output_dir = os.path.join(data_root, "scenes-with-frames")
        os.makedirs(output_dir, exist_ok=True)
        
        output_path = os.path.join(output_dir, f"{task_id}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(scenes_with_frames, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Сохранены результаты анализа кадров в {output_path}")
    except Exception as e:
        logger.error(f"Ошибка при сохранении результатов анализа кадров: {str(e)}")

@router.post("/analyze-frames", response_model=FrameAnalysisResponse)
async def analyze_frames(
    request: FrameAnalysisRequest,
    background_tasks: BackgroundTasks
) -> FrameAnalysisResponse:
    """
    Анализирует кадры для всех сцен видео и создает их эмбеддинги.
    
    Args:
        request: Данные запроса содержащие имя файла и опционально task_id
    
    Returns:
        Информация о статусе запуска анализа
    """
    # Проверяем наличие видеофайла
    video_filename = request.filename
    data_root = get_data_root()
    video_path = os.path.join(data_root, "sample-videos", video_filename)
    
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail=f"Видеофайл не найден: {video_filename}")
    
    # Загружаем сцены
    scenes = load_scenes()
    if not scenes:
        raise HTTPException(status_code=404, detail="Сцены не найдены. Сначала необходимо выполнить анализ видео.")
    
    # Генерируем task_id если он не был предоставлен
    task_id = request.task_id or f"frames_{os.path.splitext(video_filename)[0]}"
    
    # Запускаем анализ кадров в фоновом режиме
    background_tasks.add_task(
        run_frame_analysis,
        video_path=video_path,
        scenes=scenes,
        task_id=task_id
    )
    
    return FrameAnalysisResponse(
        status="processing",
        message=f"Анализ кадров для {len(scenes)} сцен запущен в фоновом режиме",
        task_id=task_id,
        scenes_processed=0,
        frames_analyzed=0
    )

def run_frame_analysis(
    video_path: str,
    scenes: List[Dict[str, Any]],
    task_id: str
) -> None:
    """
    Выполняет анализ кадров для всех сцен.
    
    Args:
        video_path: Путь к видеофайлу
        scenes: Список сцен для анализа
        task_id: Идентификатор задачи
    """
    try:
        # Создаем анализатор кадров
        frame_analyzer = FrameAnalyzer()
        scenes_with_frames = []
        total_frames_analyzed = 0
        
        logger.info(f"Запуск анализа кадров для {len(scenes)} сцен из видео {os.path.basename(video_path)}")
        
        # Обрабатываем каждую сцену
        for i, scene in enumerate(scenes):
            try:
                scene_id = scene.get('id', f'scene_{i+1}')
                logger.info(f"Анализ кадров для сцены {scene_id} ({i+1}/{len(scenes)})")
                
                # Извлекаем временные границы сцены
                start_time = scene.get('start_time', 0)
                end_time = scene.get('end_time', 0)
                
                # Анализируем кадры сцены
                frame_analysis_result = frame_analyzer.analyze_scene_frames(
                    video_path=video_path,
                    start_time=start_time,
                    end_time=end_time,
                    task_id=task_id,
                    scene_id=scene_id
                )
                
                # Добавляем результаты анализа к сцене
                scene_with_frames = scene.copy()
                scene_with_frames['frame_analysis'] = frame_analysis_result
                scenes_with_frames.append(scene_with_frames)
                
                # Считаем общее количество проанализированных кадров
                total_frames_analyzed += frame_analysis_result.get('num_frames', 0)
                
                logger.info(f"Завершен анализ кадров для сцены {scene_id}: создано {frame_analysis_result.get('num_frames', 0)} эмбеддингов")
                
            except Exception as e:
                logger.error(f"Ошибка при анализе кадров сцены {i+1}: {str(e)}")
                # При ошибке добавляем исходную сцену без анализа кадров
                scenes_with_frames.append(scene)
        
        # Сохраняем результаты
        logger.info(f"Анализ кадров завершен: обработано {len(scenes_with_frames)} сцен, {total_frames_analyzed} кадров")
        save_scenes_with_frames(scenes_with_frames, task_id)
        
    except Exception as e:
        logger.error(f"Ошибка при анализе кадров: {str(e)}")

@router.get("/results/{task_id}", response_model=FrameAnalysisResultResponse)
async def get_frame_analysis_results(task_id: str) -> FrameAnalysisResultResponse:
    """
    Получает результаты анализа кадров по task_id.
    
    Args:
        task_id: Идентификатор задачи анализа кадров
        
    Returns:
        Результаты анализа кадров для всех сцен
    """
    try:
        # Проверяем наличие файла с результатами
        data_root = get_data_root()
        results_path = os.path.join(data_root, "scenes-with-frames", f"{task_id}.json")
        
        if not os.path.exists(results_path):
            raise HTTPException(
                status_code=404, 
                detail=f"Результаты анализа кадров для задачи {task_id} не найдены"
            )
        
        # Загружаем результаты
        with open(results_path, "r", encoding="utf-8") as f:
            results = json.load(f)
        
        # Подсчет количества проанализированных кадров
        frames_analyzed = 0
        for scene in results:
            if "frame_analysis" in scene and scene["frame_analysis"]:
                frames_analyzed += scene["frame_analysis"].get("num_frames", 0)
        
        return FrameAnalysisResultResponse(
            task_id=task_id,
            status="completed",
            message=f"Результаты анализа кадров для задачи {task_id}",
            scenes_processed=len(results),
            frames_analyzed=frames_analyzed,
            results=results
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении результатов анализа кадров: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при получении результатов анализа кадров: {str(e)}"
        )

@router.get("/jobs", response_model=List[Dict[str, Any]])
async def list_frame_analysis_jobs() -> List[Dict[str, Any]]:
    """
    Получает список всех заданий анализа кадров.
    
    Returns:
        Список заданий с информацией о количестве сцен и кадров
    """
    try:
        data_root = get_data_root()
        results_dir = os.path.join(data_root, "scenes-with-frames")
        
        if not os.path.exists(results_dir):
            return []
        
        # Список всех файлов в директории результатов
        result_files = [f for f in os.listdir(results_dir) if f.endswith('.json')]
        
        jobs = []
        for filename in result_files:
            try:
                task_id = os.path.splitext(filename)[0]
                file_path = os.path.join(results_dir, filename)
                
                # Получаем информацию о файле
                file_stat = os.stat(file_path)
                
                # Загружаем результаты
                with open(file_path, "r", encoding="utf-8") as f:
                    results = json.load(f)
                
                # Подсчет количества проанализированных кадров
                frames_analyzed = 0
                for scene in results:
                    if "frame_analysis" in scene and scene["frame_analysis"]:
                        frames_analyzed += scene["frame_analysis"].get("num_frames", 0)
                
                jobs.append({
                    "task_id": task_id,
                    "status": "completed",
                    "scenes_processed": len(results),
                    "frames_analyzed": frames_analyzed,
                    "file_size_bytes": file_stat.st_size,
                    "created_at": file_stat.st_ctime,
                    "modified_at": file_stat.st_mtime
                })
                
            except Exception as e:
                logger.error(f"Ошибка при обработке файла {filename}: {str(e)}")
                continue
        
        # Сортируем задания по времени создания (новые вначале)
        jobs.sort(key=lambda x: x["modified_at"], reverse=True)
        
        return jobs
        
    except Exception as e:
        logger.error(f"Ошибка при получении списка заданий анализа кадров: {str(e)}")
        return [] 