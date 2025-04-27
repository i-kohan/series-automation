from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import os
import logging
from typing import List, Optional, Dict, Any

from app.services.analysis_pipeline import AnalysisPipeline
from app.services.task_manager import set_task_status, get_analysis_status, init_task_status_from_files, save_result
from app.routers import episode_matcher, video_cutter

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Функция для определения корневой директории данных
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

# Создание директорий для хранения данных
data_root = get_data_root()
os.makedirs(os.path.join(data_root, "sample-videos"), exist_ok=True)
os.makedirs(os.path.join(data_root, "results"), exist_ok=True)

# Создаем экземпляр пайплайна анализа
analysis_pipeline = AnalysisPipeline()

app = FastAPI(
    title="Video Analyzer API",
    description="API для анализа видеофайлов и выделения сюжетных линий",
    version="0.1.0"
)

# Подключаем роутеры
app.include_router(episode_matcher.router)
app.include_router(video_cutter.router)

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
    num_storylines: int = Field(default=3, ge=1, le=10, description="Количество сюжетных линий (от 1 до 10)")
    language: Optional[str] = Field(default=None, description="Язык видео для транскрипции (ISO код, напр. 'ru', 'en')")

class VideoAnalysisResponse(BaseModel):
    """Ответ с результатом запуска анализа"""
    task_id: str
    status: str
    message: str

class AnalysisStatusResponse(BaseModel):
    """Статус анализа"""
    status: str
    message: str
    progress: float = 0.0
    last_updated: str
    result: Optional[Dict[str, Any]] = None
    task_id: Optional[str] = None

def get_video_directory() -> str:
    """Получает директорию с видеофайлами"""
    return os.path.join(get_data_root(), "sample-videos")

@app.get("/")
async def root():
    """Проверка работоспособности API"""
    return {"status": "ok", "message": "Video Analyzer API is running"}

@app.get("/api/sample-videos")
async def list_sample_videos(video_dir: str = Depends(get_video_directory)):
    """Получение списка доступных тестовых видео"""
    if not os.path.exists(video_dir):
        return {"videos": []}
    
    video_files = [f for f in os.listdir(video_dir) 
                  if os.path.isfile(os.path.join(video_dir, f)) and 
                  f.lower().endswith(('.mp4', '.mov', '.avi', '.mkv'))]
    
    return {"videos": video_files}

@app.post("/api/analyze", response_model=VideoAnalysisResponse)
async def start_analysis(
    request: VideoAnalysisRequest, 
    background_tasks: BackgroundTasks,
    video_dir: str = Depends(get_video_directory)
):
    """Запуск анализа видео в фоновом режиме"""
    video_path = os.path.join(video_dir, request.filename)
    
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail=f"Файл {request.filename} не найден")
    
    # Генерируем ID задачи на основе имени файла и параметров
    task_id = generate_task_id(request)
    
    # Устанавливаем начальный статус
    set_task_status(task_id, "processing", "Анализ видео запущен в фоновом режиме", 0.0)
    
    # Запускаем анализ в фоновом режиме с переданными параметрами
    background_tasks.add_task(
        run_analysis_pipeline,
        video_path=video_path,
        task_id=task_id,
        num_storylines=request.num_storylines,
        language=request.language
    )
    
    return VideoAnalysisResponse(
        task_id=task_id,
        status="processing",
        message="Анализ видео запущен в фоновом режиме"
    )

@app.get("/api/analysis/{task_id}", response_model=AnalysisStatusResponse)
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

def generate_task_id(request: VideoAnalysisRequest) -> str:
    """Генерирует уникальный ID задачи на основе параметров запроса"""
    base_name = os.path.splitext(request.filename)[0]
    lang_part = f"_{request.language}" if request.language else ""
    return f"{base_name}_{request.num_storylines}{lang_part}"

def run_analysis_pipeline(video_path: str, task_id: str, num_storylines: int = 3, 
                         language: Optional[str] = None):
    """
    Функция для запуска анализа видео через пайплайн.
    Выполняется в фоновом режиме.
    
    Args:
        video_path: Путь к видеофайлу
        task_id: Идентификатор задачи
        num_storylines: Количество сюжетных линий
        language: Язык для транскрипции (если указан)
    """
    try:
        # Запускаем анализ через AnalysisPipeline
        result = analysis_pipeline.analyze(
            video_path=video_path,
            task_id=task_id,
            status_updater=set_task_status,
            num_storylines=num_storylines
        )
        
        if not result:
            set_task_status(task_id, "error", "Не удалось выполнить анализ видео", 0.0)
            return
        
        # Сохраняем результаты в файл и обновляем статус
        save_result(task_id, result)
        
        logger.info(f"Анализ видео {os.path.basename(video_path)} завершен")
        
    except Exception as e:
        logger.error(f"Error in run_analysis_pipeline: {str(e)}")
        set_task_status(task_id, "error", f"Ошибка при анализе видео: {str(e)}", 0.0)

# Инициализируем статусы задач при запуске
init_task_status_from_files()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 