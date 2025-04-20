import os
import time
import logging
from datetime import datetime
from typing import Dict, List, Any, Callable

from app.services.video_metadata_extractor import VideoMetadataExtractor
from app.services.scene_detector import SceneDetector
from app.services.audio_analyzer import AudioAnalyzer
from app.services.storyline_grouper import StorylineGrouper

logger = logging.getLogger(__name__)

class AnalysisPipeline:
    """
    Координатор для выполнения анализа видео.
    Последовательно выполняет анализаторы и объединяет их результаты.
    """
    
    def __init__(self):
        """Инициализация пайплайна анализа с фиксированными анализаторами"""
        self.metadata_extractor = VideoMetadataExtractor()
        self.scene_detector = SceneDetector()
        self.audio_analyzer = AudioAnalyzer()
        self.storyline_grouper = StorylineGrouper()
        logger.info("Initialized AnalysisPipeline with default analyzers")
    
    def analyze(self, video_path: str, task_id: str, status_updater: Callable, 
                num_storylines: int = 3, **kwargs) -> Dict[str, Any]:
        """
        Запускает полный пайплайн анализа видео.
        
        Args:
            video_path: Путь к анализируемому видео
            task_id: Идентификатор задачи
            status_updater: Функция для обновления статуса задачи
            num_storylines: Желаемое количество сюжетных линий
            **kwargs: Дополнительные параметры для анализаторов
            
        Returns:
            Объединенные результаты всех анализаторов
        """
        try:
            start_time = time.time()
            status_updater(task_id, "processing", "Начало анализа видео...", 0.0)
            
            # Проверяем существование файла
            if not os.path.exists(video_path):
                status_updater(task_id, "error", f"Файл {video_path} не найден", 0.0)
                return {}
            
            # Шаг 1: Извлечение метаданных видео
            status_updater(task_id, "processing", "Извлечение метаданных видео...", 0.1)
            try:
                metadata_result = self.metadata_extractor.analyze({"video_path": video_path})
                metadata = metadata_result.get("metadata", {})
                logger.info(f"Metadata extraction completed: duration={metadata.get('duration', 0):.2f}s")
            except Exception as e:
                logger.error(f"Error extracting metadata: {str(e)}")
                metadata = {}
            
            # Шаг 2: Обнаружение сцен
            status_updater(task_id, "processing", "Обнаружение сцен...", 0.2)
            try:
                scenes_result = self.scene_detector.analyze({"video_path": video_path})
                scenes = scenes_result.get("scenes", [])
                logger.info(f"Scene detection completed: {len(scenes)} scenes found")
                
                if not scenes:
                    status_updater(task_id, "error", "Не удалось обнаружить сцены в видео", 0.2)
                    return {}
            except Exception as e:
                logger.error(f"Error detecting scenes: {str(e)}")
                status_updater(task_id, "error", f"Ошибка при обнаружении сцен: {str(e)}", 0.2)
                return {}
            
            # Шаг 3: Анализ аудио для каждой сцены
            scenes_with_audio = []
            if scenes:
                status_updater(task_id, "processing", "Анализ аудио сцен...", 0.4)
                total_scenes = len(scenes)
                
                for i, scene in enumerate(scenes):
                    # Обновляем статус для каждой сцены
                    scene_progress = 0.4 + (0.4 * (i / total_scenes))
                    status_updater(task_id, "processing", f"Анализ аудио сцены {i+1}/{total_scenes}...", scene_progress)
                    
                    try:
                        # Анализируем аудио сцены
                        scene_audio_input = {
                            'video_path': video_path,
                            'start_time': scene['start_time'],
                            'end_time': scene['end_time']
                        }
                        
                        scene_audio_result = self.audio_analyzer.analyze(scene_audio_input)
                        
                        # Добавляем результаты аудио-анализа к сцене
                        scene_with_audio = scene.copy()
                        scene_with_audio['audio_analysis'] = scene_audio_result
                        scenes_with_audio.append(scene_with_audio)
                    except Exception as e:
                        logger.error(f"Error analyzing audio for scene {i+1}: {str(e)}")
                        # Добавляем сцену без аудио-анализа
                        scenes_with_audio.append(scene)
            
            # Шаг 4: Группировка сцен в сюжетные линии
            status_updater(task_id, "processing", "Группировка сцен в сюжетные линии...", 0.8)
            try:
                storylines_input = {
                    'scenes': scenes_with_audio if scenes_with_audio else scenes,
                    'num_storylines': num_storylines
                }
                storylines_result = self.storyline_grouper.analyze(storylines_input)
                storylines = storylines_result.get("storylines", [])
                logger.info(f"Storyline grouping completed: {len(storylines)} storylines created")
            except Exception as e:
                logger.error(f"Error grouping storylines: {str(e)}")
                storylines = []
            
            # Формируем итоговый результат
            end_time = time.time()
            analysis_time = end_time - start_time
            
            final_result = {
                "video_filename": os.path.basename(video_path),
                "duration": metadata.get('duration', 0),
                "total_scenes": len(scenes),
                "storylines": storylines,
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    "fps": metadata.get('fps', 0),
                    "size": metadata.get('size', [0, 0]),
                    "analysis_time_seconds": analysis_time
                }
            }
            
            # Обновляем статус как завершено
            status_updater(task_id, "processing", "Анализ завершен", 1.0)
            
            return final_result
            
        except Exception as e:
            logger.error(f"Error in analysis pipeline: {str(e)}")
            status_updater(task_id, "error", f"Ошибка анализа: {str(e)}", 0.0)
            return {} 