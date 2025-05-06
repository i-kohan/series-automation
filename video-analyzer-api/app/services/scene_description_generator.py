import numpy as np
import torch
from transformers import Blip2Processor, Blip2ForConditionalGeneration
import logging
from typing import Dict, List, Any, Optional
from PIL import Image

class SceneDescriptionGenerator:
    def __init__(self):
        # Инициализация модели BLIP2 с автоматической поддержкой GPU
        self._setup_model()

    def _setup_model(self):
        """Настраивает модель BLIP2, автоматически используя GPU при доступности"""
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        if self.device == "cuda":
            logging.info("Используется GPU для ускорения вычислений BLIP2")
        else:
            logging.info("Используется CPU для BLIP2")
        
        # Инициализация модели и процессора
        self.processor = Blip2Processor.from_pretrained("Salesforce/blip2-opt-2.7b")
        self.model = Blip2ForConditionalGeneration.from_pretrained(
            "Salesforce/blip2-opt-2.7b", 
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32
        ).to(self.device)
        
        logging.info("Модель BLIP2 успешно загружена")

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
            logging.warning("Сцена не имеет ID, пропускаю")
            return None
            
        # Проверяем наличие кадров
        if 'frame_analysis' not in scene or 'frame_info' not in scene['frame_analysis']:
            logging.warning(f"Сцена {scene_id} не содержит информации о кадрах, пропускаю")
            return None
            
        frame_info = scene['frame_analysis']['frame_info']
        if not frame_info:
            logging.warning(f"Сцена {scene_id} имеет пустой список кадров, пропускаю")
            return None
            
        # Берем первый кадр
        first_frame = frame_info[0]
        if 'frame_path' not in first_frame:
            logging.warning(f"Первый кадр сцены {scene_id} не содержит путь, пропускаю")
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
            image = Image.open(frame_path)
            
            # Подготовка входных данных
            inputs = self.processor(images=image, text=prompt, return_tensors="pt")
            inputs = self._move_to_device(inputs)
            
            # Генерация описания
            with torch.no_grad():
                generated_ids = self.model.generate(
                    **inputs,
                    max_length=100,
                    num_beams=5,
                    min_length=10,
                    do_sample=True,
                    top_p=0.9,
                    temperature=0.7
                )
            
            # Декодирование результата
            generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()
            
            # Освобождение памяти GPU, если необходимо
            if self.device == "cuda":
                torch.cuda.empty_cache()
            
            return generated_text
            
        except Exception as e:
            logging.error(f"Ошибка при генерации описания кадра {frame_path}: {str(e)}")
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
        
        logging.info(f"Начало генерации описаний для {total_scenes} сцен")
        
        for i, scene in enumerate(scenes):
            scene_id = scene.get('id')
            if not scene_id:
                logging.warning(f"Сцена {i+1}/{total_scenes} не имеет ID, пропускаю")
                continue
                
            logging.info(f"Обработка сцены {i+1}/{total_scenes}: {scene_id}")
            
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
        
        logging.info(f"Завершена генерация описаний для {len(result)} сцен")
        return result
