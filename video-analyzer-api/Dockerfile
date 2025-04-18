FROM python:3.11-slim

WORKDIR /app

# Установка зависимостей для компиляции некоторых пакетов
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements.txt и устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование приложения
COPY . .

# Создание директорий для данных
RUN mkdir -p /app/shared-data/sample-videos /app/shared-data/results

# Открытие порта
EXPOSE 8000

# Команда по умолчанию, может быть переопределена в docker-compose
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"] 