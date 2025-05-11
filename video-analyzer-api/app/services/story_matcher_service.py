import logging
from sentence_transformers import CrossEncoder
from typing import Dict, Any
import os

logger = logging.getLogger(__name__)

class StoryMatcherService:
    def __init__(self):
        # Инициализируем CrossEncoder с предобученной моделью
        model_id = os.getenv("CROSS_ENCODER_MODEL_NAME", "cross-encoder/ms-marco-MiniLM-L-6-v2")
        logger.info(f"Инициализация StoryMatcherService с CrossEncoder {model_id}")
        self.model = CrossEncoder(model_id)
        
    def calculate_similarity(self, description: str, story: str) -> float:
        """
        Вычисляет схожесть между описанием сцены и сюжетом
        
        Args:
            description: Описание сцены
            story: Сюжет для сравнения
            
        Returns:
            float: Оценка схожести от 0 до 1
        """
        try:
            # Получаем оценку схожести от модели
            score = self.model.predict([(story, description)])[0]
            
            # Нормализуем оценку до диапазона [0, 1]
            normalized_score = max(0.0, min(1.0, score))
            
            logger.info(f"Вычислена схожесть: {normalized_score:.4f}")
            return normalized_score
            
        except Exception as e:
            logger.error(f"Ошибка при вычислении схожести: {str(e)}")
            return 0.0 