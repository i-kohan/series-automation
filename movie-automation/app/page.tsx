import { VideoUploader } from "@/components/VideoUploader";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Movie Automation</h1>
        <p className="text-muted-foreground">
          Автоматическое создание клипов из видео для социальных сетей
        </p>
      </header>

      <main className="w-full max-w-screen-md">
        <VideoUploader />
      </main>

      <footer className="mt-12 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Movie Automation
      </footer>
    </div>
  );
}
