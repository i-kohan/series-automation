import os
import logging
import tempfile
import torch
from faster_whisper import WhisperModel
import librosa
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from moviepy.editor import VideoFileClip

from app.services.base_analyzer import BaseAnalyzer

logger = logging.getLogger(__name__)

class AudioAnalyzer(BaseAnalyzer):
    """
    Анализатор аудиодорожки видео, оптимизированный для русского языка.
    """
    
    def __init__(self, model_size: str = "large-v3", language: Optional[str] = "ru"):
        """
        Инициализация моделей для анализа аудио с оптимизацией для русского языка
        
        Args:
            model_size: Размер модели Whisper ("tiny", "base", "small", "medium", "large", "large-v3")
            language: Язык для Whisper модели (по умолчанию "ru" для русского)
        """
        logger.info(f"Initializing Russian-optimized AudioAnalyzer with model_size={model_size}, language={language}...")
        self.model_size = model_size
        self.language = language
        
        try:
            # Используем GPU, если доступен, иначе CPU с INT8 квантизацией
            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "int8"
            
            logger.info(f"Using device: {device} with compute_type: {compute_type}")
            self.whisper_model = WhisperModel(model_size, device=device, compute_type=compute_type)
            logger.info(f"Faster Whisper model '{model_size}' loaded successfully")
        except Exception as e:
            logger.error(f"Error loading Faster Whisper model: {str(e)}")
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
        # Извлекаем необходимые параметры
        video_path = data.get('video_path')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        # Проверяем наличие всех необходимых параметров
        if not self._validate_input_parameters(video_path, start_time, end_time):
            return self._create_empty_result()
        
        # Логируем информацию о начале анализа
        duration = end_time - start_time
        logger.info(f"Analyzing audio segment {start_time:.2f}s - {end_time:.2f}s (duration: {duration:.2f}s)")
        logger.info(f"Extracting audio from {video_path} ({start_time:.2f}s - {end_time:.2f}s)")
        
        # Извлекаем аудио сегмент
        try:
            audio_data, sr = self._extract_audio_segment(video_path, start_time, end_time)
            
            if audio_data is None:
                logger.error("Failed to extract audio segment")
                return self._create_empty_result()
            
            # Анализируем извлечённый аудио сегмент
            return self._analyze_audio_segment(audio_data, sr)
            
        except Exception as e:
            logger.error(f"Error during audio analysis: {str(e)}")
            return self._create_empty_result()
    
    def analyze_scene_audio(self, video_path: str, start_time: float, end_time: float) -> Dict[str, Any]:
        """
        Удобный метод для анализа аудио сцены (обертка над analyze)
        """
        return self.analyze({
            'video_path': video_path,
            'start_time': start_time,
            'end_time': end_time
        })
    
    def _validate_input_parameters(self, video_path: str, start_time: Optional[float], 
                                   end_time: Optional[float]) -> bool:
        """Проверяет валидность входных параметров"""
        if not all([video_path, start_time is not None, end_time is not None]):
            logger.error("Missing required parameters for AudioAnalyzer.analyze")
            return False
        return True
    
    def _create_empty_result(self) -> Dict[str, Any]:
        """Создаёт пустой результат анализа"""
        return {
            "transcript": None,
            "language": None,
            "segments": [],
            "emotions": None,
            "speakers": None,
            "audio_features": None
        }
    
    def _analyze_audio_segment(self, audio_data: np.ndarray, sr: int) -> Dict[str, Any]:
        """Анализирует аудио сегмент и возвращает полный результат"""
        # Получаем транскрипцию и определяем язык с помощью Whisper
        transcript_result = self._transcribe_audio(audio_data, sr)
        
        # Анализируем аудио-характеристики
        audio_features = self._extract_audio_features(audio_data, sr)
        
        return {
            "transcript": transcript_result.get("transcript"),
            "language": transcript_result.get("language"),
            "segments": transcript_result.get("segments", []),
            "emotions": None,
            "speakers": None,
            "audio_features": audio_features
        }
    
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
                    # Используем пониженную частоту дискретизации (16кГц достаточно для распознавания речи)
                    audio_data, sr = librosa.load(temp_audio_file.name, sr=16000)
                    return audio_data, sr
        except Exception as e:
            logger.error(f"Error extracting audio segment: {str(e)}")
            return None, 0
    
    def _transcribe_audio(self, audio_data: np.ndarray, sr: int) -> Dict[str, Any]:
        """Транскрибирует аудио в текст используя модель Faster Whisper с оптимизацией для русского языка"""
        if self.whisper_model is None:
            return {"transcript": None, "language": None, "segments": []}
        
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as temp_file:
                import soundfile as sf
                sf.write(temp_file.name, audio_data, sr)
                
                # Опции транскрипции, оптимизированные для русского языка
                beam_size = 5
                temperature = 0.0  # Более детерминистический результат
                condition_on_previous_text = True  # Улучшает связность длинных фрагментов
                vad_filter = True  # Фильтрация тишины
                
                # Выполняем транскрипцию с русским языком
                segments, info = self.whisper_model.transcribe(
                    temp_file.name,
                    language=self.language,  # Указываем русский язык
                    beam_size=beam_size,
                    temperature=temperature,
                    condition_on_previous_text=condition_on_previous_text,
                    vad_filter=vad_filter,
                    vad_parameters={"min_silence_duration_ms": 500}  # Более агрессивная фильтрация тишины
                )
                
                # Собираем транскрипцию из сегментов
                transcript = ""
                simplified_segments = []
                
                for segment in segments:
                    transcript += segment.text + " "
                    simplified_segments.append({
                        "start": segment.start,
                        "end": segment.end,
                        "text": segment.text.strip()
                    })
                
                return {
                    "transcript": transcript.strip(),
                    "language": info.language,
                    "segments": simplified_segments
                }
        except Exception as e:
            logger.error(f"Error transcribing audio: {str(e)}")
            return {"transcript": None, "language": None, "segments": []}
    
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