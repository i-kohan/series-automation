from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class AudioAnalysisResult(BaseModel):
    """Результаты анализа аудио для сцены"""
    transcript: Optional[str] = None
    speakers: Optional[List[str]] = None
    emotions: Optional[Dict[str, float]] = None
    language: Optional[str] = None
    audio_features: Optional[Dict[str, Any]] = None
    segments: Optional[List[Dict[str, Any]]] = None

class SceneInfo(BaseModel):
    """Информация о сцене из видео"""
    id: str
    start_time: float
    end_time: float
    duration: float
    start_frame: Optional[int] = None
    end_frame: Optional[int] = None
    summary: Optional[str] = None
    importance_score: Optional[float] = None
    audio_analysis: Optional[AudioAnalysisResult] = None

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