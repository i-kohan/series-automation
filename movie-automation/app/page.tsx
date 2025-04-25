'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Series } from '@/lib/types/series';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/series');
      if (!response.ok) {
        throw new Error('Не удалось загрузить сериалы');
      }
      const data = await response.json();
      setSeries(data);
    } catch (error) {
      console.error('Ошибка при загрузке сериалов:', error);
      toast.error('Ошибка при загрузке сериалов');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    
    try {
      setIsCreating(true);
      const response = await fetch('/api/series', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (!response.ok) {
        throw new Error('Не удалось создать сериал');
      }

      toast.success('Сериал успешно создан');
      setNewTitle('');
      await loadSeries();
    } catch (error) {
      console.error('Ошибка при создании сериала:', error);
      toast.error('Ошибка при создании сериала');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSeriesClick = (seriesId: string) => {
    router.push(`/series/${seriesId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>Загрузка сериалов...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-6 border-b">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">Movie Automation</h1>
          <p className="text-muted-foreground">
            Автоматическое создание клипов из видео для социальных сетей
          </p>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">Выберите сериал</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Добавить сериал</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый сериал</DialogTitle>
                <DialogDescription>
                  Введите название нового сериала
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="Название сериала"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <DialogFooter>
                <Button 
                  onClick={handleCreate} 
                  disabled={isCreating || !newTitle.trim()}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Создание...
                    </>
                  ) : (
                    'Создать'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {series.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg text-muted-foreground mb-4">У вас пока нет добавленных сериалов</p>
            <Dialog>
              <DialogTrigger asChild>
                <Button>Добавить первый сериал</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Новый сериал</DialogTitle>
                  <DialogDescription>
                    Введите название нового сериала
                  </DialogDescription>
                </DialogHeader>
                <Input
                  placeholder="Название сериала"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <DialogFooter>
                  <Button 
                    onClick={handleCreate} 
                    disabled={isCreating || !newTitle.trim()}
                  >
                    {isCreating ? 'Создание...' : 'Создать'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {series.map((item) => (
              <Card 
                key={item.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleSeriesClick(item.id)}
              >
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>
                    Создан: {new Date(item.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full">
                    Выбрать этот сериал
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <footer className="py-6 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Movie Automation
        </div>
      </footer>
    </div>
  );
}
