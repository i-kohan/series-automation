'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CharacterForm } from '@/components/CharacterForm';
import { Character } from '@/lib/types/character';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EditCharacterPage() {
  const params = useParams();
  const router = useRouter();
  const seriesId = params.id as string;
  const characterId = params.characterId as string;
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCharacter = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/characters/${characterId}`);
        
        if (response.status === 404) {
          toast.error('Персонаж не найден');
          router.push(`/series/${seriesId}`);
          return;
        }
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить информацию о персонаже');
        }
        
        const data = await response.json();
        setCharacter(data);
      } catch (error) {
        console.error('Ошибка при загрузке персонажа:', error);
        toast.error('Ошибка при загрузке информации о персонаже');
        router.push(`/series/${seriesId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchCharacter();
  }, [characterId, seriesId, router]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSuccess = (updatedCharacter: Character) => {
    // После успешного обновления возвращаемся на страницу сериала
    router.push(`/series/${seriesId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>Загрузка информации о персонаже...</p>
      </div>
    );
  }

  if (!character) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-4 border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => router.push(`/series/${seriesId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Редактирование персонажа</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <CharacterForm 
            seriesId={seriesId}
            character={character}
            onSuccess={handleSuccess}
          />
        </div>
      </main>
    </div>
  );
} 