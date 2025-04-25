'use client';

import { useState, useEffect } from 'react';
import { Character } from '@/lib/types/character';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CharacterListProps {
  seriesId: string;
}

export function CharacterList({ seriesId }: CharacterListProps) {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadCharacters();
  }, [seriesId]);

  useEffect(() => {
    // Обновляем список персонажей при возвращении фокуса на окно
    const handleFocus = () => {
      loadCharacters();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [seriesId]);

  const loadCharacters = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/characters?seriesId=${seriesId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch characters');
      }
      
      const data = await response.json();
      setCharacters(data);
    } catch (error) {
      console.error('Failed to load characters:', error);
      toast.error('Не удалось загрузить персонажей');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (character: Character) => {
    router.push(`/series/${seriesId}/characters/edit/${character.id}`);
  };

  const handleDeleteClick = (character: Character) => {
    setSelectedCharacter(character);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCharacter) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/characters/${selectedCharacter.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete character');
      }
      
      setCharacters(prev => prev.filter(c => c.id !== selectedCharacter.id));
      toast.success('Персонаж успешно удален');
    } catch (error) {
      console.error('Failed to delete character:', error);
      toast.error('Не удалось удалить персонажа');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setSelectedCharacter(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Персонажи</h2>
        <div className="flex space-x-2">
          <Button variant="outline" asChild>
            <Link href={`/series/${seriesId}/characters/batch`}>
              <UserPlus className="h-4 w-4 mr-2" />
              Создать массово
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/series/${seriesId}/characters/new`}>
              <UserPlus className="h-4 w-4 mr-2" />
              Добавить персонажа
            </Link>
          </Button>
        </div>
      </div>

      {characters.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">У этого сериала пока нет персонажей</p>
            <div className="flex justify-center space-x-2">
              <Button variant="outline" asChild>
                <Link href={`/series/${seriesId}/characters/batch`}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Создать массово
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/series/${seriesId}/characters/new`}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Добавить персонажа
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map(character => (
            <Card key={character.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <span className="truncate">{character.name}</span>
                  <div className="flex space-x-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleEditClick(character)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDeleteClick(character)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {character.imageUrls && character.imageUrls.length > 0 ? (
                  <div className="mb-4">
                    <div className="aspect-square overflow-hidden rounded-md mb-2">
                      <img 
                        src={character.imageUrls[0]} 
                        alt={character.name} 
                        className="object-cover w-full h-full" 
                      />
                    </div>
                    {character.imageUrls.length > 1 && (
                      <div className="flex gap-1 overflow-x-auto py-1">
                        {Array.from(character.imageUrls.slice(1)).map((url, idx) => (
                          <div 
                            key={idx} 
                            className="w-12 h-12 flex-shrink-0 rounded-md overflow-hidden border"
                            onClick={() => {
                              if (character.imageUrls) {
                                // Меняем основное отображаемое изображение
                                const newImageUrls = [...character.imageUrls];
                                [newImageUrls[0], newImageUrls[idx + 1]] = [newImageUrls[idx + 1], newImageUrls[0]];
                                // Обновляем данные персонажа локально
                                setCharacters(prev => 
                                  prev.map(c => c.id === character.id 
                                    ? {...c, imageUrls: newImageUrls}
                                    : c
                                  )
                                );
                              }
                            }}
                          >
                            <img 
                              src={url} 
                              alt={`${character.name} ${idx + 2}`}
                              className="object-cover w-full h-full cursor-pointer" 
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
                <div className="space-y-2">
                  {character.aliases && character.aliases.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Псевдонимы:</p>
                      <p className="text-sm">{character.aliases.join(', ')}</p>
                    </div>
                  )}
                  {character.description && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Описание:</p>
                      <p className="text-sm line-clamp-3">{character.description}</p>
                    </div>
                  )}
                  {character.keywords && character.keywords.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Ключевые слова:</p>
                      <div className="flex flex-wrap gap-1">
                        {character.keywords.map((keyword, idx) => (
                          <span 
                            key={idx} 
                            className="text-xs px-2 py-1 bg-secondary rounded-full"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => handleEditClick(character)}
                >
                  Редактировать
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Диалог подтверждения удаления */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение удаления</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить персонажа &quot;{selectedCharacter?.name}&quot;? Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Удаление...
                </>
              ) : (
                'Удалить'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 