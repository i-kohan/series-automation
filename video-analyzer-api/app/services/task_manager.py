import os
import json
import logging
import threading
import glob
from datetime import datetime
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

# Словарь для хранения статусов задач
_task_status = {}
_task_lock = threading.Lock()
_RESULTS_DIR = "/app/shared-data/results"
_SCENES_WITH_AUDIO_DIR = "/app/shared-data/scenes-with-audio"
_SCENES_WITH_FRAMES_DIR = "/app/shared-data/scenes-with-frames"
_AUDIO_CHECKPOINTS_DIR = "/app/shared-data/audio-checkpoints"
_FRAME_CHECKPOINTS_DIR = "/app/shared-data/frame-checkpoints"

def init_task_status_from_files():
    """
    Инициализирует статусы задач из сохраненных файлов результатов.
    Вызывается при запуске сервера.
    """
    try:
        # Создаем каталоги для результатов, если они не существуют
        os.makedirs(_RESULTS_DIR, exist_ok=True)
        os.makedirs(_SCENES_WITH_AUDIO_DIR, exist_ok=True)
        os.makedirs(_SCENES_WITH_FRAMES_DIR, exist_ok=True)
        os.makedirs(_AUDIO_CHECKPOINTS_DIR, exist_ok=True)
        os.makedirs(_FRAME_CHECKPOINTS_DIR, exist_ok=True)
        
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
        
def save_result(task_id: str, result: Dict[str, Any]) -> None:
    """
    Сохраняет результаты анализа в JSON-файл и обновляет статус задачи.
    
    Args:
        task_id: Идентификатор задачи
        result: Результаты анализа
    """
    try:
        # Сохраняем результаты в JSON-файл
        result_path = os.path.join(_RESULTS_DIR, f"{task_id}.json")
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        # Обновляем статус как "завершено" и включаем результаты
        with _task_lock:
            _task_status[task_id] = {
                "status": "completed",
                "result": result,
                "message": "Анализ видео успешно завершен",
                "progress": 1.0,
                "last_updated": datetime.now().isoformat()
            }
        
        logger.info(f"Результаты задачи {task_id} сохранены в {result_path}")
        
    except Exception as e:
        logger.error(f"Ошибка при сохранении результатов для задачи {task_id}: {str(e)}")
        set_task_status(task_id, "error", f"Ошибка при сохранении результатов: {str(e)}", 0.0)

def save_scenes_with_audio(task_id: str, scenes_with_audio: List[Dict[str, Any]]) -> None:
    """
    Сохраняет результаты анализа аудио сцен в JSON-файл.
    
    Args:
        task_id: Идентификатор задачи
        scenes_with_audio: Список сцен с результатами аудио-анализа
    """
    try:
        # Создаем директорию, если она не существует
        os.makedirs(_SCENES_WITH_AUDIO_DIR, exist_ok=True)
        
        # Сохраняем результаты в JSON-файл
        output_path = os.path.join(_SCENES_WITH_AUDIO_DIR, f"{task_id}.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(scenes_with_audio, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Scenes with audio analysis for task {task_id} saved to {output_path}")
        
    except Exception as e:
        logger.error(f"Ошибка при сохранении аудио-анализа сцен для задачи {task_id}: {str(e)}")

def save_scenes_with_frames(task_id: str, scenes_with_frames: List[Dict[str, Any]]) -> None:
    """
    Сохраняет результаты анализа кадров сцен в JSON-файл.
    
    Args:
        task_id: Идентификатор задачи
        scenes_with_frames: Список сцен с результатами анализа кадров
    """
    try:
        # Создаем директорию, если она не существует
        os.makedirs(_SCENES_WITH_FRAMES_DIR, exist_ok=True)
        
        # Сохраняем результаты в JSON-файл
        output_path = os.path.join(_SCENES_WITH_FRAMES_DIR, f"{task_id}.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(scenes_with_frames, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Scenes with frame analysis for task {task_id} saved to {output_path}")
        
    except Exception as e:
        logger.error(f"Ошибка при сохранении анализа кадров сцен для задачи {task_id}: {str(e)}")

