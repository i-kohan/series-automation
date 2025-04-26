'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

interface EpisodeKeywordsSectionProps {
  keywords: string;
  onChange: (value: string) => void;
}

export function EpisodeKeywordsSection({ keywords, onChange }: EpisodeKeywordsSectionProps) {
  // Получаем массив ключевых слов из строки
  const keywordsArray = keywords
    .split(',')
    .map(keyword => keyword.trim())
    .filter(keyword => keyword.length > 0);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Ключевые слова</h2>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="keywords">Ключевые слова</Label>
            <Textarea
              id="keywords"
              placeholder="Через запятую"
              value={keywords}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
              rows={2}
            />
            {keywordsArray.length > 0 && (
              <div className="p-2 bg-secondary rounded-md mt-1">
                <div className="flex flex-wrap gap-1">
                  {keywordsArray.map((keyword, idx) => (
                    <span 
                      key={idx} 
                      className="text-xs px-2 py-1 bg-primary/10 rounded-full"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 