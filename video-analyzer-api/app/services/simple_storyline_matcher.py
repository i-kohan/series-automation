import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from transformers import CLIPProcessor, CLIPModel
import logging
from typing import Dict, List, Any
import torch
from sklearn.preprocessing import normalize

class SimpleStorylineMatcher:
    def __init__(self):
        # Инициализация модели CLIP с автоматической поддержкой GPU
        self._setup_model()
        
        # Кэш для хранения вычисленных эмбеддингов сюжетов
        self.plot_embeddings_cache = {}

    def _setup_model(self):
        """Настраивает модель, автоматически используя GPU при доступности"""
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        if self.device == "cuda":
            logging.info("Используется GPU для ускорения вычислений")
        
        self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(self.device)
        self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

    def _move_to_device(self, inputs):
        """Перемещает входные тензоры на нужное устройство (GPU/CPU)"""
        if self.device == "cuda":
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
        return inputs
        
    def _convert_to_numpy(self, tensor):
        """Преобразует тензор PyTorch в numpy массив"""
        if self.device == "cuda":
            tensor = tensor.cpu()
            torch.cuda.empty_cache()
        return tensor.detach().numpy()

    def _normalize_vector(self, vector):
        """Нормализует вектор для корректного косинусного сходства"""
        # Используем L2-нормализацию (единичная длина вектора)
        return normalize(vector.reshape(1, -1))[0]
    
    def get_visual_embedding_for_plot(self, plot: Dict[str, Any]) -> np.ndarray:
        """
        Создаёт "визуальный" эмбеддинг для сюжета — на основе ключевых слов или заголовка.
        Используется для сравнения с image эмбеддингами сцен.
        """
        visual_prompt = f"{plot['title']} {' '.join(plot['keywords'])}"
        return self.get_text_embedding(visual_prompt)

    def get_text_embedding(self, text: str) -> np.ndarray:
        """Генерирует текстовые эмбеддинги"""
        # Подготовка входных данных
        inputs = self.processor(text=[text], return_tensors="pt", padding=True, truncation=True)
        
        # Перемещение на нужное устройство
        inputs = self._move_to_device(inputs)
        
        # Получаем эмбеддинги без вычисления градиентов
        with torch.no_grad():
            outputs = self.model.get_text_features(**inputs)
        
        # Конвертируем результат в numpy
        embeddings = self._convert_to_numpy(outputs)
        
        # Нормализуем вектор
        return self._normalize_vector(embeddings)

    def get_frame_embedding(self, frame_embeddings: np.ndarray) -> np.ndarray:
        # Усреднение эмбеддингов кадров для получения одного векторного представления
        mean_embedding = np.mean(frame_embeddings, axis=0)
        # Нормализуем вектор
        return self._normalize_vector(mean_embedding)

    def get_plot_embedding(self, plot: Dict[str, Any]) -> np.ndarray:
        """
        Получает эмбеддинг для сюжета, используя кэш для избежания повторных вычислений
        """
        # Генерируем уникальный ключ для сюжета
        plot_key = plot.get('id', str(hash(f"{plot['title']}{plot['description']}{''.join(plot['keywords'])}")))
        
        # Проверяем, есть ли эмбеддинг в кэше
        if plot_key in self.plot_embeddings_cache:
            return self.plot_embeddings_cache[plot_key]
        
        # Если нет, вычисляем эмбеддинг и сохраняем в кэш
        plot_text = f"{plot['title']} {plot['description']} {' '.join(plot['keywords'])}"
        embedding = self.get_text_embedding(plot_text)
        self.plot_embeddings_cache[plot_key] = embedding
        return embedding

    def calculate_similarity(self, scene, plot) -> dict:
        # Получение текстовых эмбеддингов для транскрипта сцены и описания сюжета
        text_embedding_scene = self.get_text_embedding(scene['audio_analysis']['transcript'])
        text_embedding_plot = self.get_plot_embedding(plot)  # Используем кэшированный эмбеддинг
        visual_embedding_plot = self.get_visual_embedding_for_plot(plot)

        # Получение усредненных эмбеддингов кадров для сцены
        frame_embedding_scene = self.get_frame_embedding(scene['frame_analysis']['embeddings'])

        # Вычисление косинусного сходства для текстовых и визуальных эмбеддингов
        # Поскольку векторы уже нормализованы, используем dot product
        text_similarity = float(np.dot(text_embedding_scene, text_embedding_plot))
        image_similarity = float(np.dot(frame_embedding_scene, visual_embedding_plot))

        similarity_score = 0.3 * text_similarity + 0.7 * image_similarity

        return {
            'sceneId': scene['id'],
            'plotId': plot['id'],
            'similarityScore': similarity_score,
            'breakdown': {
                'textSimilarity': text_similarity,
                'imageSimilarity': image_similarity
            }
        }

    def match_scenes_to_plots(self, scenes, plots):
        # Логирование начала процесса сопоставления
        logging.info("Начало сопоставления сцен с сюжетами")
        logging.info(f"Количество сцен: {len(scenes)}, количество сюжетов: {len(plots)}")
        
        # Предварительное вычисление эмбеддингов для всех сюжетов
        for plot in plots:
            self.get_plot_embedding(plot)
        logging.info(f"Эмбеддинги для {len(plots)} сюжетов вычислены и кэшированы")
        
        # Сопоставление каждой сцены с каждым сюжетом и вычисление схожести
        results = []
        for scene in scenes:
            scene_id = scene.get('id')
            logging.info(f"Сопоставление сцены: {scene_id}")
            
            for plot in plots:
                result = self.calculate_similarity(scene, plot)
                results.append(result)
        
        # Просто сортируем все результаты по убыванию схожести
        results.sort(key=lambda x: x['similarityScore'], reverse=True)
        
        # Логирование завершения процесса сопоставления
        logging.info("Завершение сопоставления сцен с сюжетами")
        return results 