import json
import os
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.story_matcher_service import StoryMatcherService

# Инициализация логгера
logger = logging.getLogger(__name__)

# Создаем экземпляр сервиса
story_matcher_service = StoryMatcherService()

# Создаем роутер
router = APIRouter(
    prefix="/api/story-matcher",
    tags=["story-matcher"],
    responses={404: {"description": "Not found"}},
)

# Модели данных для запросов/ответов
class StoryMatchRequest(BaseModel):
    video_name: str = "360"  # Имя видео для загрузки описаний
    stories: List[str]  # Список сюжетов для сравнения
    max_scenes: Optional[int] = None  # Максимальное количество сцен для обработки

class StoryMatchResponse(BaseModel):
    status: str
    message: str
    matches: Dict[str, Dict[str, float]] = {}  # {scene_id: {story: score}}

def get_data_root() -> str:
    """
    Возвращает корневую директорию для данных
    """
    docker_path = "/app/shared-data"
    if os.path.exists(docker_path):
        return docker_path
    return "../shared-data"

def load_scene_descriptions(video_name: str, max_scenes: Optional[int] = None) -> Dict[str, str]:
    """
    Загружает описания сцен из JSON файла
    
    Args:
        video_name: Имя видео для загрузки описаний
        max_scenes: Максимальное количество сцен для загрузки
        
    Returns:
        Dict[str, str]: Словарь {scene_id: description}
    """
    try:
        data_root = get_data_root()
        file_path = os.path.join(data_root, "scenes-with-summary", f"{video_name}.json")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            scenes = json.load(f)
            
        # Создаем словарь {scene_id: description}
        descriptions = {scene['id']: scene['description'] for scene in scenes}
        
        # Ограничиваем количество сцен, если указано
        if max_scenes and max_scenes < len(descriptions):
            logger.info(f"Ограничение количества сцен до {max_scenes} (всего сцен: {len(descriptions)})")
            # Берем первые max_scenes сцен
            descriptions = dict(list(descriptions.items())[:max_scenes])
            
        return descriptions
        
    except Exception as e:
        logger.error(f"Ошибка при загрузке описаний сцен: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке описаний сцен: {str(e)}")

@router.post("/match", response_model=StoryMatchResponse)
async def match_stories(request: StoryMatchRequest):
    """
    Сравнивает описания сцен с заданными сюжетами
    """
    try:
        logger.info(f"Начало сравнения сюжетов для видео {request.video_name}")
        
        # Загружаем описания
        scene_descriptions = load_scene_descriptions(request.video_name, request.max_scenes)
        
        if not scene_descriptions:
            return {
                "status": "warning",
                "message": "Не найдено описаний сцен для обработки",
                "matches": {}
            }
        
        # Сравниваем каждую сцену с каждым сюжетом
        matches = {}
        for scene_id, description in scene_descriptions.items():
            scene_matches = {}
            for story in request.stories:
                score = story_matcher_service.calculate_similarity(description, story)
                scene_matches[story] = score
            matches[scene_id] = scene_matches
        
        logger.info(f"Сравнение сюжетов успешно завершено для {len(matches)} сцен")
        
        return {
            "status": "success",
            "message": f"Сравнение сюжетов выполнено для {len(matches)} сцен",
            "matches": matches
        }
        
    except Exception as e:
        logger.error(f"Ошибка при сравнении сюжетов: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при сравнении сюжетов: {str(e)}")

# Пример curl команды:
# curl -X POST "http://localhost:8000/api/story-matcher/match" -H "Content-Type: application/json" -d '{"video_name": "360", "stories": ["История про врача", "История про пациента"], "max_scenes": 5}' 