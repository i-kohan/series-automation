from abc import ABC, abstractmethod
from typing import Dict, Any, List

class BaseAnalyzer(ABC):
    """
    Базовый абстрактный класс для всех анализаторов.
    Каждый анализатор должен реализовать метод analyze.
    """
    
    @abstractmethod
    def analyze(self, data: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        Анализирует данные и возвращает результат анализа.
        
        Args:
            data: Данные для анализа
            **kwargs: Дополнительные параметры для анализа
            
        Returns:
            Результаты анализа
        """
        pass 