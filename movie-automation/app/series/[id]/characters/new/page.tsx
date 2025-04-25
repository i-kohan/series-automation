'use client';

import { useParams, useRouter } from 'next/navigation';
import { CharacterForm } from '@/components/CharacterForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Character } from '@/lib/types/character';

export default function CreateCharacterPage() {
  const params = useParams();
  const router = useRouter();
  const seriesId = params.id as string;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSuccess = (character: Character) => {
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
            <h1 className="text-2xl font-bold">Создание нового персонажа</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <CharacterForm 
            seriesId={seriesId}
            onSuccess={handleSuccess}
          />
        </div>
      </main>
    </div>
  );
} 