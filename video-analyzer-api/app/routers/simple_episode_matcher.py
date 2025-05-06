import json
import os
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.services.simple_storyline_matcher import SimpleStorylineMatcher

# Инициализация логгера
logger = logging.getLogger(__name__)

# Создаем роутер
router = APIRouter(
    prefix="/api/simple-episode-matcher",
    tags=["simple-episode-matcher"],
    responses={404: {"description": "Not found"}},
)

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


def load_episode(episode_id: str) -> Dict[str, Any]:
    """Загружает данные эпизода из файла"""
    try:
        data_root = get_data_root()
        episodes_path = os.path.join(data_root, "series/episodes.json")
        with open(episodes_path, "r", encoding="utf-8") as f:
            episodes_data = json.load(f)
        
        # Находим нужный эпизод по ID
        for episode in episodes_data:
            if episode["id"] == episode_id:
                return episode
        
        raise HTTPException(status_code=404, detail=f"Эпизод с ID {episode_id} не найден")
    except Exception as e:
        logger.error(f"Ошибка при загрузке эпизода: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке эпизода: {str(e)}")


def load_scenes() -> List[Dict[str, Any]]:
    """Загружает сцены из правильного файла"""
    try:
        data_root = get_data_root()
        scenes_path = os.path.join(data_root, "scenes-with-frames/frames_360.json")
        with open(scenes_path, "r", encoding="utf-8") as f:
            scenes_data = json.load(f)
        return scenes_data
    except Exception as e:
        logger.error(f"Ошибка при загрузке сцен: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке сцен: {str(e)}")


def create_storylines_from_plotlines(episode: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Создает объекты UserStoryline из сюжетных линий эпизода без использования персонажей.
    """
    storylines = []
    for plotline in episode.get("plotLines", []):
        storylines.append({
            "id": plotline["id"],
            "title": plotline["title"],
            "description": plotline["description"],
            "keywords": plotline.get("keywords", [])
        })
    return storylines


@router.get("/match-episode/{episode_id}")
async def match_episode_to_scenes(episode_id: str) -> Dict[str, Any]:
    """
    Сопоставляет сюжетные линии эпизода с имеющимися сценами
    и возвращает результат
    """
    try:
        # Загружаем данные эпизода
        episode = load_episode(episode_id)
        
        # Загружаем сцены
        scenes = load_scenes()
        
        # Создаем сюжетные линии из plotLines эпизода
        storylines = create_storylines_from_plotlines(episode)
        
        # Создаем экземпляр упрощенного сервиса сопоставления сцен с сюжетами
        matcher = SimpleStorylineMatcher()
        
        # Выполняем сопоставление
        results = matcher.match_scenes_to_plots(scenes=scenes[:40], plots=storylines)
        
        # Формируем результат
        match_result = {
            "episode_id": episode_id,
            "episode_title": episode["title"],
            "matched_at": datetime.now().isoformat(),
            "results": results
        }
        
        # Сохраняем результат в файл
        data_root = get_data_root()
        result_dir = os.path.join(data_root, "results/simple-episode-matches")
        os.makedirs(result_dir, exist_ok=True)
        result_path = os.path.join(result_dir, f"{episode_id}.json")
        with open(result_path, "w", encoding="utf-8") as f:
            json.dump(match_result, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Сопоставление для эпизода {episode_id} выполнено успешно и сохранено в {result_path}")
        
        return {
            "status": "success",
            "message": f"Сопоставление для эпизода {episode_id} выполнено успешно",
            "result_path": result_path,
            "match_result": match_result
        }
    except Exception as e:
        logger.error(f"Ошибка при сопоставлении эпизода {episode_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при сопоставлении эпизода: {str(e)}")

# Пример curl команды:
# curl -X GET "http://localhost:8000/api/simple-episode-matcher/match-episode/{episode_id}" 