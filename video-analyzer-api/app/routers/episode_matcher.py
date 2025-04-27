from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
import json
import os
import logging
from datetime import datetime
from app.services.storyline_matcher import StorylineMatcher
from app.models.storyline_matcher import (
    Character, UserStoryline, StorylineWithScenes
)

# Инициализация логгера
logger = logging.getLogger(__name__)

# Создаем роутер
router = APIRouter(
    prefix="/api/episode-matcher",
    tags=["episode-matcher"],
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

def load_characters(series_id: str) -> List[Character]:
    """Загружает персонажей сериала из файла"""
    try:
        data_root = get_data_root()
        characters_path = os.path.join(data_root, "series/characters.json")
        with open(characters_path, "r", encoding="utf-8") as f:
            characters_data = json.load(f)
        
        # Фильтруем персонажей по series_id
        filtered_characters = [
            Character(
                name=char["name"],
                description=char["description"],
                keywords=char["keywords"]
            )
            for char in characters_data
            if char["seriesId"] == series_id
        ]
        
        return filtered_characters
    except Exception as e:
        logger.error(f"Ошибка при загрузке персонажей: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке персонажей: {str(e)}")

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
    """Загружает сцены из файла"""
    try:
        data_root = get_data_root()
        scenes_path = os.path.join(data_root, "scenes-with-audio/scenes.json")
        with open(scenes_path, "r", encoding="utf-8") as f:
            scenes_data = json.load(f)
        return scenes_data
    except Exception as e:
        logger.error(f"Ошибка при загрузке сцен: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке сцен: {str(e)}")

def create_storylines_from_plotlines(episode: Dict[str, Any], characters: List[Character]) -> List[UserStoryline]:
    """Создает объекты UserStoryline из сюжетных линий эпизода"""
    character_map = {char.name: char for char in characters}
    
    storylines = []
    for plotline in episode.get("plotLines", []):
        # Получаем имена персонажей из их ID
        character_names = []
        for char_id in plotline.get("characters", []):
            # Находим этот ID в списке персонажей эпизода
            for char_id2 in episode.get("characters", []):
                if char_id == char_id2:
                    # Теперь находим соответствующий объект персонажа
                    for char in characters:
                        if char.name in character_map:
                            character_names.append(char.name)
        
        storylines.append(UserStoryline(
            title=plotline["title"],
            description=plotline["description"],
            characters=character_names,
            keywords=plotline.get("keywords", [])
        ))
    
    return storylines

@router.get("/match-episode/{episode_id}")
async def match_episode_to_scenes(episode_id: str) -> Dict[str, Any]:
    """
    Сопоставляет сюжетные линии эпизода с имеющимися сценами
    и сохраняет результат в shared-data
    """
    # Загружаем данные эпизода
    episode = load_episode(episode_id)
    
    # Загружаем персонажей сериала
    characters = load_characters(episode["seriesId"])
    
    # Загружаем сцены
    scenes = load_scenes()
    
    # Создаем сюжетные линии из plotLines эпизода
    storylines = create_storylines_from_plotlines(episode, characters)
    
    # Создаем экземпляр сервиса сопоставления сцен с сюжетами
    matcher = StorylineMatcher()
    
    # Выполняем сопоставление
    results = matcher.match_scenes_to_storylines(
        scenes=scenes,
        storylines=storylines,
        characters=characters
    )
    
    # Формируем результат
    match_result = {
        "episode_id": episode_id,
        "episode_title": episode["title"],
        "matched_at": datetime.now().isoformat(),
        "storylines": [storyline.dict() for storyline in results]
    }
    
    # Создаем директорию для результатов, если она не существует
    data_root = get_data_root()
    result_dir = os.path.join(data_root, "results/episode-matches")
    os.makedirs(result_dir, exist_ok=True)
    
    # Сохраняем результат в файл
    result_path = os.path.join(result_dir, f"{episode_id}.json")
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(match_result, f, ensure_ascii=False, indent=2)
    
    logger.info(f"Сопоставление для эпизода {episode_id} сохранено в {result_path}")
    
    return {
        "status": "success",
        "message": f"Сопоставление для эпизода {episode_id} выполнено успешно",
        "result_path": result_path,
        "match_result": match_result
    } 