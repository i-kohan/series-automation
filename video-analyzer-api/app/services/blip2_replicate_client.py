# app/services/blip2_replicate_client.py

import base64
import os
import logging
import replicate
from typing import Optional

logger = logging.getLogger(__name__)

class Blip2ReplicateClient:
    def __init__(self):
        # ID модели BLIP2 на Replicate
        self.model_version = "salesforce/blip:2e1dddc8621f72155f24cf2e0adbde548458d3cab9f00c0139eea840d0ac4746"
        
        # Кэш для результатов
        self.cache = {}

    def run(self, image_path: str, prompt: str = "Describe this image", caption: str = "") -> str:
        """
        Запускает запрос к API Replicate для генерации описания изображения
        
        Args:
            image_path: Путь к изображению
            prompt: Текстовый запрос для модели
            
        Returns:
            str: Сгенерированное описание или сообщение об ошибке
        """
        # Проверяем кэш
        cache_key = f"{image_path}_{prompt}"
        if cache_key in self.cache:
            logger.info(f"Используем кэшированное описание для {image_path}")
            return self.cache[cache_key]
            
        try:
            logger.info(f"Открытие изображения: {image_path}")
            base64_image = self.prepare_image(image_path)
            if not base64_image:
                raise Exception("Ошибка при подготовке изображения")
            
            logger.info("Запрос на генерацию описания")
            
            # Подготавливаем параметры запроса
            inputs = {
                "image": base64_image,
                "task": "image_captioning",
                "question": prompt,
                "caption": caption
            }
            
            # Отправляем запрос
            response = replicate.run(self.model_version, input=inputs)
            
            # Обрабатываем результат
            if isinstance(response, list) and len(response) > 0:
                result = response[0]
            else:
                result = str(response)
                
            # Сохраняем в кэш
            self.cache[cache_key] = result
            
            return result
        except Exception as e:
            logger.error(f"Ошибка при обращении к Replicate: {str(e)}")
            return f"Ошибка внешнего API: {str(e)}"
            
    def prepare_image(self, image_path: str) -> Optional[str]:
        """
        Подготавливает изображение для отправки в API (кодирует в base64)
        
        Args:
            image_path: Путь к изображению
            
        Returns:
            Optional[str]: Закодированное изображение или None в случае ошибки
        """
        try:
            logger.info(f"Подготовка изображения: {image_path}")
            with open(image_path, "rb") as f:
                image_data = f.read()

            base64_image = base64.b64encode(image_data).decode("utf-8")
            mime_type = "image/jpeg"
            return f"data:{mime_type};base64,{base64_image}"
        except Exception as e:
            logger.error(f"Ошибка при подготовке изображения: {str(e)}")
            return None
