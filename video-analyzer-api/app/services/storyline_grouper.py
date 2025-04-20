import logging
from typing import Dict, List, Any

from app.services.base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)

class StorylineGrouper(BaseAnalyzer):
    """
    Анализатор для группировки сцен в сюжетные линии.
    """
    
    def __init__(self, proximity_radius_percent: float = 0.1):
        """
        Инициализация группировщика сюжетных линий.
        
        Args:
            proximity_radius_percent: Радиус близости сцен как процент от общей длительности видео
        """
        self.proximity_radius_percent = proximity_radius_percent
        logger.info(f"Initialized StorylineGrouper with proximity_radius_percent={proximity_radius_percent}")
    
    def analyze(self, data: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        Группирует сцены в сюжетные линии.
        
        Args:
            data: Словарь данных, должен содержать ключ 'scenes'
            **kwargs: Дополнительные параметры, включая 'num_storylines'
            
        Returns:
            Словарь с результатами анализа, содержащий список сюжетных линий
        """
        scenes = data.get('scenes', [])
        num_storylines = kwargs.get('num_storylines', 3)
        
        if not scenes:
            logger.warning("No scenes provided to StorylineGrouper")
            return {"storylines": []}
        
        logger.info(f"Grouping {len(scenes)} scenes into {num_storylines} storylines")
        
        # Группируем сцены в сюжетные линии
        storylines = self._group_scenes_into_storylines(scenes, num_storylines)
        
        return {"storylines": storylines}
    
    def _group_scenes_into_storylines(self, scenes: List[Dict[str, Any]], num_storylines: int = 3) -> List[Dict[str, Any]]:
        """Группировка сцен в сюжетные линии"""
        # Если сцен меньше, чем запрошенных сюжетных линий, просто возвращаем все
        if len(scenes) <= num_storylines:
            storylines = []
            for i, scene in enumerate(scenes):
                storyline_scenes = [scene]
                start_time = scene["start_time"]
                end_time = scene["end_time"]
                duration = scene["duration"]
                
                storylines.append({
                    "id": f"storyline_{i + 1}",
                    "name": f"Сюжетная линия {i + 1}",
                    "description": f"Сюжет, состоящий из одной сцены длительностью {duration:.1f} секунд",
                    "scenes": storyline_scenes,
                    "duration": duration,
                    "start_time": start_time,
                    "end_time": end_time
                })
            return storylines
        
        # Сортируем сцены по длительности (от самых длинных)
        sorted_scenes = sorted(scenes, key=lambda s: s["duration"], reverse=True)
        
        # Берем N самых длинных сцен как базовые для сюжетных линий
        key_scenes = sorted_scenes[:num_storylines]
        
        # Для каждой ключевой сцены, находим близкие сцены по времени
        storylines = []
        for i, key_scene in enumerate(key_scenes):
            key_start = key_scene["start_time"]
            key_end = key_scene["end_time"]
            
            # Определяем "радиус" близости как определенный процент от длительности всего видео
            video_duration = scenes[-1]["end_time"]
            proximity_radius = video_duration * self.proximity_radius_percent
            
            # Находим сцены, близкие к ключевой
            storyline_scenes = [key_scene]
            for scene in scenes:
                # Пропускаем саму ключевую сцену
                if scene["id"] == key_scene["id"]:
                    continue
                
                # Проверяем близость сцены к ключевой
                if (abs(scene["start_time"] - key_end) < proximity_radius or 
                    abs(scene["end_time"] - key_start) < proximity_radius):
                    storyline_scenes.append(scene)
            
            # Сортируем сцены в сюжетной линии по времени начала
            storyline_scenes.sort(key=lambda s: s["start_time"])
            
            # Вычисляем общую длительность и время начала/конца сюжетной линии
            start_time = storyline_scenes[0]["start_time"]
            end_time = storyline_scenes[-1]["end_time"]
            duration = end_time - start_time
            
            storylines.append({
                "id": f"storyline_{i + 1}",
                "name": f"Сюжетная линия {i + 1}",
                "description": f"Сюжет длительностью {duration:.1f} секунд, включающий {len(storyline_scenes)} сцен",
                "scenes": storyline_scenes,
                "duration": duration,
                "start_time": start_time,
                "end_time": end_time
            })
        
        return storylines 