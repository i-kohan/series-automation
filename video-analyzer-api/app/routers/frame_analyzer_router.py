import os
import logging
import json
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
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

class FrameAnalysisResponse(BaseModel):
    """Ответ на запрос анализа кадров"""
    status: str
    message: str
    output_file: str
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

def save_scenes_with_frames(scenes_with_frames: List[Dict[str, Any]], output_filename: str) -> str:
    """
    Сохраняет сцены с результатами анализа кадров в файл
    
    Args:
        scenes_with_frames: Список сцен с результатами анализа
        output_filename: Имя выходного файла без расширения
        
    Returns:
        Путь к сохраненному файлу
    """
    try:
        data_root = get_data_root()
        output_dir = os.path.join(data_root, "scenes-with-frames")
        os.makedirs(output_dir, exist_ok=True)
        
        output_path = os.path.join(output_dir, f"{output_filename}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(scenes_with_frames, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Сохранены результаты анализа кадров в {output_path}")
        return output_path
    except Exception as e:
        logger.error(f"Ошибка при сохранении результатов анализа кадров: {str(e)}")
        return ""

@router.post("/analyze-frames", response_model=FrameAnalysisResponse)
async def analyze_frames(request: FrameAnalysisRequest) -> FrameAnalysisResponse:
    """
    Анализирует кадры для всех сцен видео и создает их эмбеддинги.
    
    Args:
        request: Данные запроса содержащие имя файла
    
    Returns:
        Информация о результатах анализа с данными по всем сценам
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
    
    try:
        # Создаем анализатор кадров
        frame_analyzer = FrameAnalyzer()
        scenes_with_frames = []
        total_frames_analyzed = 0
        
        # Формируем имя выходного файла и директорию для кадров на основе имени видео
        base_output_name = os.path.splitext(video_filename)[0]
        output_filename = f"frames_{base_output_name}"

        logger.info(f"Запуск анализа кадров для {len(scenes)} сцен из видео {os.path.basename(video_path)}")
        
        # Обрабатываем каждую сцену
        for i, scene in enumerate(scenes):
            try:
                scene_id = scene.get('id', f'scene_{i+1}')
                logger.info(f"Анализ кадров для сцены {scene_id} ({i+1}/{len(scenes)})")
                
                # Извлекаем временные границы сцены
                start_time = scene.get('start_time', 0)
                end_time = scene.get('end_time', 0)
                
                # Анализируем кадры сцены, передавая ID сцены и директорию для сохранения
                frame_analysis_result = frame_analyzer.analyze({
                    'video_path': video_path,
                    'start_time': start_time,
                    'end_time': end_time,
                    'scene_id': scene_id,
                })
                
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
        
        # Сохраняем JSON с результатами анализа
        output_path = save_scenes_with_frames(scenes_with_frames, output_filename)
        
        # Формируем и возвращаем ответ
        return FrameAnalysisResponse(
            status="success",
            message=f"Успешно проанализировано {len(scenes_with_frames)} сцен, {total_frames_analyzed} кадров",
            output_file=output_path,
            scenes_processed=len(scenes_with_frames),
            frames_analyzed=total_frames_analyzed,
            results=scenes_with_frames
        )
        
    except Exception as e:
        logger.error(f"Ошибка при анализе кадров: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при анализе кадров: {str(e)}"
        )

# Пример использования API с помощью curl:
# curl -X POST "http://localhost:8000/api/frame-analyzer/analyze-frames" \
#   -H "Content-Type: application/json" \
#   -d '{"filename": "example.mp4"}' 