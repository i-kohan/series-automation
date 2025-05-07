import numpy as np
import torch
from transformers import Blip2Processor, Blip2ForConditionalGeneration
import logging
import os
from typing import Dict, List, Any, Optional
from PIL import Image

# Создаём именованный логгер
logger = logging.getLogger(__name__)

class SceneDescriptionGenerator:
    def __init__(self):
        # Инициализация модели BLIP2 с автоматической поддержкой GPU
        logger.info("Инициализация генератора описаний сцен")
        self._setup_model()

    def _setup_model(self):
        """Настраивает модель BLIP2, автоматически используя GPU при доступности"""
        # Получаем настройки из переменных окружения
        model_name = os.environ.get("BLIP2_MODEL_NAME", "Salesforce/blip2-opt-2.7b")
        device_preference = os.environ.get("BLIP2_DEVICE", "cuda")
        compute_type = os.environ.get("BLIP2_COMPUTE_TYPE", "float16")
        
        logger.info(f"Загружаю BLIP2 с настройками: модель={model_name}, устройство={device_preference}, тип вычислений={compute_type}")
        
        # Определяем устройство: если запрошено CUDA, проверяем доступность
        if device_preference.lower() == "cuda" and torch.cuda.is_available():
            self.device = "cuda"
            logger.info("Используется GPU для ускорения вычислений BLIP2")
        else:
            self.device = "cpu"
            logger.info("Используется CPU для BLIP2")
        
        # Определяем тип данных на основе compute_type
        if compute_type.lower() == "float16" and self.device == "cuda":
            self.dtype = torch.float16
            logger.info("Используется half precision (float16) для модели BLIP2")
        else:
            self.dtype = torch.float32
            logger.info("Используется single precision (float32) для модели BLIP2")
        
        # Инициализация модели и процессора
        logger.info(f"Начинаю загрузку процессора BLIP2 ({model_name})...")
        self.processor = Blip2Processor.from_pretrained(model_name)
        
        logger.info("Процессор BLIP2 загружен. Начинаю загрузку модели BLIP2 (это может занять несколько минут)...")
        
        # Оптимизируем загрузку модели для CPU
        if self.device == "cpu":
            logger.info("Используется CPU - применяю оптимизации для снижения нагрузки")
            # Используем низкоточную модель для CPU
            self.model = Blip2ForConditionalGeneration.from_pretrained(
                model_name,
                torch_dtype=self.dtype,
                low_cpu_mem_usage=True,  # Оптимизация для низкого использования памяти
                device_map="auto"        # Автоматическое распределение слоев, может ускорить инференс
            )
        else:
            # Стандартная загрузка для GPU
            self.model = Blip2ForConditionalGeneration.from_pretrained(
                model_name, 
                torch_dtype=self.dtype
            ).to(self.device)
        
        logger.info(f"Модель BLIP2 успешно загружена на устройство: {self.device}, тип данных: {self.dtype}")

    def _move_to_device(self, inputs):
        """Перемещает входные тензоры на нужное устройство (GPU/CPU)"""
        if self.device == "cuda":
            inputs = {k: v.to(self.device) if hasattr(v, 'to') else v for k, v in inputs.items()}
        return inputs

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
        Генерирует описание для одного кадра
        
        Args:
            frame_path: Путь к JPG-файлу с кадром
            prompt: Текстовый промпт для модели
            
        Returns:
            str: Описание кадра
        """
        try:
            # Загружаем изображение из файла
            logger.info(f"Загрузка изображения из {frame_path}")
            image = Image.open(frame_path)
            
            # Подготовка входных данных
            logger.info("Подготовка входных данных для модели")
            inputs = self.processor(images=image, text=prompt, return_tensors="pt")
            inputs = self._move_to_device(inputs)
            
            # Генерация описания
            logger.info("Генерация описания для кадра")
            with torch.no_grad():
                generated_ids = self.model.generate(
                    **inputs,
                    max_new_tokens=50,
                    num_beams=3,
                    min_length=5,
                    do_sample=False,
                    repetition_penalty=1.5,
                    length_penalty=1.0
                )
            
            # Декодирование результата
            generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()
            logger.info("Описание успешно сгенерировано")
            
            # Освобождение памяти GPU, если необходимо
            if self.device == "cuda":
                torch.cuda.empty_cache()
            
            return generated_text
            
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
            
            # Освобождаем память после каждой сцены
            if self.device == "cuda":
                torch.cuda.empty_cache()
        
        logger.info(f"Завершена генерация описаний для {len(result)} сцен")
        return result
