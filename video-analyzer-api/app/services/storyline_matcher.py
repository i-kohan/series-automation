import logging
import nltk
import numpy as np
import torch
from typing import List, Dict, Any, Tuple, Optional
from sklearn.metrics.pairwise import cosine_similarity
from transformers import AutoTokenizer, AutoModel
from app.models.storyline_matcher import (
    Character, UserStoryline, SceneMatch, 
    StorylineWithScenes, CharacterMatch, KeywordMatch
)

# Инициализация логгера
logger = logging.getLogger(__name__)

class StorylineMatcher:
    """
    Сервис для сопоставления сцен с пользовательскими сюжетами.
    Использует семантический анализ текста и кластеризацию для определения
    связей между сценами и сюжетами.
    """
    
    def __init__(self):
        """
        Инициализация сервиса сопоставления сцен с сюжетами.
        """
        # Загрузка необходимых ресурсов NLTK
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt')
        
        # NLP модели будут инициализированы при первом использовании
        self.tokenizer = None
        self.model = None
        
        logger.info("Инициализирован StorylineMatcher")
    
    def _initialize_model(self):
        """
        Инициализирует модель для создания текстовых embeddings.
        """
        if self.tokenizer is None or self.model is None:
            # Используем русскоязычную модель BERT
            model_name = "DeepPavlov/rubert-base-cased"
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModel.from_pretrained(model_name)
            self.model.eval()  # Переключаем в режим оценки
            logger.info(f"Инициализирована модель {model_name} для анализа текста")
    
    def match_scenes_to_storylines(
        self, 
        scenes: List[Dict[str, Any]], 
        storylines: List[UserStoryline], 
        characters: List[Character]
    ) -> List[StorylineWithScenes]:
        """
        Сопоставляет сцены с пользовательскими сюжетами используя семантический анализ.
        
        Args:
            scenes: Список сцен с аудио-анализом
            storylines: Список пользовательских сюжетов
            characters: Список описаний персонажей
            
        Returns:
            Список сюжетов с подобранными сценами
        """
        logger.info(f"Начало сопоставления {len(scenes)} сцен с {len(storylines)} сюжетами")
        
        # Инициализируем модель, если еще не инициализирована
        self._initialize_model()
        
        # Создаем словарь персонажей для быстрого доступа
        character_map = {char.name: char for char in characters}
        
        # Получаем embeddings для сцен и сюжетов
        scene_embeddings, storyline_embeddings = self._create_embeddings(scenes, storylines, character_map)
        
        # Вычисляем матрицу сходства между сценами и сюжетами
        similarity_matrix = cosine_similarity(scene_embeddings, storyline_embeddings)
        
        # Выполняем кластеризацию для обнаружения групп связанных сцен
        scene_clusters = self._cluster_related_scenes(scenes, storylines, scene_embeddings)
        
        # Обнаруживаем переходы между сюжетами
        storyline_transitions = self._detect_storyline_transitions(scenes, scene_clusters)
        
        # Формируем результаты
        results = []
        
        for storyline_idx, storyline in enumerate(storylines):
            # Находим сцены, связанные с этим сюжетом
            related_indices = scene_clusters[storyline_idx]["scene_indices"]
            scene_similarities = similarity_matrix[:, storyline_idx]
            
            # Создаем SceneMatch объекты для каждой подходящей сцены
            matched_scenes = []
            
            for idx in related_indices:
                scene = scenes[idx]
                score = float(scene_similarities[idx])
                
                # Если оценка выше порога, добавляем сцену
                if score > 0.2:  # Минимальный порог совпадения
                    # Анализируем совпадения с персонажами и ключевыми словами
                    character_matches = self._match_characters(scene, storyline, character_map)
                    keyword_matches = self._match_keywords(scene, storyline.keywords)
                    
                    # Применяем контекстные бонусы к оценке
                    score = self._apply_context_bonuses(
                        score, idx, storyline_idx, storyline_transitions
                    )
                    
                    # Создаем объект сцены
                    matched_scenes.append(SceneMatch(
                        scene_id=scene["id"],
                        score=min(1.0, score),  # Ограничиваем максимальную оценку
                        character_matches=character_matches,
                        keyword_matches=keyword_matches,
                        audio_relevance=0.5,  # Не используем аудио-анализ на данном этапе
                        start_time=scene["start_time"],
                        end_time=scene["end_time"],
                        duration=scene["duration"],
                        transcript=scene.get("audio_analysis", {}).get("transcript", "")
                    ))
            
            # Сортировка сцен по оценке совпадения (от высшей к низшей)
            matched_scenes.sort(key=lambda x: x.score, reverse=True)
            
            # Вычисление общей длительности
            total_duration = sum(scene.duration for scene in matched_scenes)
            
            # Добавление результата сюжета
            results.append(StorylineWithScenes(
                title=storyline.title,
                description=storyline.description,
                characters=[character_map[name] for name in storyline.characters if name in character_map],
                keywords=storyline.keywords,
                scenes=matched_scenes,
                total_duration=total_duration,
                score=sum(scene.score for scene in matched_scenes) / len(matched_scenes) if matched_scenes else 0
            ))
        
        # Сортировка сюжетов по общей оценке
        results.sort(key=lambda x: x.score, reverse=True)
        
        logger.info(f"Завершено сопоставление. Найдено {sum(len(s.scenes) for s in results)} совпадений для {len(results)} сюжетов")
        
        return results
    
    def _create_embeddings(
        self, 
        scenes: List[Dict[str, Any]], 
        storylines: List[UserStoryline],
        character_map: Dict[str, Character]
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Создает embeddings для сцен и сюжетов.
        
        Args:
            scenes: Список сцен
            storylines: Список сюжетов
            character_map: Словарь персонажей
            
        Returns:
            Кортеж из (embeddings сцен, embeddings сюжетов)
        """
        # Создаем embeddings для сцен
        scene_embeddings = []
        for scene in scenes:
            transcript = scene.get("audio_analysis", {}).get("transcript", "")
            embedding = self._get_text_embedding(transcript)
            scene_embeddings.append(embedding)
        
        scene_embeddings = np.vstack(scene_embeddings)
        
        # Создаем embeddings для сюжетов
        storyline_embeddings = []
        for storyline in storylines:
            # Комбинируем название, описание и ключевые слова
            storyline_text = f"{storyline.title}. {storyline.description}. " + " ".join(storyline.keywords)
            
            # Добавляем информацию о персонажах, если они есть
            for char_name in storyline.characters:
                if char_name in character_map:
                    char = character_map[char_name]
                    storyline_text += f" {char.name}. {char.description}. " + " ".join(char.keywords)
            
            embedding = self._get_text_embedding(storyline_text)
            storyline_embeddings.append(embedding)
        
        storyline_embeddings = np.vstack(storyline_embeddings)
        
        return scene_embeddings, storyline_embeddings
    
    def _get_text_embedding(self, text: str) -> np.ndarray:
        """
        Получает embedding для текста.
        
        Args:
            text: Входной текст
            
        Returns:
            Numpy массив с embedding
        """
        # Если текст пустой, возвращаем нулевой вектор
        if not text:
            # Размерность выходного вектора модели (для rubert-base это 768)
            return np.zeros((1, 768))
        
        # Токенизация текста
        inputs = self.tokenizer(text, return_tensors="pt", 
                               padding=True, truncation=True, max_length=512)
        
        # Получение embeddings
        with torch.no_grad():
            outputs = self.model(**inputs)
        
        # Усреднение по токенам для получения embedding предложения
        embeddings = outputs.last_hidden_state.mean(dim=1).cpu().numpy()
        return embeddings
    
    def _cluster_related_scenes(
        self, 
        scenes: List[Dict[str, Any]], 
        storylines: List[UserStoryline],
        scene_embeddings: np.ndarray
    ) -> Dict[int, Dict[str, Any]]:
        """
        Группирует сцены в кластеры, семантически связанные с сюжетами.
        
        Args:
            scenes: Список сцен
            storylines: Список сюжетов
            scene_embeddings: Embeddings сцен
            
        Returns:
            Словарь кластеров сцен для каждого сюжета
        """
        # Вычисляем матрицу сходства между всеми сценами
        scene_similarity_matrix = cosine_similarity(scene_embeddings)
        
        # Для каждого сюжета ищем тематически связанные сцены
        scene_clusters = {}
        
        for storyline_idx, storyline in enumerate(storylines):
            # Создаем embedding для сюжета
            storyline_text = f"{storyline.title}. {storyline.description}. " + " ".join(storyline.keywords)
            storyline_embedding = self._get_text_embedding(storyline_text)
            
            # Вычисляем сходство с каждой сценой
            storyline_similarity = cosine_similarity(storyline_embedding, scene_embeddings).squeeze()
            
            # Находим сцены с высоким сходством с сюжетом
            high_similarity_indices = np.where(storyline_similarity > 0.4)[0]
            potential_scenes = [(i, storyline_similarity[i]) for i in high_similarity_indices]
            
            # Для каждой потенциальной сцены находим тематически близкие другие сцены
            related_scenes = set()
            for idx, _ in potential_scenes:
                # Находим другие сцены с высоким сходством с текущей
                scene_similarity = scene_similarity_matrix[idx]
                similar_scenes = np.where(scene_similarity > 0.6)[0]
                related_scenes.update(similar_scenes)
            
            # Добавляем начальные потенциальные сцены
            related_scenes.update([idx for idx, _ in potential_scenes])
            
            # Сортируем сцены по временной последовательности
            related_scenes = sorted(related_scenes)
            
            scene_clusters[storyline_idx] = {
                "storyline": storyline,
                "scene_indices": list(related_scenes),
                "avg_similarity": np.mean([storyline_similarity[i] for i in related_scenes]) if related_scenes else 0
            }
        
        return scene_clusters
    
    def _detect_storyline_transitions(
        self, 
        scenes: List[Dict[str, Any]], 
        scene_clusters: Dict[int, Dict[str, Any]]
    ) -> List[Tuple[int, int]]:
        """
        Определяет переходы между сюжетами, анализируя последовательность сцен.
        
        Args:
            scenes: Список сцен
            scene_clusters: Кластеры сцен для каждого сюжета
            
        Returns:
            Список кортежей (индекс сюжета, индекс сцены)
        """
        # Сортируем сцены по времени
        sorted_scene_indices = sorted(range(len(scenes)), key=lambda i: scenes[i]["start_time"])
        
        # Отслеживаем, к какому сюжету относится каждая сцена
        scene_to_storyline = {}
        for storyline_idx, cluster in scene_clusters.items():
            for scene_idx in cluster["scene_indices"]:
                if scene_idx not in scene_to_storyline:
                    scene_to_storyline[scene_idx] = []
                scene_to_storyline[scene_idx].append(storyline_idx)
        
        # Анализируем последовательность сюжетов во времени
        storyline_sequence = []
        current_storyline = None
        
        for i in sorted_scene_indices:
            storylines = scene_to_storyline.get(i, [])
            
            if not storylines:
                continue
            
            # Если сцена относится к нескольким сюжетам, выбираем с наивысшим сходством
            if len(storylines) > 1:
                similarities = [scene_clusters[s]["avg_similarity"] for s in storylines]
                best_storyline = storylines[similarities.index(max(similarities))]
            else:
                best_storyline = storylines[0]
            
            if best_storyline != current_storyline:
                storyline_sequence.append((best_storyline, i))
                current_storyline = best_storyline
        
        return storyline_sequence
    
    def _apply_context_bonuses(
        self, 
        score: float, 
        scene_idx: int, 
        storyline_idx: int, 
        storyline_transitions: List[Tuple[int, int]]
    ) -> float:
        """
        Применяет контекстные бонусы к оценке сцены.
        
        Args:
            score: Исходная оценка
            scene_idx: Индекс сцены
            storyline_idx: Индекс сюжета
            storyline_transitions: Переходы между сюжетами
            
        Returns:
            Обновленную оценку с учетом контекста
        """
        # Находим позицию сцены в переходах
        position = None
        for i, (sl_idx, sc_idx) in enumerate(storyline_transitions):
            if sl_idx == storyline_idx and sc_idx == scene_idx:
                position = i
                break
        
        if position is None:
            return score
        
        # Проверяем, входит ли сцена в последовательность сцен того же сюжета
        if position > 0 and position < len(storyline_transitions) - 1:
            prev_storyline = storyline_transitions[position - 1][0]
            next_storyline = storyline_transitions[position + 1][0]
            
            # Если сцена находится между сценами того же сюжета
            if prev_storyline == storyline_idx or next_storyline == storyline_idx:
                score *= 1.2  # Повышаем оценку на 20%
        
        return min(1.0, score)  # Ограничиваем максимальную оценку
    
    def _match_characters(
        self, 
        scene: Dict[str, Any], 
        storyline: UserStoryline, 
        character_map: Dict[str, Character]
    ) -> Dict[str, float]:
        """
        Находит совпадения по персонажам в сцене.
        
        Args:
            scene: Данные сцены
            storyline: Данные сюжета
            character_map: Словарь персонажей
            
        Returns:
            Словарь с оценками совпадения по каждому персонажу
        """
        transcript = scene.get("audio_analysis", {}).get("transcript", "")
        result = {}
        
        for char_name in storyline.characters:
            if char_name in character_map:
                # Базовая проверка на упоминание имени
                if char_name.lower() in transcript.lower():
                    result[char_name] = 0.8  # Высокая оценка если имя упомянуто
                else:
                    # Проверяем ключевые слова персонажа
                    char_keywords = character_map[char_name].keywords
                    matched_keywords = [kw for kw in char_keywords if kw.lower() in transcript.lower()]
                    
                    if matched_keywords:
                        # Оценка зависит от доли найденных ключевых слов
                        result[char_name] = 0.5 * len(matched_keywords) / len(char_keywords)
                    else:
                        # Семантическое сравнение описания персонажа и транскрипции
                        char_description = character_map[char_name].description
                        
                        # Если есть и описание, и транскрипция
                        if char_description and transcript:
                            char_emb = self._get_text_embedding(char_description)
                            transcript_emb = self._get_text_embedding(transcript)
                            
                            semantic_similarity = cosine_similarity(char_emb, transcript_emb)[0][0]
                            result[char_name] = semantic_similarity * 0.4  # Умножаем на вес
                        else:
                            result[char_name] = 0.0
        
        return result
    
    def _match_keywords(
        self, 
        scene: Dict[str, Any], 
        keywords: List[str]
    ) -> Dict[str, float]:
        """
        Находит совпадения по ключевым словам в сцене.
        
        Args:
            scene: Данные сцены
            keywords: Ключевые слова для поиска
            
        Returns:
            Словарь с оценками совпадения по каждому ключевому слову
        """
        transcript = scene.get("audio_analysis", {}).get("transcript", "")
        result = {}
        
        for keyword in keywords:
            # Точное совпадение
            if keyword.lower() in transcript.lower():
                result[keyword] = 0.8
            else:
                # Семантическое сравнение ключевого слова и транскрипции
                if transcript:
                    kw_emb = self._get_text_embedding(keyword)
                    transcript_emb = self._get_text_embedding(transcript)
                    
                    semantic_similarity = cosine_similarity(kw_emb, transcript_emb)[0][0]
                    result[keyword] = semantic_similarity * 0.5  # Умножаем на вес
                else:
                    result[keyword] = 0.0
        
        return result 