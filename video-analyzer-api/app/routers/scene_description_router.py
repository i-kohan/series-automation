import json
import os
import logging
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.scene_description_generator import SceneDescriptionGenerator

# Инициализация логгера
logger = logging.getLogger(__name__)

scene_description_generator = SceneDescriptionGenerator()

# Создаем роутер
router = APIRouter(
    prefix="/api/scene-descriptions",
    tags=["scene-descriptions"],
    responses={404: {"description": "Not found"}},
)

# Модели данных для запросов/ответов
class SceneDescriptionRequest(BaseModel):
    scene_ids: Optional[List[str]] = None
    max_scenes: Optional[int] = 10
    video_name: str = "360"  # Добавляем параметр для имени видео

class SceneDescriptionResponse(BaseModel):
    status: str
    message: str
    descriptions: Dict[str, str] = {}

def get_data_root() -> str:
    """
    Возвращает корневую директорию для данных, учитывая разницу
    между локальной разработкой и Docker окружением
    """
    # Проверяем, есть ли путь в Docker
    docker_path = "/app/shared-data"
    if os.path.exists(docker_path):
        return docker_path
    
    # Возвращаем относительный путь для локальной разработки
    return "../shared-data"

def clean_scene_data(scene: Dict[str, Any]) -> Dict[str, Any]:
    """
    Очищает данные сцены, оставляя только необходимые поля
    
    Args:
        scene: Исходные данные сцены
        
    Returns:
        Dict[str, Any]: Очищенные данные сцены
    """
    # Копируем только нужные поля
    cleaned_scene = {
        'id': scene.get('id'),
        'start_time': scene.get('start_time'),
        'end_time': scene.get('end_time'),
        'description': scene.get('description', '')
    }
    
    return cleaned_scene

def save_results(scenes: List[Dict[str, Any]], video_name: str):
    """
    Сохраняет результаты в JSON файл
    
    Args:
        scenes: Список сцен с описаниями
        video_name: Имя видео для имени файла
    """
    try:
        data_root = get_data_root()
        output_dir = os.path.join(data_root, "scenes-with-summary")
        os.makedirs(output_dir, exist_ok=True)
        
        # Очищаем данные сцен
        cleaned_scenes = [clean_scene_data(scene) for scene in scenes]
        
        output_file = os.path.join(output_dir, f"{video_name}.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(cleaned_scenes, f, ensure_ascii=False, indent=2)
        logger.info(f"Результаты сохранены в {output_file}")
    except Exception as e:
        logger.error(f"Ошибка при сохранении результатов: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении результатов: {str(e)}")

def load_scenes(scene_ids=None) -> List[Dict[str, Any]]:
    """
    Загружает сцены из правильного файла
    
    Args:
        scene_ids: Опциональный список ID сцен для фильтрации
    """
    try:
        data_root = get_data_root()
        scenes_path = os.path.join(data_root, "scenes-with-frames/frames_360.json")
        logger.info(f"Загрузка данных сцен из {scenes_path}")
        with open(scenes_path, "r", encoding="utf-8") as f:
            scenes_data = json.load(f)
        
        # Проверяем структуру сцен
        valid_scenes = []
        for scene in scenes_data:
            if 'id' not in scene:
                logger.warning("Найдена сцена без ID, пропускаю")
                continue
            
            if 'frame_analysis' not in scene or 'frame_info' not in scene['frame_analysis']:
                logger.warning(f"Сцена {scene.get('id')} не содержит информации о кадрах, пропускаю")
                continue
            
            # Проверяем, есть ли пути к кадрам
            frame_info = scene['frame_analysis']['frame_info']
            if not frame_info or not any('frame_path' in frame for frame in frame_info):
                logger.warning(f"Сцена {scene.get('id')} не содержит путей к кадрам, пропускаю")
                continue
            
            valid_scenes.append(scene)
        
        logger.info(f"Загружено {len(valid_scenes)} сцен с корректной структурой из {len(scenes_data)}")
        
        # Фильтруем сцены по ID, если указаны
        if scene_ids:
            valid_scenes = [scene for scene in valid_scenes if scene.get('id') in scene_ids]
            
        return valid_scenes
    except Exception as e:
        logger.error(f"Ошибка при загрузке сцен: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при загрузке сцен: {str(e)}")

@router.post("/generate", response_model=SceneDescriptionResponse)
async def generate_descriptions(request: SceneDescriptionRequest):
    """
    Генерирует описания для сцен (синхронный запрос)
    """
    try:
        start_time = time.time()
        logger.info("Запуск генерации описаний сцен")
        
        # Создание генератора описаний (это займёт время на загрузку модели)
        logger.info("Инициализация генератора описаний сцен (загрузка модели может занять несколько минут)")
        model_load_time = time.time() - start_time
        logger.info(f"Модель загружена за {model_load_time:.2f} секунд")

        # Загружаем сцены
        logger.info("Загрузка данных сцен")
        scenes = load_scenes(request.scene_ids)
        
        if not scenes:
            return {
                "status": "warning",
                "message": "Не найдено подходящих сцен для обработки",
                "descriptions": {}
            }
        
        # Ограничиваем количество сцен, если нужно
        if request.max_scenes and request.max_scenes < len(scenes):
            logger.info(f"Ограничение количества сцен до {request.max_scenes} (всего сцен: {len(scenes)})")
            scenes = scenes[:request.max_scenes]
        
        logger.info(f"Начало генерации описаний для {len(scenes)} сцен")
        
        # Генерируем описания
        generation_start = time.time()
        descriptions = scene_description_generator.generate_descriptions(scenes)
        generation_time = time.time() - generation_start
        
        # Добавляем описания к сценам
        for scene in scenes:
            scene_id = scene.get('id')
            if scene_id in descriptions:
                scene['description'] = descriptions[scene_id]
        
        # Сохраняем результаты
        save_results(scenes, request.video_name)
        
        total_time = time.time() - start_time
        logger.info(f"Генерация описаний успешно завершена для {len(descriptions)} сцен за {generation_time:.2f} сек.")
        logger.info(f"Общее время выполнения запроса: {total_time:.2f} сек.")
        
        return {
            "status": "success",
            "message": f"Сгенерированы описания для {len(descriptions)} сцен",
            "descriptions": descriptions
        }
    except Exception as e:
        logger.error(f"Ошибка при генерации описаний: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при генерации описаний: {str(e)}")

# Пример curl команды:
# curl -X POST "http://localhost:8000/api/scene-descriptions/generate" -H "Content-Type: application/json" -d '{"scene_ids": ["scene_1", "scene_2"], "max_scenes": 5, "video_name": "360"}'
