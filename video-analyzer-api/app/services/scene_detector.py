import logging
from typing import Dict, List, Any
from scenedetect import detect, ContentDetector

from app.services.base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)

class SceneDetector(BaseAnalyzer):
    """
    Анализатор для обнаружения сцен в видео.
    """
    
    def __init__(self, threshold: float = 27.0):
        """
        Инициализация детектора сцен.
        
        Args:
            threshold: Пороговое значение для обнаружения сцен
        """
        self.threshold = threshold
        logger.info(f"Initialized SceneDetector with threshold={threshold}")
    
    def analyze(self, data: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        Обнаруживает сцены в видео.
        
        Args:
            data: Словарь данных, должен содержать ключ 'video_path'
            **kwargs: Дополнительные параметры
            
        Returns:
            Словарь с результатами анализа, содержащий список сцен
        """
        video_path = data.get('video_path')
        if not video_path:
            logger.error("No video_path provided to SceneDetector")
            return {"scenes": []}
        
        logger.info(f"Detecting scenes for {video_path}")
        
        try:
            # Используем функцию detect из scenedetect
            scene_list = detect(video_path, ContentDetector(threshold=self.threshold))
            
            logger.info(f"Обнаружено {len(scene_list)} сцен")
            
            # Преобразуем сцены в список словарей с временными метками
            scenes = []
            for i, scene in enumerate(scene_list):
                start_frame = scene[0].get_frames()
                end_frame = scene[1].get_frames()
                start_time = scene[0].get_seconds()
                end_time = scene[1].get_seconds()
                duration = end_time - start_time
                
                scenes.append({
                    "id": f"scene_{i + 1}",
                    "start_frame": start_frame,
                    "end_frame": end_frame,
                    "start_time": start_time,
                    "end_time": end_time,
                    "duration": duration
                })
            
            return {"scenes": scenes}
        except Exception as e:
            logger.error(f"Error detecting scenes: {str(e)}")
            return {"scenes": []} 