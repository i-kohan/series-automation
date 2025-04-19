import os
import json
import time
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import threading
import uuid
import glob

# Импортируем библиотеки для анализа видео
from scenedetect import detect, ContentDetector, SceneManager, StatsManager
from scenedetect.video_stream import VideoStream
from moviepy.editor import VideoFileClip

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Словарь для хранения статусов задач
_task_status = {}
_task_lock = threading.Lock()
_RESULTS_DIR = "/app/shared-data/results"

def init_task_status_from_files():
    """
    Инициализирует статусы задач из сохраненных файлов результатов.
    Вызывается при запуске сервера.
    """
    try:
        # Создаем каталог для результатов, если он не существует
        os.makedirs(_RESULTS_DIR, exist_ok=True)
        
        # Ищем все JSON файлы в каталоге результатов
        result_files = glob.glob(os.path.join(_RESULTS_DIR, "*.json"))
        
        logger.info(f"Найдено {len(result_files)} файлов с результатами анализа")
        
        for file_path in result_files:
            try:
                # Извлекаем task_id из имени файла
                task_id = os.path.basename(file_path).split('.')[0]
                
                # Загружаем содержимое файла
                with open(file_path, 'r', encoding='utf-8') as f:
                    result = json.load(f)
                
                # Устанавливаем статус как завершенный
                with _task_lock:
                    _task_status[task_id] = {
                        "status": "completed",
                        "result": result,
                        "message": "Анализ завершен. Загружено из сохраненного файла.",
                        "progress": 1.0,
                        "last_updated": datetime.now().isoformat()
                    }
                
                logger.info(f"Загружены результаты для задачи {task_id}")
            
            except Exception as e:
                logger.error(f"Ошибка при загрузке результатов из файла {file_path}: {str(e)}")
    
    except Exception as e:
        logger.error(f"Ошибка при инициализации статусов задач: {str(e)}")

def get_analysis_status(task_id: str) -> Dict[str, Any]:
    """Получить статус задачи анализа"""
    with _task_lock:
        if task_id not in _task_status:
            # Проверяем, есть ли сохраненный файл результатов для этой задачи
            result_path = os.path.join(_RESULTS_DIR, f"{task_id}.json")
            if os.path.exists(result_path):
                try:
                    with open(result_path, 'r', encoding='utf-8') as f:
                        result = json.load(f)
                    
                    # Устанавливаем статус как завершенный
                    _task_status[task_id] = {
                        "status": "completed",
                        "result": result,
                        "message": "Анализ завершен. Загружено из сохраненного файла.",
                        "progress": 1.0,
                        "last_updated": datetime.now().isoformat()
                    }
                    return _task_status[task_id]
                except Exception as e:
                    logger.error(f"Ошибка при загрузке результатов для задачи {task_id}: {str(e)}")
            
            return {"status": "not_found", "message": "Задача не найдена"}
        
        return _task_status[task_id]

def set_task_status(task_id: str, status: str, message: str = "", progress: float = 0.0) -> None:
    """Установить статус задачи анализа"""
    with _task_lock:
        _task_status[task_id] = {
            "status": status,
            "message": message,
            "progress": progress,
            "last_updated": datetime.now().isoformat()
        }

def detect_scenes(video_path: str) -> List[Dict[str, Any]]:
    """
    Обнаружение сцен в видео с помощью SceneDetect
    """
    logger.info(f"Detecting scenes for {video_path}")
    
    try:
        # Используем только функцию detect без создания VideoStream
        scene_list = detect(video_path, ContentDetector(threshold=27.0))
        
        logger.info(f"Обнаружено {len(scene_list)} сцен")
        
        # Преобразуем сцены в список словарей с временными метками
        scenes = []
        for i, scene in enumerate(scene_list):
            start_frame = scene[0].get_frames()
            end_frame = scene[1].get_frames()
            start_time = scene[0].get_seconds()
            end_time = scene[1].get_seconds()
            duration = end_time - start_time
            
            scenes.append({
                "id": f"scene_{i + 1}",
                "start_frame": start_frame,
                "end_frame": end_frame,
                "start_time": start_time,
                "end_time": end_time,
                "duration": duration
            })
        
        return scenes
    
    except Exception as e:
        logger.error(f"Error detecting scenes: {str(e)}")
        return []

