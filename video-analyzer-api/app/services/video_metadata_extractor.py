import logging
from typing import Dict, Any
from moviepy.editor import VideoFileClip

from app.services.base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)

class VideoMetadataExtractor(BaseAnalyzer):
    """
    Анализатор для извлечения метаданных видео (длительность, FPS, размер и т.д.)
    """
    
    def analyze(self, data: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        Извлекает метаданные видео.
        
        Args:
            data: Словарь данных, должен содержать ключ 'video_path'
            **kwargs: Дополнительные параметры
            
        Returns:
            Словарь с метаданными видео
        """
        video_path = data.get('video_path')
        if not video_path:
            logger.error("No video_path provided to VideoMetadataExtractor")
            return {"metadata": {}}
        
        logger.info(f"Extracting metadata for {video_path}")
        
        try:
            with VideoFileClip(video_path) as video:
                metadata = {
                    "duration": video.duration,
                    "fps": video.fps,
                    "size": video.size,
                    "filename": video_path.split('/')[-1],
                    "width": video.size[0],
                    "height": video.size[1],
                    "audio_present": video.audio is not None
                }
                
            logger.info(f"Extracted metadata: duration={metadata['duration']:.2f}s, fps={metadata['fps']}, size={metadata['size']}")
            return {"metadata": metadata}
        
        except Exception as e:
            logger.error(f"Error extracting video metadata: {str(e)}")
            return {"metadata": {}} 