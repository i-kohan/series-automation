#!/usr/bin/env python3
"""
Скрипт для проверки наличия моделей в кэше и их загрузки при необходимости.
Запускается перед основным приложением.
"""

import os
import sys
import logging
import subprocess
import time
from pathlib import Path

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("model_checker")

# Получение переменных окружения с дефолтными значениями
def get_env(name, default):
    """Возвращает значение переменной окружения или значение по умолчанию"""
    return os.environ.get(name, default)

# Конфигурация моделей
MODELS = {
    "BLIP2": {
        "model_id": get_env("BLIP2_MODEL_NAME", "Salesforce/blip2-opt-2.7b"),
        "cache_path": os.path.join(os.environ.get("HF_HOME", "/root/.cache/huggingface"), 
                                  f"models--{get_env('BLIP2_MODEL_NAME', 'Salesforce/blip2-opt-2.7b').replace('/', '--')}")
    },
    "CLIP": {
        "model_id": get_env("VISION_MODEL_NAME", "openai/clip-vit-base-patch32"),
        "cache_path": os.path.join(os.environ.get("HF_HOME", "/root/.cache/huggingface"), 
                                  f"models--{get_env('VISION_MODEL_NAME', 'openai/clip-vit-base-patch32').replace('/', '--')}")
    },
    "RuBERT": {
        "model_id": "DeepPavlov/rubert-base-cased",
        "cache_path": os.path.join(os.environ.get("HF_HOME", "/root/.cache/huggingface"), 
                                  "models--DeepPavlov--rubert-base-cased")
    },
    "Whisper": {
        "model_id": get_env("WHISPER_MODEL_SIZE", "small"),
        "cache_path": os.path.join(os.environ.get("HF_HOME", "/root/.cache/huggingface"), 
                                  f"models--Systran--faster-whisper-{get_env('WHISPER_MODEL_SIZE', 'small')}")
    }
}

def check_model_exists(model_config):
    """Проверяет, существует ли модель в кэше"""
    cache_path = model_config["cache_path"]
    logger.info(f"Проверка модели {model_config['model_id']} в кэше {cache_path}")
    
    # Если есть директория модели - считаем что она существует
    model_dir = Path(cache_path)
    if model_dir.exists() and any(model_dir.glob("**/*")):
        logger.info(f"✅ Модель {model_config['model_id']} найдена в кэше")
        return True
    
    logger.warning(f"❌ Модель {model_config['model_id']} не найдена в кэше")
    return False

def load_blip2_model():
    """Загружает модель BLIP2"""
    start_time = time.time()
    model_id = MODELS["BLIP2"]["model_id"]
    logger.info(f"Загрузка модели BLIP2 {model_id} (это может занять несколько минут)...")
    
    try:
        import torch
        from transformers import Blip2Processor, Blip2ForConditionalGeneration
        
        # Определяем устройство и тип данных
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32
        
        logger.info(f"Загрузка процессора BLIP2...")
        processor = Blip2Processor.from_pretrained(model_id)
        
        logger.info(f"Загрузка модели BLIP2 на устройство {device}...")
        model = Blip2ForConditionalGeneration.from_pretrained(
            model_id,
            torch_dtype=dtype
        )
        
        elapsed_time = time.time() - start_time
        logger.info(f"✅ Модель BLIP2 успешно загружена за {elapsed_time:.2f} сек.")
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка при загрузке модели BLIP2: {str(e)}")
        return False

def load_clip_model():
    """Загружает модель CLIP"""
    start_time = time.time()
    model_id = MODELS["CLIP"]["model_id"]
    logger.info(f"Загрузка модели CLIP {model_id}...")
    
    try:
        import torch
        from transformers import CLIPProcessor, CLIPModel
        
        # Определяем устройство и тип данных
        device = get_env("VISION_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
        compute_type = get_env("VISION_COMPUTE_TYPE", "float16" if device == "cuda" else "float32")
        
        logger.info(f"Загрузка процессора CLIP...")
        processor = CLIPProcessor.from_pretrained(model_id)
        
        logger.info(f"Загрузка модели CLIP на устройство {device}...")
        model = CLIPModel.from_pretrained(
            model_id,
            device_map=device,
            torch_dtype=torch.float16 if compute_type == "float16" else torch.float32
        )
        
        elapsed_time = time.time() - start_time
        logger.info(f"✅ Модель CLIP успешно загружена за {elapsed_time:.2f} сек.")
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка при загрузке модели CLIP: {str(e)}")
        return False

def load_rubert_model():
    """Загружает модель RuBERT"""
    start_time = time.time()
    model_id = MODELS["RuBERT"]["model_id"]
    logger.info(f"Загрузка модели RuBERT {model_id}...")
    
    try:
        import torch
        from transformers import AutoTokenizer, AutoModel
        
        logger.info(f"Загрузка токенизатора RuBERT...")
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        
        logger.info(f"Загрузка модели RuBERT...")
        model = AutoModel.from_pretrained(model_id)
        
        elapsed_time = time.time() - start_time
        logger.info(f"✅ Модель RuBERT успешно загружена за {elapsed_time:.2f} сек.")
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка при загрузке модели RuBERT: {str(e)}")
        return False

def load_whisper_model():
    """Загружает модель Whisper"""
    start_time = time.time()
    model_size = MODELS["Whisper"]["model_id"]
    
    try:
        import torch
        
        device = get_env("WHISPER_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
        compute_type = get_env("WHISPER_COMPUTE_TYPE", "float16" if device == "cuda" else "int8")
        
        logger.info(f"Загрузка модели Whisper {model_size} на устройство {device}...")
        
        from faster_whisper import WhisperModel
        
        model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
            download_root=os.environ.get("HF_HOME", "/root/.cache/huggingface")
        )
        
        elapsed_time = time.time() - start_time
        logger.info(f"✅ Модель Whisper успешно загружена за {elapsed_time:.2f} сек.")
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка при загрузке модели Whisper: {str(e)}")
        return False

def main():
    """Основная функция для проверки и загрузки моделей"""
    logger.info("Начало проверки моделей...")
    
    # Проверка доступности CUDA
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        if cuda_available:
            cuda_device = torch.cuda.get_device_name(0)
            logger.info(f"CUDA доступна: {cuda_device}")
        else:
            logger.warning("CUDA недоступна, будет использоваться CPU")
    except:
        logger.warning("Невозможно определить доступность CUDA")
    
    # Проверка и загрузка моделей по очереди
    models_to_check = [
        ("BLIP2", load_blip2_model),
        ("CLIP", load_clip_model),
        ("RuBERT", load_rubert_model),
        ("Whisper", load_whisper_model)
    ]
    
    for model_name, load_func in models_to_check:
        if not check_model_exists(MODELS[model_name]):
            logger.info(f"Начинаю загрузку модели {model_name}...")
            if not load_func():
                logger.error(f"Не удалось загрузить модель {model_name}.")
                # Продолжаем с другими моделями, не останавливаемся
    
    # Все проверки пройдены, запускаем основное приложение
    logger.info("✅ Проверка моделей завершена. Запуск основного приложения...")
    
    # Запускаем основное приложение с переданными параметрами
    if len(sys.argv) > 1:
        command = sys.argv[1:]
        logger.info(f"Запуск команды: {' '.join(command)}")
        os.execvp(command[0], command)
    else:
        logger.warning("Не указана команда для запуска. Завершение работы.")

if __name__ == "__main__":
    main() 