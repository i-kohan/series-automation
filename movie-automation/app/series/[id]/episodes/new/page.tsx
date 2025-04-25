'use client';

import { useParams, useRouter } from 'next/navigation';
import { EpisodeForm } from '@/components/EpisodeForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Episode } from '@/lib/types/episode';

export default function CreateEpisodePage() {
  const params = useParams();
  const router = useRouter();
  const seriesId = params.id as string;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSuccess = (episode: Episode) => {
    // После успешного создания возвращаемся на страницу сериала
    router.push(`/series/${seriesId}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-4 border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => router.push(`/series/${seriesId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Создание новой серии</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <EpisodeForm 
            seriesId={seriesId}
            onSuccess={handleSuccess}
          />
        </div>
      </main>
    </div>
  );
} 