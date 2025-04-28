import os
import time
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Callable, Optional

from app.services.video_metadata_extractor import VideoMetadataExtractor
from app.services.scene_detector import SceneDetector
from app.services.audio_analyzer import AudioAnalyzer
from app.services.frame_analyzer import FrameAnalyzer
from app.services.storyline_grouper import StorylineGrouper
from app.services.task_manager import save_scenes_with_audio, save_scenes_with_frames

logger = logging.getLogger(__name__)

class AnalysisPipeline:
    """
    Координатор для выполнения анализа видео.
    Последовательно выполняет анализаторы и объединяет их результаты.
    """
    
    def __init__(self):
        # Инициализируем компоненты анализа
        self.metadata_extractor = VideoMetadataExtractor()
        self.scene_detector = SceneDetector()
        self.audio_analyzer = AudioAnalyzer()
        self.frame_analyzer = FrameAnalyzer()
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
        start_time = time.time()
        
        try:
            # Начинаем анализ и проверяем существование файла
            status_updater(task_id, "processing", "Начало анализа видео...", 0.0)
            
            if not self._validate_video_file(video_path, task_id, status_updater):
                return {}
            
            # Последовательно выполняем этапы анализа
            metadata = self._extract_metadata(video_path, task_id, status_updater)
            scenes = self._detect_scenes(video_path, task_id, status_updater)
            
            if not scenes:
                status_updater(task_id, "error", "Не удалось обнаружить сцены в видео", 0.2)
                return {}
            
            # Анализируем аудио и кадры для каждой сцены
            scenes_with_audio = self._analyze_scenes_audio(video_path, scenes, task_id, status_updater)
            
            # Сохраняем результаты анализа аудио сцен с помощью task_manager
            save_scenes_with_audio(task_id, scenes_with_audio)
            
            # Анализируем кадры для каждой сцены (новый этап)
            scenes_with_frames = self._analyze_scenes_frames(video_path, scenes_with_audio, task_id, status_updater)
            
            # Сохраняем результаты анализа кадров сцен
            if save_scenes_with_frames is not None:
                save_scenes_with_frames(task_id, scenes_with_frames)
            
            # Группируем сцены в сюжетные линии
            storylines = self._group_into_storylines(scenes_with_frames, num_storylines, task_id, status_updater)
            
            # Формируем и возвращаем итоговый результат
            end_time = time.time()
            analysis_time = end_time - start_time
            
            final_result = self._create_final_result(
                video_path, metadata, scenes, storylines, analysis_time
            )
            
            # Обновляем статус как завершено
            status_updater(task_id, "processing", "Анализ завершен", 1.0)
            
            return final_result
            
        except Exception as e:
            logger.error(f"Error in analysis pipeline: {str(e)}")
            status_updater(task_id, "error", f"Ошибка анализа: {str(e)}", 0.0)
            return {}
    
    def _validate_video_file(self, video_path: str, task_id: str, 
                            status_updater: Callable) -> bool:
        """Проверяет существование видеофайла"""
        if not os.path.exists(video_path):
            status_updater(task_id, "error", f"Файл {video_path} не найден", 0.0)
            return False
        return True
    
    def _extract_metadata(self, video_path: str, task_id: str, 
                         status_updater: Callable) -> Dict[str, Any]:
        """Извлекает метаданные из видеофайла"""
        status_updater(task_id, "processing", "Извлечение метаданных видео...", 0.1)
        
        try:
            metadata_result = self.metadata_extractor.analyze({"video_path": video_path})
            metadata = metadata_result.get("metadata", {})
            logger.info(f"Metadata extraction completed: duration={metadata.get('duration', 0):.2f}s")
            return metadata
        except Exception as e:
            logger.error(f"Error extracting metadata: {str(e)}")
            return {}
    
    def _detect_scenes(self, video_path: str, task_id: str, 
                      status_updater: Callable) -> List[Dict[str, Any]]:
        """Обнаруживает сцены в видео"""
        status_updater(task_id, "processing", "Обнаружение сцен...", 0.2)
        
        try:
            scenes_result = self.scene_detector.analyze({"video_path": video_path})
            scenes = scenes_result.get("scenes", [])
            logger.info(f"Scene detection completed: {len(scenes)} scenes found")
            return scenes
        except Exception as e:
            logger.error(f"Error detecting scenes: {str(e)}")
            status_updater(task_id, "error", f"Ошибка при обнаружении сцен: {str(e)}", 0.2)
            return []
    
    def _analyze_scenes_audio(self, video_path: str, scenes: List[Dict[str, Any]], 
                             task_id: str, status_updater: Callable) -> List[Dict[str, Any]]:
        """Анализирует аудио для каждой сцены"""
        scenes_with_audio = []
        
        if not scenes:
            return scenes_with_audio
            
        status_updater(task_id, "processing", "Анализ аудио сцен...", 0.4)
        total_scenes = len(scenes)
        
        for i, scene in enumerate(scenes):
            # Обновляем статус для каждой сцены
            scene_progress = 0.4 + (0.2 * (i / total_scenes))
            status_updater(task_id, "processing", f"Анализ аудио сцены {i+1}/{total_scenes}...", scene_progress)
            
            try:
                # Генерируем scene_id для чекпоинта и загрузки
                scene_id = f"scene_{i+1}"
                
                # Анализируем аудио сцены
                logger.info(f"Analyzing audio for scene: {scene['start_time']:.2f}s - {scene['end_time']:.2f}s")
                scene_audio_input = {
                    'video_path': video_path,
                    'start_time': scene['start_time'],
                    'end_time': scene['end_time'],
                    'task_id': task_id,
                    'scene_id': scene_id
                }
                
                scene_audio_result = self.audio_analyzer.analyze(scene_audio_input)
                
                # Добавляем результаты аудио-анализа к сцене
                scene_with_audio = scene.copy()
                scene_with_audio['audio_analysis'] = scene_audio_result
                scene_with_audio['id'] = scene_id  # Добавляем ID сцены для будущих ссылок
                scenes_with_audio.append(scene_with_audio)
            except Exception as e:
                logger.error(f"Error analyzing audio for scene {i+1}: {str(e)}")
                # Добавляем сцену без аудио-анализа
                scene['id'] = f"scene_{i+1}"  # Всё равно добавляем ID
                scenes_with_audio.append(scene)
        
        return scenes_with_audio
    
    def _analyze_scenes_frames(self, video_path: str, scenes: List[Dict[str, Any]], 
                              task_id: str, status_updater: Callable) -> List[Dict[str, Any]]:
        """
        Анализирует кадры для каждой сцены, создавая эмбеддинги для визуального содержимого.
        
        Args:
            video_path: Путь к видеофайлу
            scenes: Список сцен (уже с результатами аудио-анализа)
            task_id: Идентификатор задачи
            status_updater: Функция для обновления статуса задачи
            
        Returns:
            Список сцен с добавленными результатами анализа кадров
        """
        scenes_with_frames = []
        
        if not scenes:
            return scenes_with_frames
            
        status_updater(task_id, "processing", "Анализ кадров сцен...", 0.6)
        total_scenes = len(scenes)
        
        for i, scene in enumerate(scenes):
            # Обновляем статус для каждой сцены
            scene_progress = 0.6 + (0.2 * (i / total_scenes))
            status_updater(task_id, "processing", f"Анализ кадров сцены {i+1}/{total_scenes}...", scene_progress)
            
            try:
                # Получаем или создаем scene_id
                scene_id = scene.get('id', f"scene_{i+1}")
                
                # Анализируем кадры сцены
                logger.info(f"Analyzing frames for scene {scene_id}: {scene['start_time']:.2f}s - {scene['end_time']:.2f}s")
                scene_frames_input = {
                    'video_path': video_path,
                    'start_time': scene['start_time'],
                    'end_time': scene['end_time'],
                    'task_id': task_id,
                    'scene_id': scene_id
                }
                
                scene_frames_result = self.frame_analyzer.analyze(scene_frames_input)
                
                # Добавляем результаты анализа кадров к сцене
                scene_with_frames = scene.copy()
                scene_with_frames['frame_analysis'] = scene_frames_result
                
                # Обеспечиваем наличие ID сцены
                if 'id' not in scene_with_frames:
                    scene_with_frames['id'] = scene_id
                    
                scenes_with_frames.append(scene_with_frames)
                
            except Exception as e:
                logger.error(f"Error analyzing frames for scene {i+1}: {str(e)}")
                # Добавляем сцену без анализа кадров
                scenes_with_frames.append(scene)
        
        return scenes_with_frames
    
    def _group_into_storylines(self, scenes: List[Dict[str, Any]], num_storylines: int, 
                              task_id: str, status_updater: Callable) -> List[Dict[str, Any]]:
        """Группирует сцены в сюжетные линии"""
        status_updater(task_id, "processing", "Группировка сцен в сюжетные линии...", 0.8)
        
        try:
            storylines_input = {
                'scenes': scenes,
                'num_storylines': num_storylines
            }
            storylines_result = self.storyline_grouper.analyze(storylines_input)
            storylines = storylines_result.get("storylines", [])
            logger.info(f"Storyline grouping completed: {len(storylines)} storylines created")
            return storylines
        except Exception as e:
            logger.error(f"Error grouping storylines: {str(e)}")
            return []
    
    def _create_final_result(self, video_path: str, metadata: Dict[str, Any], 
                            scenes: List[Dict[str, Any]], storylines: List[Dict[str, Any]],
                            analysis_time: float) -> Dict[str, Any]:
        """Создает итоговый результат анализа"""
        return {
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