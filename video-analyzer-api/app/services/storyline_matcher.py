import logging
import nltk
import numpy as np
import torch
import os
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
            logger.info("Загрузка NLTK punkt tokenizer")
            nltk.download('punkt')
        
        # NLP модели будут инициализированы при первом использовании
        self.tokenizer = None
        self.model = None
        
        # Читаем настройки из переменных окружения
        self.enable_character_matching = self._get_env_bool('ENABLE_CHARACTER_MATCHING', True)
        self.enable_keyword_matching = self._get_env_bool('ENABLE_KEYWORD_MATCHING', True)
        self.min_scene_score_threshold = self._get_env_float('MIN_SCENE_SCORE_THRESHOLD', 0.2)
        
        logger.info(f"Инициализирован StorylineMatcher с настройками: "
                   f"enable_character_matching={self.enable_character_matching}, "
                   f"enable_keyword_matching={self.enable_keyword_matching}, "
                   f"min_scene_score_threshold={self.min_scene_score_threshold}")
    
    def _get_env_bool(self, env_name: str, default: bool) -> bool:
        """Получает булево значение из переменной окружения"""
        value = os.environ.get(env_name, str(default)).lower()
        return value in ('true', '1', 'yes', 'y')
    
    def _get_env_float(self, env_name: str, default: float) -> float:
        """Получает числовое значение из переменной окружения"""
        try:
            return float(os.environ.get(env_name, default))
        except (ValueError, TypeError):
            return default

    def _initialize_model(self):
        """
        Инициализирует модель для создания текстовых embeddings.
        """
        if self.tokenizer is None or self.model is None:
            # Используем русскоязычную модель BERT
            logger.info("Загрузка языковой модели для анализа текста...")
            model_name = "DeepPavlov/rubert-base-cased"
            
            try:
                logger.info(f"Загрузка токенизатора {model_name}")
                self.tokenizer = AutoTokenizer.from_pretrained(model_name)
                
                logger.info(f"Загрузка модели {model_name}")
                self.model = AutoModel.from_pretrained(model_name)
                self.model.eval()  # Переключаем в режим оценки
                
                logger.info(f"Модель {model_name} успешно инициализирована для анализа текста")
            except Exception as e:
                logger.error(f"Ошибка при инициализации модели: {str(e)}")
                raise
    
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
        logger.info(f"Имеется {len(characters)} персонажей для анализа")
        logger.info(f"Режимы сопоставления: персонажи={'включены' if self.enable_character_matching else 'отключены'}, "
                   f"ключевые слова={'включены' if self.enable_keyword_matching else 'отключены'}")
        
        # Инициализируем модель, если еще не инициализирована
        logger.info("Инициализация модели для анализа текста")
        self._initialize_model()
        
        # Создаем словарь персонажей для быстрого доступа
        logger.info("Создание словаря персонажей")
        character_map = {char.name: char for char in characters}
        logger.info(f"Создан словарь с {len(character_map)} персонажами")
        
        # Получаем embeddings для сцен и сюжетов
        logger.info("Создание эмбеддингов для сцен и сюжетов")
        try:
            scene_embeddings, storyline_embeddings = self._create_embeddings(scenes, storylines, character_map)
            logger.info(f"Созданы эмбеддинги: {scene_embeddings.shape} для сцен, {storyline_embeddings.shape} для сюжетов")
        except Exception as e:
            logger.error(f"Ошибка при создании эмбеддингов: {str(e)}")
            raise
        
        # Вычисляем матрицу сходства между сценами и сюжетами
        logger.info("Вычисление матрицы сходства между сценами и сюжетами")
        similarity_matrix = cosine_similarity(scene_embeddings, storyline_embeddings)
        logger.info(f"Размер матрицы сходства: {similarity_matrix.shape}")
        
        # Выполняем кластеризацию для обнаружения групп связанных сцен
        logger.info("Кластеризация связанных сцен")
        scene_clusters = self._cluster_related_scenes(scenes, storylines, scene_embeddings)
        logger.info(f"Создано {len(scene_clusters)} кластеров сцен")
        
        # Отображаем статистику по кластерам
        for storyline_idx, cluster in scene_clusters.items():
            logger.info(f"Кластер {storyline_idx} (сюжет '{cluster['storyline'].title}'): найдено {len(cluster['scene_indices'])} сцен, средняя схожесть {cluster['avg_similarity']:.4f}")
        
        # Обнаруживаем переходы между сюжетами
        logger.info("Определение переходов между сюжетами")
        storyline_transitions = self._detect_storyline_transitions(scenes, scene_clusters)
        logger.info(f"Найдено {len(storyline_transitions)} переходов между сюжетами")
        
        # Формируем результаты
        logger.info("Создание итоговых результатов сопоставления")
        results = []
        
        for storyline_idx, storyline in enumerate(storylines):
            logger.info(f"Обработка сюжета {storyline_idx}: '{storyline.title}'")
            
            # Находим сцены, связанные с этим сюжетом
            related_indices = scene_clusters[storyline_idx]["scene_indices"]
            scene_similarities = similarity_matrix[:, storyline_idx]
            
            logger.info(f"Для сюжета '{storyline.title}' найдено {len(related_indices)} потенциальных сцен")
            
            # Создаем SceneMatch объекты для каждой подходящей сцены
            matched_scenes = []
            
            for idx in related_indices:
                scene = scenes[idx]
                score = float(scene_similarities[idx])
                
                # Если оценка выше порога, добавляем сцену
                if score > self.min_scene_score_threshold:
                    logger.info(f"Сцена {scene['id']} имеет оценку сходства {score:.4f} > {self.min_scene_score_threshold}, анализируем детали")
                    
                    # Анализируем совпадения с персонажами и ключевыми словами, если включено
                    character_matches = {}
                    keyword_matches = {}
                    
                    if self.enable_character_matching:
                        character_matches = self._match_characters(scene, storyline, character_map)
                        logger.info(f"Сцена {scene['id']}: найдены совпадения с {len(character_matches)} персонажами")
                    
                    if self.enable_keyword_matching:
                        keyword_matches = self._match_keywords(scene, storyline.keywords)
                        logger.info(f"Сцена {scene['id']}: найдены совпадения с {len(keyword_matches)} ключевыми словами")
                    
                    # Применяем контекстные бонусы к оценке
                    original_score = score
                    score = self._apply_context_bonuses(
                        score, idx, storyline_idx, storyline_transitions
                    )
                    
                    if score != original_score:
                        logger.info(f"Оценка сцены {scene['id']} изменена с {original_score:.4f} на {score:.4f} на основе контекста")
                    
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
                else:
                    logger.info(f"Сцена {scene['id']} имеет слишком низкую оценку: {score:.4f} < {self.min_scene_score_threshold}, пропускаем")
            
            # Сортировка сцен по оценке совпадения (от высшей к низшей)
            matched_scenes.sort(key=lambda x: x.score, reverse=True)
            logger.info(f"Отобрано {len(matched_scenes)} сцен для сюжета '{storyline.title}'")
            
            # Если найдены сцены, выводим топ-3
            if matched_scenes:
                top_scenes = matched_scenes[:min(3, len(matched_scenes))]
                for i, scene in enumerate(top_scenes):
                    logger.info(f"Топ-{i+1} сцена для '{storyline.title}': {scene.scene_id}, оценка: {scene.score:.4f}, продолжительность: {scene.duration:.2f} сек")
            
            # Вычисление общей длительности
            total_duration = sum(scene.duration for scene in matched_scenes)
            
            # Добавление результата сюжета
            try:
                characters_for_storyline = [character_map[name] for name in storyline.characters if name in character_map]
                logger.info(f"Найдено {len(characters_for_storyline)} персонажей для сюжета '{storyline.title}'")
                
                avg_score = sum(scene.score for scene in matched_scenes) / len(matched_scenes) if matched_scenes else 0
                
                storyline_result = StorylineWithScenes(
                    title=storyline.title,
                    description=storyline.description,
                    characters=characters_for_storyline,
                    keywords=storyline.keywords,
                    scenes=matched_scenes,
                    total_duration=total_duration,
                    score=avg_score
                )
                
                results.append(storyline_result)
                logger.info(f"Сюжет '{storyline.title}': общая оценка {avg_score:.4f}, длительность {total_duration:.2f} сек")
                
            except Exception as e:
                logger.error(f"Ошибка при создании объекта StorylineWithScenes для '{storyline.title}': {str(e)}")
                continue
        
        # Сортировка сюжетов по общей оценке
        results.sort(key=lambda x: x.score, reverse=True)
        
        logger.info(f"Завершено сопоставление. Найдено {sum(len(s.scenes) for s in results)} совпадений для {len(results)} сюжетов")
        
        # Выводим итоговые оценки для каждого сюжета
        for idx, result in enumerate(results):
            logger.info(f"Финальный результат #{idx+1}: '{result.title}', оценка: {result.score:.4f}, количество сцен: {len(result.scenes)}")
        
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
        logger.info(f"Создание эмбеддингов для {len(scenes)} сцен")
        scene_embeddings = []
        
        for i, scene in enumerate(scenes):
            if i % 50 == 0:  # Логируем прогресс каждые 50 сцен
                logger.info(f"Обработано {i}/{len(scenes)} сцен")
                
            transcript = scene.get("audio_analysis", {}).get("transcript", "")
            
            # Если транскрипция отсутствует или пуста, логируем это
            if not transcript:
                logger.info(f"Сцена {scene['id']} не имеет транскрипции, будет создан нулевой эмбеддинг")
                
            embedding = self._get_text_embedding(transcript)
            scene_embeddings.append(embedding)
        
        scene_embeddings = np.vstack(scene_embeddings)
        logger.info(f"Созданы эмбеддинги для сцен размерностью {scene_embeddings.shape}")
        
        # Создаем embeddings для сюжетов
        logger.info(f"Создание эмбеддингов для {len(storylines)} сюжетов")
        storyline_embeddings = []
        
        for storyline in storylines:
            # Комбинируем название, описание и ключевые слова
            storyline_text = f"{storyline.title}. {storyline.description}. " + " ".join(storyline.keywords)
            
            # Добавляем информацию о персонажах, если они есть
            character_count = 0
            for char_name in storyline.characters:
                if char_name in character_map:
                    char = character_map[char_name]
                    storyline_text += f" {char.name}. {char.description}. " + " ".join(char.keywords)
                    character_count += 1
            
            logger.info(f"Сюжет '{storyline.title}': текст для эмбеддинга включает {character_count} персонажей, {len(storyline.keywords)} ключевых слов")
            
            embedding = self._get_text_embedding(storyline_text)
            storyline_embeddings.append(embedding)
        
        storyline_embeddings = np.vstack(storyline_embeddings)
        logger.info(f"Созданы эмбеддинги для сюжетов размерностью {storyline_embeddings.shape}")
        
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
        
        try:
            # Токенизация текста
            inputs = self.tokenizer(text, return_tensors="pt", 
                                padding=True, truncation=True, max_length=512)
            
            # Получение embeddings
            with torch.no_grad():
                outputs = self.model(**inputs)
            
            # Усреднение по токенам для получения embedding предложения
            embeddings = outputs.last_hidden_state.mean(dim=1).cpu().numpy()
            return embeddings
        except Exception as e:
            logger.error(f"Ошибка при создании эмбеддинга для текста: {str(e)}")
            # В случае ошибки возвращаем нулевой вектор
            return np.zeros((1, 768))
    
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
        logger.info("Вычисление матрицы сходства между всеми сценами")
        scene_similarity_matrix = cosine_similarity(scene_embeddings)
        logger.info(f"Матрица сходства между сценами размерностью {scene_similarity_matrix.shape}")
        
        # Для каждого сюжета ищем тематически связанные сцены
        scene_clusters = {}
        
        for storyline_idx, storyline in enumerate(storylines):
            logger.info(f"Кластеризация сцен для сюжета {storyline_idx}: '{storyline.title}'")
            
            # Создаем embedding для сюжета
            storyline_text = f"{storyline.title}. {storyline.description}. " + " ".join(storyline.keywords)
            storyline_embedding = self._get_text_embedding(storyline_text)
            
            # Вычисляем сходство с каждой сценой
            logger.info(f"Вычисление сходства сюжета '{storyline.title}' со всеми сценами")
            storyline_similarity = cosine_similarity(storyline_embedding, scene_embeddings).squeeze()
            
            # Находим сцены с высоким сходством с сюжетом
            threshold = 0.4  # Порог сходства
            high_similarity_indices = np.where(storyline_similarity > threshold)[0]
            potential_scenes = [(i, storyline_similarity[i]) for i in high_similarity_indices]
            
            logger.info(f"Найдено {len(potential_scenes)} сцен с высоким сходством (>{threshold}) с сюжетом '{storyline.title}'")
            
            # Для каждой потенциальной сцены находим тематически близкие другие сцены
            related_scenes = set()
            for idx, similarity in potential_scenes:
                # Находим другие сцены с высоким сходством с текущей
                scene_similarity = scene_similarity_matrix[idx]
                similar_scenes = np.where(scene_similarity > 0.6)[0]
                related_scenes.update(similar_scenes)
                logger.info(f"Для сцены {scenes[idx]['id']} (сходство: {similarity:.4f}) найдено {len(similar_scenes)} похожих сцен")
            
            # Добавляем начальные потенциальные сцены
            related_scenes.update([idx for idx, _ in potential_scenes])
            
            # Сортируем сцены по временной последовательности
            related_scenes = sorted(related_scenes)
            
            # Некоторая статистика по идентификаторам сцен в кластере
            scene_ids = [scenes[idx]['id'] for idx in related_scenes[:min(5, len(related_scenes))]]
            logger.info(f"Кластер для сюжета '{storyline.title}' содержит {len(related_scenes)} сцен. Примеры: {', '.join(scene_ids)}")
            
            avg_similarity = np.mean([storyline_similarity[i] for i in related_scenes]) if related_scenes else 0
            logger.info(f"Средняя схожесть сцен кластера '{storyline.title}' с сюжетом: {avg_similarity:.4f}")
            
            scene_clusters[storyline_idx] = {
                "storyline": storyline,
                "scene_indices": list(related_scenes),
                "avg_similarity": avg_similarity
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
        logger.info("Сортировка сцен по времени для анализа переходов между сюжетами")
        sorted_scene_indices = sorted(range(len(scenes)), key=lambda i: scenes[i]["start_time"])
        
        # Отслеживаем, к какому сюжету относится каждая сцена
        logger.info("Создание карты соответствия сцен сюжетам")
        scene_to_storyline = {}
        for storyline_idx, cluster in scene_clusters.items():
            for scene_idx in cluster["scene_indices"]:
                if scene_idx not in scene_to_storyline:
                    scene_to_storyline[scene_idx] = []
                scene_to_storyline[scene_idx].append(storyline_idx)
        
        logger.info(f"Создана карта сцен и сюжетов, {len(scene_to_storyline)} сцен имеют соответствие с сюжетами")
        
        # Анализируем последовательность сюжетов во времени
        storyline_sequence = []
        current_storyline = None
        
        for i in sorted_scene_indices:
            storylines = scene_to_storyline.get(i, [])
            
            if not storylines:
                continue
            
            # Если сцена относится к нескольким сюжетам, выбираем с наивысшим сходством
            if len(storylines) > 1:
                logger.info(f"Сцена {scenes[i]['id']} относится к {len(storylines)} сюжетам, выбираем с наивысшим сходством")
                similarities = [scene_clusters[s]["avg_similarity"] for s in storylines]
                best_storyline = storylines[similarities.index(max(similarities))]
            else:
                best_storyline = storylines[0]
            
            if best_storyline != current_storyline:
                storyline_sequence.append((best_storyline, i))
                logger.info(f"Обнаружен переход к сюжету {best_storyline} в сцене {scenes[i]['id']}")
                current_storyline = best_storyline
        
        logger.info(f"Определено {len(storyline_sequence)} переходов между сюжетами")
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
                logger.info(f"Сцена с индексом {scene_idx} получает бонус +20% за нахождение в последовательности сюжета {storyline_idx}")
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
        
        if not transcript:
            logger.info(f"Сцена {scene['id']} не имеет транскрипции для анализа персонажей")
            return result
            
        logger.info(f"Анализ персонажей для сцены {scene['id']} с транскрипцией длиной {len(transcript)} символов")
        
        for char_name in storyline.characters:
            if char_name in character_map:
                # Базовая проверка на упоминание имени
                if char_name.lower() in transcript.lower():
                    result[char_name] = 0.8  # Высокая оценка если имя упомянуто
                    logger.info(f"Персонаж '{char_name}' напрямую упомянут в сцене {scene['id']}, оценка: 0.8")
                else:
                    # Проверяем ключевые слова персонажа
                    char_keywords = character_map[char_name].keywords
                    matched_keywords = [kw for kw in char_keywords if kw.lower() in transcript.lower()]
                    
                    if matched_keywords:
                        # Оценка зависит от доли найденных ключевых слов
                        match_score = 0.5 * len(matched_keywords) / len(char_keywords)
                        result[char_name] = match_score
                        logger.info(f"Персонаж '{char_name}' связан с {len(matched_keywords)}/{len(char_keywords)} ключевыми словами в сцене {scene['id']}, оценка: {match_score:.4f}")
                    else:
                        # Семантическое сравнение описания персонажа и транскрипции
                        char_description = character_map[char_name].description
                        
                        # Если есть и описание, и транскрипция
                        if char_description and transcript:
                            logger.info(f"Выполняем семантическое сравнение для персонажа '{char_name}' в сцене {scene['id']}")
                            char_emb = self._get_text_embedding(char_description)
                            transcript_emb = self._get_text_embedding(transcript)
                            
                            semantic_similarity = cosine_similarity(char_emb, transcript_emb)[0][0]
                            sem_score = semantic_similarity * 0.4
                            result[char_name] = sem_score
                            logger.info(f"Семантическое сходство для персонажа '{char_name}': {semantic_similarity:.4f}, итоговая оценка: {sem_score:.4f}")
                        else:
                            result[char_name] = 0.0
                            logger.info(f"Персонаж '{char_name}' не имеет ключевых слов или семантического сходства с сценой {scene['id']}")
        
        logger.info(f"Найдено {len(result)} совпадений персонажей для сцены {scene['id']}")
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
        
        if not transcript:
            logger.info(f"Сцена {scene['id']} не имеет транскрипции для анализа ключевых слов")
            return result
            
        logger.info(f"Анализ {len(keywords)} ключевых слов для сцены {scene['id']}")
        
        for keyword in keywords:
            # Точное совпадение
            if keyword.lower() in transcript.lower():
                result[keyword] = 0.8
                logger.info(f"Точное совпадение ключевого слова '{keyword}' в сцене {scene['id']}, оценка: 0.8")
            else:
                # Семантическое сравнение ключевого слова и транскрипции
                if transcript:
                    logger.info(f"Семантическое сравнение для ключевого слова '{keyword}' в сцене {scene['id']}")
                    kw_emb = self._get_text_embedding(keyword)
                    transcript_emb = self._get_text_embedding(transcript)
                    
                    semantic_similarity = cosine_similarity(kw_emb, transcript_emb)[0][0]
                    sem_score = semantic_similarity * 0.5
                    result[keyword] = sem_score
                    
                    if sem_score > 0.25:  # Логируем только значимые совпадения
                        logger.info(f"Семантическое сходство для ключевого слова '{keyword}': {semantic_similarity:.4f}, итоговая оценка: {sem_score:.4f}")
                else:
                    result[keyword] = 0.0
        
        logger.info(f"Найдено {len([k for k, v in result.items() if v > 0.25])} значимых совпадений ключевых слов для сцены {scene['id']}")
        return result 