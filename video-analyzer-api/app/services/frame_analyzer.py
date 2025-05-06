import os
import logging
import tempfile
import torch
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from moviepy.editor import VideoFileClip
import cv2
from transformers import CLIPProcessor, CLIPModel
from datetime import datetime
import uuid
from pathlib import Path

from app.services.base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)

# Константы для путей
_SHARED_DATA_DIR = "/app/shared-data"
_SCENES_WITH_FRAMES_DIR = os.path.join(_SHARED_DATA_DIR, "scenes-with-frames", "frames")

class FrameAnalyzer(BaseAnalyzer):
    """
    Анализатор кадров видео, создающий визуальные embeddings.
    Извлекает ключевые кадры из сцен и создает их векторные представления
    с использованием предобученной модели компьютерного зрения.
    """
    
    def __init__(self):
        # Получаем настройки из переменных окружения
        self.model_name = os.getenv("VISION_MODEL_NAME", "openai/clip-vit-base-patch32")
        
        # Определяем устройство и тип вычислений
        self.device = os.getenv("VISION_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
        self.compute_type = os.getenv("VISION_COMPUTE_TYPE", "float16" if self.device == "cuda" else "float32")
        
        # Параметры анализа кадров
        self.frames_per_scene = int(os.getenv("FRAMES_PER_SCENE", "3"))  # Количество кадров для анализа из одной сцены
        self.min_scene_duration = float(os.getenv("MIN_SCENE_DURATION", "1.0"))  # Минимальная длительность сцены для анализа
        self.max_scene_duration = float(os.getenv("MAX_SCENE_DURATION", "300.0"))  # Макс. длительность сцены для разбивки
        
        # Параметры сохранения кадров
        self.frames_save_path = os.getenv("FRAMES_SAVE_PATH", _SCENES_WITH_FRAMES_DIR)
        
        # Проверяем наличие директории для shared-data
        if not os.path.exists(_SHARED_DATA_DIR):
            # Если мы в режиме разработки, используем относительный путь
            self.frames_save_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "shared-data", "scenes-with-frames")
        
        # Инициализируем директорию для сохранения кадров
        os.makedirs(self.frames_save_path, exist_ok=True)
        logger.info(f"Frames will be saved to: {self.frames_save_path}")
        
        # Инициализируем модель для анализа изображений
        logger.info(f"Initializing vision model: {self.model_name}, device={self.device}, compute_type={self.compute_type}")
        try:
            # Используем CLIPProcessor вместо AutoImageProcessor
            self.processor = CLIPProcessor.from_pretrained(self.model_name)
            self.model = CLIPModel.from_pretrained(
                self.model_name,
                device_map=self.device,
                torch_dtype=torch.float16 if self.compute_type == "float16" else torch.float32
            )
            self.model.eval()  # Переключаем в режим оценки
            logger.info(f"Vision model '{self.model_name}' loaded successfully on {self.device}")
        except Exception as e:
            logger.error(f"Error loading vision model: {str(e)}")
            self.processor = None
            self.model = None

    def analyze(self, data: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        Анализирует кадры для конкретной сцены видео.
        
        Args:
            data: Словарь с данными, должен содержать:
                - video_path: Путь к видеофайлу
                - start_time: Начальное время сцены (в секундах)
                - end_time: Конечное время сцены (в секундах)
                - scene_id: ID сцены для именования файлов
            **kwargs: Дополнительные параметры
            
        Returns:
            Словарь с результатами анализа кадров
        """
        # Извлекаем необходимые параметры
        video_path = data.get('video_path')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        scene_id = data.get('scene_id')
        
        # Проверяем наличие всех необходимых параметров
        if not self._validate_input_parameters(video_path, start_time, end_time):
            return self._create_empty_result()
        
        # Логируем информацию о начале анализа
        duration = end_time - start_time
        logger.info(f"Analyzing frames for scene {scene_id if scene_id else ''}: {start_time:.2f}s - {end_time:.2f}s (duration: {duration:.2f}s)")
        
        # Определяем количество кадров для анализа в зависимости от длительности сцены
        num_frames = self._determine_frames_count(duration)
        logger.info(f"Will extract {num_frames} frames for analysis")
        
        try:
            # Извлекаем кадры
            frames = self._extract_frames(video_path, start_time, end_time, num_frames)
            
            if not frames:
                logger.error("Failed to extract frames")
                return self._create_empty_result()
            
            # Создаем эмбеддинги для извлеченных кадров
            embeddings, frame_info = self._create_frame_embeddings(frames, start_time, end_time, scene_id)
            
            # Формируем результат
            result = {
                "embeddings": embeddings.tolist() if isinstance(embeddings, np.ndarray) else None,
                "num_frames": len(frames),
                "frame_info": frame_info,
                "embedding_model": self.model_name,
                "embedding_dim": embeddings.shape[1] if isinstance(embeddings, np.ndarray) else None
            }
                
            return result
            
        except Exception as e:
            logger.error(f"Error during frame analysis: {str(e)}")
            return self._create_empty_result()
    
    def _validate_input_parameters(self, video_path: str, start_time: Optional[float], 
                                   end_time: Optional[float]) -> bool:
        """Проверяет валидность входных параметров"""
        if not all([video_path, start_time is not None, end_time is not None]):
            logger.error("Missing required parameters for FrameAnalyzer.analyze")
            return False
        
        if not os.path.exists(video_path):
            logger.error(f"Video file not found: {video_path}")
            return False
            
        return True
    
    def _create_empty_result(self) -> Dict[str, Any]:
        """Создаёт пустой результат анализа кадров"""
        return {
            "embeddings": None,
            "num_frames": 0,
            "frame_info": [],
            "embedding_model": self.model_name,
            "embedding_dim": None
        }
    
    def _determine_frames_count(self, duration: float) -> int:
        """
        Определяет количество кадров для анализа в зависимости от длительности сцены.
        
        Args:
            duration: Длительность сцены в секундах
            
        Returns:
            Количество кадров для анализа
        """
        if duration < self.min_scene_duration:
            return 1  # Для очень коротких сцен берем только один кадр
        elif duration > self.max_scene_duration:
            # Для очень длинных сцен увеличиваем количество кадров
            return min(int(duration / 10), 10)  # Не более 10 кадров для длинных сцен
        else:
            return self.frames_per_scene
    
    def _extract_frames(self, video_path: str, start_time: float, end_time: float, 
                       num_frames: int) -> List[np.ndarray]:
        """
        Извлекает кадры из видео для заданного временного диапазона.
        
        Args:
            video_path: Путь к видеофайлу
            start_time: Начальное время в секундах
            end_time: Конечное время в секундах
            num_frames: Количество кадров для извлечения
            
        Returns:
            Список numpy массивов представляющих кадры (в формате BGR)
        """
        frames = []
        duration = end_time - start_time
        
        # Добавляем небольшой отступ для последнего кадра (100 миллисекунд)
        end_offset_ms = 100  # миллисекунды
        end_offset = end_offset_ms / 1000.0  # в секундах
        
        # Убедимся, что отступ не больше половины длительности сцены
        safe_end_offset = min(end_offset, duration / 2)
        adjusted_end_time = end_time - safe_end_offset
        
        try:
            # Открываем видеофайл
            with VideoFileClip(video_path) as video:
                if duration <= 0:
                    logger.error(f"Invalid time range: {start_time}s - {end_time}s")
                    return frames
                
                # Определяем временные точки для извлечения кадров
                if num_frames == 1:
                    # Если нужен только один кадр, берем из середины сцены
                    frame_times = [start_time + duration / 2]
                else:
                    # Равномерно распределяем кадры по времени с учетом отступа в конце
                    adjusted_duration = adjusted_end_time - start_time
                    
                    if num_frames == 2:
                        # Для двух кадров: один в начале, один с отступом от конца
                        frame_times = [start_time, adjusted_end_time]
                    else:
                        # Для более чем двух кадров: равномерно распределяем
                        frame_times = [
                            start_time + i * adjusted_duration / (num_frames - 1) 
                            for i in range(num_frames)
                        ]
                
                logger.debug(f"Extracting frames at times: {[f'{t:.2f}s' for t in frame_times]}")
                
                # Извлекаем кадры в указанные временные точки
                for t in frame_times:
                    # Ограничиваем время, чтобы не выйти за пределы видео
                    t = min(t, video.duration - 0.1)
                    t = max(t, 0)
                    
                    # Получаем кадр из видео
                    frame = video.get_frame(t)
                    
                    # Конвертируем из RGB в BGR для OpenCV
                    frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                    
                    frames.append(frame_bgr)
                    logger.debug(f"Extracted frame at time {t:.2f}s")
                
                logger.info(f"Extracted {len(frames)} frames from time range {start_time:.2f}s - {end_time:.2f}s (with {safe_end_offset*1000:.0f}ms end offset)")
                return frames
                
        except Exception as e:
            logger.error(f"Error extracting frames: {str(e)}")
            return []
    
    def _create_frame_embeddings(self, frames: List[np.ndarray], 
                               start_time: float, end_time: float,
                               scene_id: Optional[str] = None) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
        """
        Создает эмбеддинги для кадров с использованием модели компьютерного зрения.
        Также сохраняет кадры на диск и добавляет пути к ним в информацию о кадрах.
        
        Args:
            frames: Список кадров для анализа
            start_time: Начальное время сцены
            end_time: Конечное время сцены
            scene_id: ID сцены для именования файлов
            
        Returns:
            Кортеж из массива эмбеддингов и информации о кадрах
        """
        if not frames or self.model is None or self.processor is None:
            return np.zeros((0, 0)), []
        
        duration = end_time - start_time
        frame_embeddings = []
        frame_info = []
        
        try:
            # Определяем директорию для сохранения кадров
            frames_dir = self.frames_save_path
            os.makedirs(frames_dir, exist_ok=True)
            
            # Формируем ID сцены для имени файла
            scene_identifier = scene_id if scene_id else f"scene_{start_time:.2f}_{end_time:.2f}"
            
            # Обрабатываем каждый кадр
            for i, frame in enumerate(frames):
                # Вычисляем примерное время кадра
                if len(frames) == 1:
                    frame_time = start_time + duration / 2
                else:
                    frame_time = start_time + i * duration / (len(frames) - 1)
                
                # Преобразуем BGR в RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Подготавливаем изображение для модели CLIP
                # CLIP требует как изображение, так и текст для обработки
                inputs = self.processor(
                    text=["a photo"], 
                    images=frame_rgb, 
                    return_tensors="pt", 
                    padding=True
                )
                
                # Переносим тензоры на нужное устройство
                inputs = {k: v.to(self.device) for k, v in inputs.items()}
                
                # Получаем эмбеддинг
                with torch.no_grad():
                    outputs = self.model.get_image_features(**{
                        k: v for k, v in inputs.items() 
                        if k in ['pixel_values']
                    })
                
                # Получаем эмбеддинг изображения
                embedding = outputs.cpu().numpy()
                
                frame_embeddings.append(embedding)
                
                # Создаем имя файла для кадра с ID сцены
                frame_filename = f"frame_{scene_identifier}_{i}.jpg"
                frame_path = os.path.join(frames_dir, frame_filename)
                
                # Сохраняем кадр на диск
                cv2.imwrite(frame_path, frame)
                
                # Сохраняем информацию о кадре
                frame_info.append({
                    "time": float(frame_time),
                    "relative_position": i / max(1, len(frames) - 1),  # От 0 до 1
                    "frame_path": frame_path,
                    "frame_filename": frame_filename
                })
                
                logger.debug(f"Saved frame to {frame_path} and created embedding for time {frame_time:.2f}s")
            
            # Объединяем все эмбеддинги в один массив
            if frame_embeddings:
                all_embeddings = np.vstack(frame_embeddings)
                logger.info(f"Created embeddings array with shape {all_embeddings.shape}")
                return all_embeddings, frame_info
            else:
                return np.zeros((0, 0)), []
                
        except Exception as e:
            logger.error(f"Error creating frame embeddings: {str(e)}")
            return np.zeros((0, 0)), [] 