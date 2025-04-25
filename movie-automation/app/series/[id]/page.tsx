'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Series } from '@/lib/types/series';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import { VideoSelector } from "@/components/VideoSelector";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CharacterList } from '@/components/CharacterList';
import { EpisodeList } from '@/components/EpisodeList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SeriesPage() {
  const params = useParams();
  const router = useRouter();
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const seriesId = params.id as string;
  const [key, setKey] = useState(0);

  useEffect(() => {
    loadSeries();
  }, [seriesId]);

  useEffect(() => {
    const handleRouteChange = () => {
      setKey(prev => prev + 1);
    };

    window.addEventListener('focus', handleRouteChange);
    return () => {
      window.removeEventListener('focus', handleRouteChange);
    };
  }, []);

  const loadSeries = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/series/${seriesId}`);
      
      if (response.status === 404) {
        toast.error('Сериал не найден');
        router.push('/');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Не удалось загрузить информацию о сериале');
      }
      
      const data = await response.json();
      setSeries(data);
    } catch (error) {
      console.error('Ошибка при загрузке сериала:', error);
      toast.error('Ошибка при загрузке информации о сериале');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const response = await fetch(`/api/series?id=${seriesId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Не удалось удалить сериал');
      }
      
      toast.success('Сериал успешно удален');
      router.push('/');
    } catch (error) {
      console.error('Ошибка при удалении сериала:', error);
      toast.error('Ошибка при удалении сериала');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>Загрузка информации о сериале...</p>
      </div>
    );
  }

  if (!series) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-4 border-b">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => router.push('/')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">{series.title}</h1>
            </div>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить сериал
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Информация о сериале</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Название</p>
                <p>{series.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Дата создания</p>
                <p>{new Date(series.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="characters" className="space-y-6">
          <TabsList>
            <TabsTrigger value="characters">Персонажи</TabsTrigger>
            <TabsTrigger value="episodes">Серии</TabsTrigger>
            <TabsTrigger value="videos">Видео</TabsTrigger>
          </TabsList>
          
          <TabsContent value="characters">
            <CharacterList key={`characters-${key}`} seriesId={seriesId} />
          </TabsContent>
          
          <TabsContent value="episodes">
            <EpisodeList key={`episodes-${key}`} seriesId={seriesId} />
          </TabsContent>
          
          <TabsContent value="videos">
            <h2 className="text-xl font-bold mb-4">Выбор видео</h2>
            <VideoSelector />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение удаления</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить сериал &quot;{series.title}&quot;? Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Отмена
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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