def group_scenes_into_storylines(scenes: List[Dict[str, Any]], num_storylines: int = 3) -> List[Dict[str, Any]]:
    """
    Группировка сцен в сюжетные линии.
    
    В этой упрощенной версии:
    1. Сортируем сцены по длительности (предполагая, что более длинные сцены важнее)
    2. Выбираем top N сцен, где N - желаемое количество сюжетных линий
    3. Для каждой выбранной сцены пытаемся найти соседние сцены, которые могут быть частью 
       той же сюжетной линии
    """
    # Если сцен меньше, чем запрошенных сюжетных линий, просто возвращаем все
    if len(scenes) <= num_storylines:
        storylines = []
        for i, scene in enumerate(scenes):
            storyline_scenes = [scene]
            start_time = scene["start_time"]
            end_time = scene["end_time"]
            duration = scene["duration"]
            
            storylines.append({
                "id": f"storyline_{i + 1}",
                "name": f"Сюжетная линия {i + 1}",
                "description": f"Сюжет, состоящий из одной сцены длительностью {duration:.1f} секунд",
                "scenes": storyline_scenes,
                "duration": duration,
                "start_time": start_time,
                "end_time": end_time
            })
        return storylines
    
    # Сортируем сцены по длительности (от самых длинных)
    sorted_scenes = sorted(scenes, key=lambda s: s["duration"], reverse=True)
    
    # Берем N самых длинных сцен как базовые для сюжетных линий
    key_scenes = sorted_scenes[:num_storylines]
    
    # Для каждой ключевой сцены, находим близкие сцены по времени
    storylines = []
    for i, key_scene in enumerate(key_scenes):
        key_start = key_scene["start_time"]
        key_end = key_scene["end_time"]
        
        # Определяем "радиус" близости как определенный процент от длительности всего видео
        # (предполагая, что общая длительность - это конец последней сцены)
        video_duration = scenes[-1]["end_time"]
        proximity_radius = video_duration * 0.1  # 10% от длительности видео
        
        # Находим сцены, близкие к ключевой
        storyline_scenes = [key_scene]
        for scene in scenes:
            # Пропускаем саму ключевую сцену
            if scene["id"] == key_scene["id"]:
                continue
            
            # Проверяем близость сцены к ключевой
            if (abs(scene["start_time"] - key_end) < proximity_radius or 
                abs(scene["end_time"] - key_start) < proximity_radius):
                storyline_scenes.append(scene)
        
        # Сортируем сцены в сюжетной линии по времени начала
        storyline_scenes.sort(key=lambda s: s["start_time"])
        
        # Вычисляем общую длительность и время начала/конца сюжетной линии
        start_time = storyline_scenes[0]["start_time"]
        end_time = storyline_scenes[-1]["end_time"]
        duration = end_time - start_time
        
        storylines.append({
            "id": f"storyline_{i + 1}",
            "name": f"Сюжетная линия {i + 1}",
            "description": f"Сюжет длительностью {duration:.1f} секунд, включающий {len(storyline_scenes)} сцен",
            "scenes": storyline_scenes,
            "duration": duration,
            "start_time": start_time,
            "end_time": end_time
        })
    
    return storylines

def analyze_video(video_path: str, task_id: str, num_storylines: int = 3) -> None:
    """
    Анализ видео и выделение сюжетных линий.
    Сохраняет результаты анализа в JSON-файл.
    """
    try:
        set_task_status(task_id, "processing", "Начинаем анализ видео...")
        start_time = time.time()
        
        # Получаем информацию о видеофайле
        logger.info(f"Analyzing video: {video_path}")
        set_task_status(task_id, "processing", "Извлечение метаданных видео...", 0.1)
        
        # Используем moviepy для получения длительности
        with VideoFileClip(video_path) as video:
            duration = video.duration
            fps = video.fps
            size = video.size
        
        # Обнаружение сцен
        set_task_status(task_id, "processing", "Обнаружение сцен...", 0.2)
        scenes = detect_scenes(video_path)
        
        if not scenes:
            set_task_status(task_id, "error", "Не удалось обнаружить сцены в видео")
            return
        
        # Группируем сцены в сюжетные линии
        set_task_status(task_id, "processing", "Группировка сцен в сюжетные линии...", 0.8)
        storylines = group_scenes_into_storylines(scenes, num_storylines)
        
        # Формируем окончательный результат
        video_filename = os.path.basename(video_path)
        result = {
            "video_filename": video_filename,
            "duration": duration,
            "total_scenes": len(scenes),
            "storylines": storylines,
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "fps": fps,
                "size": size,
                "analysis_time_seconds": time.time() - start_time
            }
        }
        
        # Сохраняем результат в файл
        os.makedirs(_RESULTS_DIR, exist_ok=True)
        result_path = os.path.join(_RESULTS_DIR, f"{task_id}.json")
        
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Analysis completed and saved to {result_path}")
        
        # Обновляем статус задачи с результатом
        with _task_lock:
            _task_status[task_id] = {
                "status": "completed",
                "result": result,
                "message": f"Анализ завершен. Обнаружено {len(scenes)} сцен и {len(storylines)} сюжетных линий.",
                "progress": 1.0,
                "last_updated": datetime.now().isoformat()
            }
    
    except Exception as e:
        logger.error(f"Error analyzing video: {str(e)}")
        set_task_status(task_id, "error", f"Ошибка при анализе видео: {str(e)}")

# Инициализируем статусы задач при импорте модуля
init_task_status_from_files() 