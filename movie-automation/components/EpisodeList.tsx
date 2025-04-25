'use client';

import { useState, useEffect } from 'react';
import { Episode } from '@/lib/types/episode';
import { Character } from '@/lib/types/character';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, FilePlus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

interface EpisodeListProps {
  seriesId: string;
}

export function EpisodeList({ seriesId }: EpisodeListProps) {
  const router = useRouter();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [characters, setCharacters] = useState<Record<string, Character>>({});
  const [loading, setLoading] = useState(true);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadEpisodes();
  }, [seriesId]);

  useEffect(() => {
    // Обновляем список серий при возвращении фокуса на окно
    const handleFocus = () => {
      loadEpisodes();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [seriesId]);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      
      // Загрузка серий
      const episodesResponse = await fetch(`/api/episodes?seriesId=${seriesId}`);
      if (!episodesResponse.ok) {
        throw new Error('Failed to fetch episodes');
      }
      const episodesData = await episodesResponse.json();
      setEpisodes(episodesData);
      
      // Загрузка персонажей для отображения
      const charactersResponse = await fetch(`/api/characters?seriesId=${seriesId}`);
      if (charactersResponse.ok) {
        const charactersData: Character[] = await charactersResponse.json();
        // Создаем объект для быстрого доступа к персонажам по ID
        const charactersMap = charactersData.reduce((acc, character) => {
          acc[character.id] = character;
          return acc;
        }, {} as Record<string, Character>);
        setCharacters(charactersMap);
      }
    } catch (error) {
      console.error('Failed to load episodes:', error);
      toast.error('Не удалось загрузить серии');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (episode: Episode) => {
    router.push(`/series/${seriesId}/episodes/edit/${episode.id}`);
  };

  const handleDeleteClick = (episode: Episode) => {
    setSelectedEpisode(episode);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedEpisode) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/episodes/${selectedEpisode.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete episode');
      }
      
      setEpisodes(prev => prev.filter(e => e.id !== selectedEpisode.id));
      toast.success('Серия успешно удалена');
    } catch (error) {
      console.error('Failed to delete episode:', error);
      toast.error('Не удалось удалить серию');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setSelectedEpisode(null);
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
        <h2 className="text-xl font-bold">Серии</h2>
        <Button asChild>
          <Link href={`/series/${seriesId}/episodes/new`}>
            <FilePlus className="h-4 w-4 mr-2" />
            Добавить серию
          </Link>
        </Button>
      </div>

      {episodes.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">У этого сериала пока нет серий</p>
            <Button asChild>
              <Link href={`/series/${seriesId}/episodes/new`}>
                <FilePlus className="h-4 w-4 mr-2" />
                Добавить первую серию
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {episodes.map(episode => (
            <Card key={episode.id}>
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <span className="truncate">{episode.title}</span>
                  <div className="flex space-x-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleEditClick(episode)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDeleteClick(episode)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {episode.descriptions && episode.descriptions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Сюжеты:</p>
                      <div className="space-y-2">
                        {episode.descriptions.slice(0, 2).map((desc, idx) => (
                          <p key={idx} className="text-sm line-clamp-2 bg-secondary/30 p-2 rounded-md">
                            {desc}
                          </p>
                        ))}
                        {episode.descriptions.length > 2 && (
                          <p className="text-xs text-muted-foreground">
                            + еще {episode.descriptions.length - 2} {
                              episode.descriptions.length - 2 === 1 ? 'сюжет' : 
                              episode.descriptions.length - 2 < 5 ? 'сюжета' : 'сюжетов'
                            }
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {episode.characters && episode.characters.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Персонажи:</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {episode.characters.slice(0, 5).map(characterId => {
                          const character = characters[characterId];
                          return character ? (
                            <div 
                              key={characterId} 
                              className="flex items-center space-x-1 bg-secondary/30 px-2 py-1 rounded-full"
                            >
                              {character.imageUrls && character.imageUrls.length > 0 && (
                                <div className="w-5 h-5 rounded-full overflow-hidden">
                                  <img 
                                    src={character.imageUrls[0]} 
                                    alt={character.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <span className="text-xs">{character.name}</span>
                            </div>
                          ) : null;
                        })}
                        {episode.characters.length > 5 && (
                          <span className="text-xs px-2 py-1 bg-secondary/30 rounded-full">
                            +{episode.characters.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {episode.keywords && episode.keywords.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Ключевые слова:</p>
                      <div className="flex flex-wrap gap-1">
                        {episode.keywords.map((keyword, idx) => (
                          <Badge key={idx} variant="secondary">{keyword}</Badge>
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
                  onClick={() => handleEditClick(episode)}
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
              Вы уверены, что хотите удалить серию &quot;{selectedEpisode?.title}&quot;? Это действие нельзя отменить.
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