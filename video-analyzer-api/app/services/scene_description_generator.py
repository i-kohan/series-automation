import logging
import os
from typing import Dict, List, Any, Optional
from PIL import Image

# Импортируем клиент Replicate
from app.services.blip2_replicate_client import Blip2ReplicateClient

# Создаём именованный логгер
logger = logging.getLogger(__name__)

class SceneDescriptionGenerator:
    def __init__(self):
        # Инициализация клиента Replicate
        logger.info("Инициализация генератора описаний сцен с использованием Replicate API")
        self.replicate_client = Blip2ReplicateClient()

    def _validate_scene(self, scene: Dict[str, Any]) -> Optional[str]:
        """
        Проверяет структуру сцены на возможность обработки
        
        Args:
            scene: Объект сцены
        
        Returns:
            Optional[str]: Путь к первому кадру сцены или None, если сцена некорректна
        """
        scene_id = scene.get('id')
        if not scene_id:
            logger.warning("Сцена не имеет ID, пропускаю")
            return None
            
        # Проверяем наличие кадров
        if 'frame_analysis' not in scene or 'frame_info' not in scene['frame_analysis']:
            logger.warning(f"Сцена {scene_id} не содержит информации о кадрах, пропускаю")
            return None
            
        frame_info = scene['frame_analysis']['frame_info']
        if not frame_info:
            logger.warning(f"Сцена {scene_id} имеет пустой список кадров, пропускаю")
            return None
            
        # Берем первый кадр
        first_frame = frame_info[0]
        if 'frame_path' not in first_frame:
            logger.warning(f"Первый кадр сцены {scene_id} не содержит путь, пропускаю")
            return None
            
        return first_frame['frame_path']

    def generate_description_for_frame(self, frame_path: str, prompt="Опишите, что происходит на изображении:"):
        """
        Генерирует описание для одного кадра с использованием Replicate API
        
        Args:
            frame_path: Путь к JPG-файлу с кадром
            prompt: Текстовый промпт для модели
            
        Returns:
            str: Описание кадра
        """
        try:
            # Используем клиент Replicate для генерации описания
            logger.info(f"Запрос описания для изображения {frame_path}")
            description = self.replicate_client.run(frame_path, prompt)
            logger.info("Описание успешно получено")
            
            return description
            
        except Exception as e:
            logger.error(f"Ошибка при генерации описания кадра {frame_path}: {str(e)}")
            return f"Ошибка при анализе кадра: {str(e)}"

    def generate_descriptions(self, scenes):
        """
        Генерирует описания для списка сцен, используя первый кадр каждой сцены
        
        Args:
            scenes: Список объектов сцен
            
        Returns:
            dict: Словарь с ID сцен в качестве ключей и описаниями в качестве значений
        """
        result = {}
        total_scenes = len(scenes)
        
        logger.info(f"Начало генерации описаний для {total_scenes} сцен")
        
        for i, scene in enumerate(scenes):
            scene_id = scene.get('id')
            if not scene_id:
                logger.warning(f"Сцена {i+1}/{total_scenes} не имеет ID, пропускаю")
                continue
                
            logger.info(f"Обработка сцены {i+1}/{total_scenes}: {scene_id}")
            
            # Валидируем сцену и получаем путь к первому кадру
            frame_path = self._validate_scene(scene)
            if not frame_path:
                continue
            
            # Генерируем описание для первого кадра
            description = self.generate_description_for_frame(frame_path)
            
            # Если есть транскрипция, добавляем её к описанию
            transcript = scene.get('audio_analysis', {}).get('transcript', '')
            if transcript:
                description = f"{description} (Диалог: '{transcript}')"
            
            result[scene_id] = description
        
        logger.info(f"Завершена генерация описаний для {len(result)} сцен")
        return result
