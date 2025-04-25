'use client';

import { useState, useEffect } from 'react';
import { Series } from '@/lib/types/series';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function SeriesPage() {
    const [series, setSeries] = useState<Series[]>([]);
    const [newTitle, setNewTitle] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        loadSeries();
    }, []);

    const loadSeries = async () => {
        try {
            const response = await fetch('/api/series');
            if (!response.ok) {
                throw new Error('Failed to fetch series');
            }
            const data = await response.json();
            setSeries(data);
        } catch (error) {
            console.error('Failed to load series:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        try {
            const response = await fetch('/api/series', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title: newTitle }),
            });
            if (!response.ok) {
                throw new Error('Failed to create series');
            }
            setNewTitle('');
            setIsDialogOpen(false);
            loadSeries();
        } catch (error) {
            console.error('Failed to create series:', error);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const response = await fetch(`/api/series/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error('Failed to delete series');
            }
            loadSeries();
        } catch (error) {
            console.error('Failed to delete series:', error);
        }
    };

    if (isLoading) {
        return <div>Loading...</div>;
    }

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Сериалы</h1>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>Добавить сериал</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Новый сериал</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <Input
                                placeholder="Название сериала"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                            />
                            <Button onClick={handleCreate}>Создать</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {series.map((item) => (
                    <Card key={item.id}>
                        <CardHeader>
                            <CardTitle>{item.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-500">
                                    Создан: {new Date(item.createdAt).toLocaleDateString()}
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDelete(item.id)}
                                >
                                    Удалить
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
} 