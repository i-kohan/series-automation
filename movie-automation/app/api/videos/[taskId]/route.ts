import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Каталог для хранения видеофайлов - используем путь на уровень выше корня Next.js приложения
const VIDEOS_DIR = path.join(
  process.cwd(),
  "..",
  "shared-data",
  "sample-videos"
);

// Выводим путь для отладки
console.log(`Video directory path: ${VIDEOS_DIR}`);

// Убедимся, что директория существует
try {
  if (!fs.existsSync(VIDEOS_DIR)) {
    console.warn(`Videos directory not found: ${VIDEOS_DIR}`);
  } else {
    console.log(
      `Found videos directory, files: ${fs.readdirSync(VIDEOS_DIR).join(", ")}`
    );
  }
} catch (error) {
  console.error(`Error checking videos directory: ${error}`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    // Используем taskId в логировании для отладки
    const { taskId } = params;
    console.log(`Processing video request for taskId: ${taskId}`);

    const searchParams = request.nextUrl.searchParams;
    const filename = searchParams.get("filename");

    let videoPath: string;

    if (filename) {
      // Если filename указан в параметрах запроса, используем его
      videoPath = path.join(VIDEOS_DIR, filename);
    } else {
      // Иначе пытаемся найти файл по taskId (используя первый файл в директории для демо)
      const videoFiles = fs.readdirSync(VIDEOS_DIR);

      if (videoFiles.length === 0) {
        console.error(`No video files found in ${VIDEOS_DIR}`);
        return new NextResponse("Video not found", { status: 404 });
      }

      videoPath = path.join(VIDEOS_DIR, videoFiles[0]);
      console.log(`Using first video file found: ${videoPath}`);
    }

    // Проверяем существование файла
    if (!fs.existsSync(videoPath)) {
      console.error(`Video file not found: ${videoPath}`);
      return new NextResponse("Video file not found", { status: 404 });
    }

    const videoStats = fs.statSync(videoPath);
    const videoSize = videoStats.size;

    // Получаем диапазон запрашиваемых байтов (если есть)
    const range = request.headers.get("range");

    if (range) {
      // Обработка запроса с диапазоном (частичный запрос)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;

      // Создаем поток для чтения части файла
      const fileStream = fs.createReadStream(videoPath, { start, end });
      const chunkSize = end - start + 1;

      // Настройка заголовков для стримингового ответа
      const headers = new Headers();
      headers.set("Content-Range", `bytes ${start}-${end}/${videoSize}`);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Length", chunkSize.toString());
      headers.set("Content-Type", "video/mp4");

      // Возвращаем частичный ответ (206)
      return new NextResponse(fileStream as unknown as ReadableStream, {
        status: 206,
        headers,
      });
    } else {
      // Возвращаем полный файл, если диапазон не указан
      const fileStream = fs.createReadStream(videoPath);

      // Настройка заголовков для полного ответа
      const headers = new Headers();
      headers.set("Content-Type", "video/mp4");
      headers.set("Content-Length", videoSize.toString());
      headers.set("Accept-Ranges", "bytes");

      return new NextResponse(fileStream as unknown as ReadableStream, {
        status: 200,
        headers,
      });
    }
  } catch (error) {
    console.error("Error serving video:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
