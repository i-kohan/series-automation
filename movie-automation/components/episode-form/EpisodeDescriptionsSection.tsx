'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X } from 'lucide-react';

interface EpisodeDescriptionsSectionProps {
  descriptions: string[];
  onDescriptionChange: (index: number, value: string) => void;
  onAddDescription: () => void;
  onRemoveDescription: (index: number) => void;
}

export function EpisodeDescriptionsSection({
  descriptions,
  onDescriptionChange,
  onAddDescription,
  onRemoveDescription
}: EpisodeDescriptionsSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Описания/сюжеты</h2>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={onAddDescription}
        >
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {descriptions.map((description, index) => (
              <div key={index} className="flex gap-2">
                <Textarea
                  placeholder={`Сюжет ${index + 1}`}
                  value={description}
                  onChange={(e) => onDescriptionChange(index, e.target.value)}
                  rows={3}
                  className="flex-1"
                />
                {descriptions.length > 1 && (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    size="icon"
                    onClick={() => onRemoveDescription(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 