'use client';

import { Character } from '@/lib/types/character';
import { SimplePlotLine } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X } from 'lucide-react';

interface PlotLinesSectionProps {
  plotLines: SimplePlotLine[];
  characters: Character[];
  onAddPlotLine: () => void;
  onRemovePlotLine: (index: number) => void;
  onPlotLineChange: (index: number, key: keyof SimplePlotLine, value: string | string[]) => void;
  onPlotLineCharacterToggle: (plotLineIndex: number, characterId: string) => void;
}

export function PlotLinesSection({
  plotLines,
  characters,
  onAddPlotLine,
  onRemovePlotLine,
  onPlotLineChange,
  onPlotLineCharacterToggle
}: PlotLinesSectionProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Сюжетные линии ({plotLines.length})</h2>
        <Button 
          type="button" 
          onClick={onAddPlotLine} 
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить сюжетную линию
        </Button>
      </div>

      {plotLines.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">Пока нет сюжетных линий</p>
            <p className="text-sm text-muted-foreground">Добавьте сюжетные линии вручную или воспользуйтесь промптом для ChatGPT</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {plotLines.map((plotLine, index) => (
            <Card key={index} className="relative">
              {plotLines.length > 1 && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => onRemovePlotLine(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`plotline-title-${index}`}>Название сюжетной линии</Label>
                  <Input
                    id={`plotline-title-${index}`}
                    placeholder="Название"
                    value={plotLine.title}
                    onChange={(e) => onPlotLineChange(index, 'title', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`plotline-description-${index}`}>Описание</Label>
                  <Textarea
                    id={`plotline-description-${index}`}
                    placeholder="Подробное описание сюжетной линии"
                    value={plotLine.description}
                    onChange={(e) => onPlotLineChange(index, 'description', e.target.value)}
                    rows={4}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`plotline-keywords-${index}`}>Ключевые слова</Label>
                  <Input
                    id={`plotline-keywords-${index}`}
                    placeholder="Через запятую"
                    value={plotLine.keywords ? plotLine.keywords.join(', ') : ''}
                    onChange={(e) => {
                      const keywordsArray = e.target.value.split(',')
                        .map(k => k.trim())
                        .filter(k => k.length > 0);
                      onPlotLineChange(index, 'keywords', keywordsArray);
                    }}
                  />
                  {plotLine.keywords && plotLine.keywords.length > 0 && (
                    <div className="p-2 bg-secondary rounded-md mt-1">
                      <div className="flex flex-wrap gap-1">
                        {plotLine.keywords.map((keyword, idx) => (
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
                
                <div className="space-y-2">
                  <Label>Персонажи в этой сюжетной линии</Label>
                  {characters.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Нет доступных персонажей</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {characters.map(character => (
                        <div key={character.id} className="flex items-start space-x-2">
                          <Checkbox 
                            id={`plotline-${index}-character-${character.id}`} 
                            checked={(plotLine.characters || []).includes(character.id)}
                            onCheckedChange={() => onPlotLineCharacterToggle(index, character.id)}
                          />
                          <Label 
                            htmlFor={`plotline-${index}-character-${character.id}`}
                            className="cursor-pointer"
                          >
                            {character.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 