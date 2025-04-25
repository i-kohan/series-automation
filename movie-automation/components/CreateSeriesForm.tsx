'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function CreateSeriesForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/series', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!response.ok) {
        throw new Error('Не удалось создать сериал');
      }

      setTitle('');
      toast.success('Сериал успешно создан');
      onSuccess();
    } catch (error) {
      console.error('Ошибка при создании сериала:', error);
      toast.error('Ошибка при создании сериала');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Название сериала"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || !title.trim()}>
          {isLoading ? 'Создание...' : 'Создать'}
        </Button>
      </div>
    </form>
  );
} 