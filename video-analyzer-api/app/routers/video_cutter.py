import os
import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

from app.services.video_cutter import VideoCutter

router = APIRouter(
    prefix="/api/video-cutter",
    tags=["video-cutter"],
    responses={404: {"description": "Not found"}}
)

logger = logging.getLogger(__name__)

@router.get("/cut-by-storylines/{episode_id}")
async def cut_video_by_storylines(episode_id: str, filename: str) -> Dict[str, Any]:
    """
    Нарезает видео на сюжеты на основе результатов сопоставления
    
    Args:
        episode_id: ID эпизода
        filename: Имя файла видео
        
    Returns:
        Информация о созданных видеофайлах с сюжетами
    """
    logger.info(f"Запрос на нарезку видео {filename} для эпизода {episode_id}")
    
    try:
        # Создаем экземпляр сервиса
        cutter = VideoCutter()
        
        # Выполняем нарезку видео
        result = cutter.cut_video_by_storylines(episode_id, filename)
        
        # Если произошла ошибка
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
            
        # Возвращаем результат
        return {
            "status": "success",
            "message": f"Видео успешно нарезано на {result['storylines_processed']} сюжетов",
            "result": result
        }
        
    except Exception as e:
        logger.error(f"Ошибка при нарезке видео: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при нарезке видео: {str(e)}") 