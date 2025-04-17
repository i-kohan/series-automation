from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class SceneInfo(BaseModel):
    """Информация о сцене из видео"""
    start_time: float
    end_time: float
    duration: float
    summary: Optional[str] = None
    importance_score: Optional[float] = None

class Storyline(BaseModel):
    """Сюжетная линия, состоящая из нескольких сцен"""
    id: str
    name: str
    description: str
    scenes: List[SceneInfo]
    duration: float
    start_time: float
    end_time: float

class VideoAnalysisResult(BaseModel):
    """Результаты анализа видео"""
    video_filename: str
    duration: float
    total_scenes: int
    storylines: List[Storyline]
    timestamp: str  # Время выполнения анализа
    metadata: Optional[Dict[str, Any]] = None 