import os
import json
import logging
from typing import Dict, Any, List
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

class VideoCutter:
    """
    Сервис для нарезки видео на сюжеты на основе результатов сопоставления
    """
    
    def __init__(self):
        """Инициализация сервиса"""
        self.data_root = self._get_data_root()
        self._check_ffmpeg()
        self.target_duration = 180  # Целевая продолжительность в секундах (3 минуты)
        
    def _get_data_root(self) -> str:
        """Получает корневую директорию данных"""
        data_root = os.environ.get("SHARED_DATA_DIR", "/app/shared-data")
        return data_root
    
    def _check_ffmpeg(self) -> None:
        """Проверяет наличие ffmpeg в системе"""
        try:
            # Проверяем, доступен ли ffmpeg
            result = subprocess.run(["ffmpeg", "-version"], 
                                   stdout=subprocess.PIPE, 
                                   stderr=subprocess.PIPE,
                                   check=False)
            if result.returncode != 0:
                logger.warning("ffmpeg не найден или не работает корректно!")
            else:
                logger.info("ffmpeg успешно обнаружен в системе.")
        except Exception as e:
            logger.error(f"Ошибка при проверке ffmpeg: {str(e)}")
    
    def cut_video_by_storylines(self, episode_id: str, video_filename: str) -> Dict[str, Any]:
        """
        Нарезает видео на отдельные сюжеты на основе результатов сопоставления
        
        Args:
            episode_id: ID эпизода
            video_filename: Имя видеофайла
            
        Returns:
            Словарь с информацией о созданных видеофайлах
        """
        # Загружаем результаты сопоставления
        match_result = self._load_match_result(episode_id)
        if not match_result:
            return {"error": "Результаты сопоставления не найдены"}
        
        # Формируем полный путь к исходному видео
        video_path = os.path.join(self.data_root, "sample-videos", video_filename)
        if not os.path.exists(video_path):
            return {"error": f"Видеофайл {video_filename} не найден"}
        
        # Создаем директорию для вывода, если она не существует
        output_dir = os.path.join(self.data_root, "results", "storyline-videos", episode_id)
        os.makedirs(output_dir, exist_ok=True)
        
        results = []
        
        # Обрабатываем каждый сюжет
        for storyline in match_result.get("storylines", []):
            title = storyline.get("title")
            if not title:
                continue
                
            # Получаем отсортированные по времени сцены
            scenes = storyline.get("scenes", [])
            if not scenes:
                continue
            
            # Выбираем сцены, чтобы получить примерно 3 минуты контента с высоким score
            selected_scenes = self._select_scenes_by_score(scenes)
            
            # Сортируем выбранные сцены по времени начала
            sorted_scenes = sorted(selected_scenes, key=lambda x: x.get("start_time", 0))
            
            # Создаем имя файла для сюжета (заменяем пробелы и специальные символы)
            safe_title = title.replace(" ", "_").replace("/", "_").replace("\\", "_").replace(":", "_")
            output_filename = f"{safe_title}.mp4"
            output_path = os.path.join(output_dir, output_filename)
            
            # Нарезаем видео
            success = self._cut_storyline(video_path, sorted_scenes, output_path)
            
            if success:
                total_duration = sum(scene.get("duration", 0) for scene in sorted_scenes)
                results.append({
                    "storyline_title": title,
                    "output_path": output_path,
                    "scenes_count": len(sorted_scenes),
                    "total_duration": total_duration,
                    "avg_score": sum(scene.get("score", 0) for scene in sorted_scenes) / len(sorted_scenes) if sorted_scenes else 0
                })
                logger.info(f"Создан сюжет '{title}': {len(sorted_scenes)} сцен, продолжительность {total_duration:.2f} сек")
            
        return {
            "episode_id": episode_id,
            "video_filename": video_filename,
            "storylines_processed": len(results),
            "results": results
        }
    
    def _select_scenes_by_score(self, scenes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Выбирает сцены на основе их score, стараясь получить общую длительность около 3 минут.
        Приоритет отдаётся сценам с более высоким score.
        
        Args:
            scenes: Список сцен с оценками
            
        Returns:
            Список выбранных сцен
        """
        # Сортируем сцены по убыванию score
        sorted_by_score = sorted(scenes, key=lambda x: x.get("score", 0), reverse=True)
        
        selected_scenes = []
        total_duration = 0
        
        # Сначала добавляем сцены с высоким score до целевой продолжительности
        for scene in sorted_by_score:
            duration = scene.get("duration", 0)
            if total_duration + duration <= self.target_duration:
                selected_scenes.append(scene)
                total_duration += duration
                logger.info(f"Выбрана сцена {scene.get('scene_id')}, score: {scene.get('score', 0):.4f}, длительность: {duration:.2f} сек")
            else:
                # Если добавление этой сцены превысит целевую продолжительность,
                # проверим, не будет ли она ближе к цели, чем без неё
                if abs(total_duration + duration - self.target_duration) < abs(total_duration - self.target_duration):
                    selected_scenes.append(scene)
                    total_duration += duration
                    logger.info(f"Дополнительно выбрана сцена {scene.get('scene_id')}, score: {scene.get('score', 0):.4f}, длительность: {duration:.2f} сек")
                    break
                else:
                    break
        
        logger.info(f"Выбрано {len(selected_scenes)}/{len(scenes)} сцен, общая длительность: {total_duration:.2f} сек (цель: {self.target_duration} сек)")
        
        # Если у нас недостаточно контента (менее 80% от целевого времени), 
        # добавляем ещё сцены даже с более низким score
        if total_duration < 0.8 * self.target_duration and len(selected_scenes) < len(scenes):
            remaining_scenes = [s for s in sorted_by_score if s not in selected_scenes]
            logger.info(f"Недостаточная длительность ({total_duration:.2f} < {0.8 * self.target_duration:.2f}), добавляем дополнительные сцены")
            
            for scene in remaining_scenes:
                duration = scene.get("duration", 0)
                selected_scenes.append(scene)
                total_duration += duration
                logger.info(f"Добавлена сцена с низким score {scene.get('scene_id')}, score: {scene.get('score', 0):.4f}, длительность: {duration:.2f} сек")
                
                if total_duration >= 0.8 * self.target_duration:
                    break
        
        # Возвращаем выбранные сцены
        return selected_scenes
    
    def _load_match_result(self, episode_id: str) -> Dict[str, Any]:
        """Загружает результаты сопоставления из JSON-файла"""
        try:
            match_path = os.path.join(self.data_root, "results", "episode-matches", f"{episode_id}.json")
            if not os.path.exists(match_path):
                logger.error(f"Файл с результатами сопоставления не найден: {match_path}")
                return {}
                
            with open(match_path, 'r', encoding='utf-8') as f:
                return json.load(f)
                
        except Exception as e:
            logger.error(f"Ошибка при загрузке результатов сопоставления: {str(e)}")
            return {}
    
    def _cut_storyline(self, video_path: str, scenes: List[Dict[str, Any]], output_path: str) -> bool:
        """
        Нарезает видео для одного сюжета с помощью ffmpeg
        
        Args:
            video_path: Путь к исходному видео
            scenes: Список сцен для нарезки
            output_path: Путь для сохранения результата
            
        Returns:
            True если нарезка успешна, иначе False
        """
        try:
            # Создаем временный файл со списком сегментов для ffmpeg
            temp_dir = os.path.join(self.data_root, "temp")
            os.makedirs(temp_dir, exist_ok=True)
            
            segments_file = os.path.join(temp_dir, f"segments_{Path(output_path).stem}.txt")
            
            # Записываем информацию о сегментах в файл
            with open(segments_file, 'w', encoding='utf-8') as f:
                for i, scene in enumerate(scenes):
                    start_time = scene.get("start_time", 0)
                    duration = scene.get("duration", 0)
                    f.write(f"file '{video_path}'\n")
                    f.write(f"inpoint {start_time}\n")
                    f.write(f"outpoint {start_time + duration}\n")
            
            # Формируем команду для ffmpeg
            cmd = [
                "ffmpeg",
                "-y",  # Перезаписать выходной файл, если он существует
                "-f", "concat",
                "-safe", "0",
                "-i", segments_file,
                "-c", "copy",  # Копирование видео и аудио без перекодирования
                output_path
            ]
            
            # Запускаем процесс ffmpeg
            logger.info(f"Запуск команды ffmpeg: {' '.join(cmd)}")
            process = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # Проверяем, что файл создан
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                logger.info(f"Успешно создан файл сюжета: {output_path}")
                # Удаляем временный файл после успешной обработки
                if os.path.exists(segments_file):
                    os.remove(segments_file)
                return True
            else:
                logger.error(f"Файл сюжета не был создан или имеет нулевой размер: {output_path}")
                return False
                
        except subprocess.CalledProcessError as e:
            logger.error(f"Ошибка при выполнении ffmpeg: {e.stderr.decode('utf-8')}")
            return False
        except Exception as e:
            logger.error(f"Ошибка при нарезке сюжета: {str(e)}")
            return False 