def save_audio_checkpoint(task_id: str, scene_id: str, audio_result: Dict[str, Any]) -> None:
    """
    Сохраняет результат анализа аудио для одной сцены
    
    Args:
        task_id: Идентификатор задачи
        scene_id: Идентификатор сцены
        audio_result: Результат анализа аудио
    """
    try:
        # Создаем директорию, если она не существует
        os.makedirs(_AUDIO_CHECKPOINTS_DIR, exist_ok=True)
        
        # Формируем имя файла чекпоинта
        filename = f"{task_id}_{scene_id}.json"
        filepath = os.path.join(_AUDIO_CHECKPOINTS_DIR, filename)
        
        # Добавляем метаданные к результату
        result_with_meta = audio_result.copy()
        result_with_meta['_meta'] = {
            'task_id': task_id,
            'scene_id': scene_id,
            'timestamp': datetime.now().isoformat()
        }
        
        # Сохраняем чекпоинт
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result_with_meta, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Saved audio analysis checkpoint to {filepath}")
    except Exception as e:
        logger.error(f"Error saving audio checkpoint for task_id={task_id}, scene_id={scene_id}: {str(e)}")

def load_audio_checkpoint(task_id: str, scene_id: str) -> Optional[Dict[str, Any]]:
    """
    Загружает сохраненный результат анализа аудио для сцены, если он существует
    
    Args:
        task_id: Идентификатор задачи
        scene_id: Идентификатор сцены
        
    Returns:
        Результат анализа аудио или None, если чекпоинт не найден
    """
    try:
        # Формируем имя файла чекпоинта
        filename = f"{task_id}_{scene_id}.json"
        filepath = os.path.join(_AUDIO_CHECKPOINTS_DIR, filename)
        
        # Проверяем существование файла
        if not os.path.exists(filepath):
            return None
        
        # Загружаем чекпоинт
        with open(filepath, 'r', encoding='utf-8') as f:
            checkpoint = json.load(f)
        
        # Удаляем метаданные перед возвратом
        if '_meta' in checkpoint:
            del checkpoint['_meta']
            
        logger.info(f"Loaded audio checkpoint for task_id={task_id}, scene_id={scene_id}")
        return checkpoint
    except Exception as e:
        logger.error(f"Error loading audio checkpoint for task_id={task_id}, scene_id={scene_id}: {str(e)}")
        return None

def save_frame_checkpoint(task_id: str, scene_id: str, frame_result: Dict[str, Any]) -> None:
    """
    Сохраняет результат анализа кадров для одной сцены
    
    Args:
        task_id: Идентификатор задачи
        scene_id: Идентификатор сцены
        frame_result: Результат анализа кадров
    """
    try:
        # Создаем директорию, если она не существует
        os.makedirs(_FRAME_CHECKPOINTS_DIR, exist_ok=True)
        
        # Формируем имя файла чекпоинта
        filename = f"{task_id}_{scene_id}.json"
        filepath = os.path.join(_FRAME_CHECKPOINTS_DIR, filename)
        
        # Добавляем метаданные к результату
        result_with_meta = frame_result.copy()
        result_with_meta['_meta'] = {
            'task_id': task_id,
            'scene_id': scene_id,
            'timestamp': datetime.now().isoformat()
        }
        
        # Сохраняем чекпоинт
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result_with_meta, f, ensure_ascii=False, indent=2)
            
        logger.info(f"Saved frame analysis checkpoint to {filepath}")
    except Exception as e:
        logger.error(f"Error saving frame checkpoint for task_id={task_id}, scene_id={scene_id}: {str(e)}")

def load_frame_checkpoint(task_id: str, scene_id: str) -> Optional[Dict[str, Any]]:
    """
    Загружает сохраненный результат анализа кадров для сцены, если он существует
    
    Args:
        task_id: Идентификатор задачи
        scene_id: Идентификатор сцены
        
    Returns:
        Результат анализа кадров или None, если чекпоинт не найден
    """
    try:
        # Формируем имя файла чекпоинта
        filename = f"{task_id}_{scene_id}.json"
        filepath = os.path.join(_FRAME_CHECKPOINTS_DIR, filename)
        
        # Проверяем существование файла
        if not os.path.exists(filepath):
            return None
        
        # Загружаем чекпоинт
        with open(filepath, 'r', encoding='utf-8') as f:
            checkpoint = json.load(f)
        
        # Удаляем метаданные перед возвратом
        if '_meta' in checkpoint:
            del checkpoint['_meta']
            
        logger.info(f"Loaded frame checkpoint for task_id={task_id}, scene_id={scene_id}")
        return checkpoint
    except Exception as e:
        logger.error(f"Error loading frame checkpoint for task_id={task_id}, scene_id={scene_id}: {str(e)}")
        return None 