from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import json
import logging
from typing import List, Optional

from app.services.video_analyzer import analyze_video, get_analysis_status

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Создание директорий для хранения данных
os.makedirs("/app/shared-data/sample-videos", exist_ok=True)
os.makedirs("/app/shared-data/results", exist_ok=True)

app = FastAPI(
    title="Video Analyzer API",
    description="API для анализа видеофайлов и выделения сюжетных линий",
    version="0.1.0"
)

# Настройка CORS для взаимодействия с фронтендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoAnalysisRequest(BaseModel):
    """Запрос на анализ видео"""
    filename: str
    num_storylines: int = 3

class VideoAnalysisResponse(BaseModel):
    """Ответ с результатом запуска анализа"""
    task_id: str
    status: str
    message: str

@app.get("/")
async def root():
    """Проверка работоспособности API"""
    return {"status": "ok", "message": "Video Analyzer API is running"}

@app.get("/api/sample-videos")
async def list_sample_videos():
    """Получение списка доступных тестовых видео"""
    video_dir = "/app/shared-data/sample-videos"
    
    if not os.path.exists(video_dir):
        return {"videos": []}
    
    video_files = [f for f in os.listdir(video_dir) 
                  if os.path.isfile(os.path.join(video_dir, f)) and 
                  f.lower().endswith(('.mp4', '.mov', '.avi', '.mkv'))]
    
    return {"videos": video_files}

@app.post("/api/analyze", response_model=VideoAnalysisResponse)
async def start_analysis(request: VideoAnalysisRequest, background_tasks: BackgroundTasks):
    """Запуск анализа видео в фоновом режиме"""
    video_path = f"/app/shared-data/sample-videos/{request.filename}"
    
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail=f"Файл {request.filename} не найден")
    
    # Генерируем ID задачи на основе имени файла
    task_id = f"{os.path.splitext(request.filename)[0]}_{request.num_storylines}"
    
    # Запускаем анализ в фоновом режиме
    background_tasks.add_task(
        analyze_video,
        video_path=video_path,
        task_id=task_id,
        num_storylines=request.num_storylines
    )
    
    return VideoAnalysisResponse(
        task_id=task_id,
        status="processing",
        message="Анализ видео запущен в фоновом режиме"
    )

@app.get("/api/analysis/{task_id}")
async def get_analysis_result(task_id: str):
    """Получение результатов анализа или статуса выполнения"""
    status_info = get_analysis_status(task_id)
    
    # Если у нас есть информация о задаче, возвращаем её напрямую
    if status_info["status"] != "not_found":
        return status_info
    
    # Иначе возвращаем что задача не найдена
    return JSONResponse(
        status_code=404,
        content={"status": "not_found", "message": "Задача не найдена"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 