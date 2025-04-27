from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Union

class Character(BaseModel):
    """Модель для описания персонажа"""
    name: str
    description: str
    keywords: List[str]

class UserStoryline(BaseModel):
    """Модель для пользовательского сюжета"""
    title: str
    description: str
    characters: List[str]  # Имена персонажей
    keywords: List[str]

class CharacterMatch(BaseModel):
    """Модель для описания совпадения персонажа в сцене"""
    name: str
    score: float
    mentions: List[Dict[str, Union[str, float]]]  # Найденные упоминания и их веса

class KeywordMatch(BaseModel):
    """Модель для описания совпадения ключевого слова в сцене"""
    keyword: str
    score: float
    occurrences: List[Dict[str, Union[str, float]]]  # Найденные вхождения и их веса

class SceneMatch(BaseModel):
    """Модель для описания совпадения сцены с сюжетом"""
    scene_id: str
    score: float
    character_matches: Dict[str, float]  # Оценки совпадения по персонажам
    keyword_matches: Dict[str, float]    # Оценки совпадения по ключевым словам
    audio_relevance: float               # Оценка соответствия аудио-характеристик
    start_time: float
    end_time: float
    duration: float
    transcript: str

class StorylineWithScenes(BaseModel):
    """Модель для сюжета с подобранными сценами"""
    title: str
    description: str
    characters: List[Character]
    keywords: List[str]
    scenes: List[SceneMatch]
    total_duration: float
    score: float

class StorylineMatchRequest(BaseModel):
    """Модель для запроса на сопоставление сцен с сюжетами"""
    scenes: List[Dict[str, Any]]        # Сцены с аудио-анализом
    storylines: List[UserStoryline]     # Пользовательские сюжеты
    characters: List[Character]         # Описания персонажей
    
class StorylineMatchResponse(BaseModel):
    """Модель для ответа с результатами сопоставления"""
    storylines: List[StorylineWithScenes] 