FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

WORKDIR /app

# Установка необходимых зависимостей для видео и аудио анализа
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    python3-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    ffmpeg \
    libsndfile1 \
    git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements.txt и устанавливаем зависимости
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Создание директорий для моделей и кэша
RUN mkdir -p /root/.cache/torch/pyannote /root/.cache/huggingface

# Создаем том для кеша моделей huggingface
VOLUME /root/.cache/huggingface

# Переменные для настройки кэша моделей
ENV HF_HOME=/root/.cache/huggingface

# Копирование приложения
COPY . .

# Создание необходимых директорий для данных
RUN mkdir -p /app/shared-data/sample-videos \
    /app/shared-data/results \
    /app/shared-data/audio-checkpoints \
    /app/shared-data/frame-checkpoints \
    /app/shared-data/scenes-with-audio \
    /app/shared-data/scenes-with-frames

# Открытие порта
EXPOSE 8000

# Команда по умолчанию 
CMD ["python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"] 