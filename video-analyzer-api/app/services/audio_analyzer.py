import os
import logging
import tempfile
import torch
import whisper
import librosa
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from moviepy.editor import VideoFileClip

from app.services.base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)

class AudioAnalyzer(BaseAnalyzer):
    """
    Анализатор аудиодорожки видео, извлекает информацию из аудио.
    """
    
    def __init__(self, model_size: str = "small"):
        """
        Инициализация моделей для анализа аудио
        
        Args:
            model_size: Размер модели Whisper ("tiny", "base", "small", "medium", "large")
        """
        logger.info(f"Initializing AudioAnalyzer with model_size={model_size}...")
        try:
            self.whisper_model = whisper.load_model(model_size)
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Error loading Whisper model: {str(e)}")
            self.whisper_model = None
    
    def analyze(self, data: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        """
        Анализирует аудио для конкретной сцены видео
        
        Args:
            data: Словарь с данными, должен содержать:
                - video_path: Путь к видеофайлу
                - start_time: Начальное время сцены (в секундах)
                - end_time: Конечное время сцены (в секундах)
            **kwargs: Дополнительные параметры
            
        Returns:
            Словарь с результатами анализа аудио
        """
        video_path = data.get('video_path')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        if not all([video_path, start_time is not None, end_time is not None]):
            logger.error("Missing required parameters for AudioAnalyzer.analyze")
            return {
                "transcript": None,
                "language": None,
                "emotions": None,
                "speakers": None,
                "audio_features": None
            }
        
        logger.info(f"Analyzing audio for scene from {start_time:.2f}s to {end_time:.2f}s")
        
        # Извлекаем аудио для конкретной сцены из видео во временный файл
        audio_data, sr = self._extract_audio_segment(video_path, start_time, end_time)
        
        if audio_data is None:
            logger.error("Failed to extract audio segment")
            return {
                "transcript": None,
                "language": None,
                "emotions": None,
                "speakers": None,
                "audio_features": None
            }
        
        # Получаем транскрипцию и определяем язык с помощью Whisper
        transcript_result = self._transcribe_audio(audio_data, sr)
        
        # Анализируем аудио-характеристики
        audio_features = self._extract_audio_features(audio_data, sr)
        
        return {
            "transcript": transcript_result.get("transcript"),
            "language": transcript_result.get("language"),
            "emotions": None,
            "speakers": None,
            "audio_features": audio_features
        }
    
    def analyze_scene_audio(self, video_path: str, start_time: float, end_time: float) -> Dict[str, Any]:
        """
        Удобный метод для анализа аудио сцены (обертка над analyze)
        """
        return self.analyze({
            'video_path': video_path,
            'start_time': start_time,
            'end_time': end_time
        })
    
    def _extract_audio_segment(self, video_path: str, start_time: float, end_time: float) -> Tuple[Optional[np.ndarray], int]:
        """Извлекает аудиосегмент из видео для заданного временного диапазона"""
        try:
            with VideoFileClip(video_path) as video:
                segment = video.subclip(start_time, end_time)
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as temp_audio_file:
                    segment.audio.write_audiofile(
                        temp_audio_file.name, 
                        codec='pcm_s16le',
                        verbose=False, 
                        logger=None
                    )
                    audio_data, sr = librosa.load(temp_audio_file.name, sr=None)
                    return audio_data, sr
        except Exception as e:
            logger.error(f"Error extracting audio segment: {str(e)}")
            return None, 0
    
    def _transcribe_audio(self, audio_data: np.ndarray, sr: int) -> Dict[str, Any]:
        """Транскрибирует аудио в текст используя модель Whisper"""
        if self.whisper_model is None:
            return {"transcript": None, "language": None}
        
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as temp_file:
                import soundfile as sf
                sf.write(temp_file.name, audio_data, sr)
                result = self.whisper_model.transcribe(temp_file.name)
                return {
                    "transcript": result.get("text", "").strip(),
                    "language": result.get("language", "unknown")
                }
        except Exception as e:
            logger.error(f"Error transcribing audio: {str(e)}")
            return {"transcript": None, "language": None}
    
    def _extract_audio_features(self, audio_data: np.ndarray, sr: int) -> Dict[str, Any]:
        """Извлекает различные характеристики аудио"""
        try:
            features = {}
            # Среднее значение громкости (RMS энергии)
            features["rms_energy"] = float(np.mean(librosa.feature.rms(y=audio_data)[0]))
            # Спектральный центроид (яркость звука)
            centroids = librosa.feature.spectral_centroid(y=audio_data, sr=sr)[0]
            features["spectral_centroid_mean"] = float(np.mean(centroids))
            # Zero-crossing rate
            zcr = librosa.feature.zero_crossing_rate(audio_data)[0]
            features["zero_crossing_rate"] = float(np.mean(zcr))
            # Темп (BPM)
            tempo, _ = librosa.beat.beat_track(y=audio_data, sr=sr)
            features["tempo"] = float(tempo)
            return features
        except Exception as e:
            logger.error(f"Error extracting audio features: {str(e)}")
            return {} 