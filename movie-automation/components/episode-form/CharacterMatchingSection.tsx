'use client';

import { Character } from '@/lib/types/character';
import { CharacterMatch } from './types';
import { Button } from '@/components/ui/button';
import { CreateNewCharactersDialog } from '@/components/CreateNewCharactersDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Check, AlertTriangle } from 'lucide-react';

interface CharacterMatchingSectionProps {
  seriesId: string;
  seriesTitle: string;
  characterMatches: CharacterMatch[];
  characters: Character[];
  onManualMatch: (index: number, characterId: string) => void;
  onSkipCharacter: (index: number) => void;
  onResetMatch: (index: number) => void;
  onApplyMatching: () => void;
  onCharactersCreated: (characters: Character[]) => void;
}

export function CharacterMatchingSection({
  seriesId,
  seriesTitle,
  characterMatches,
  characters,
  onManualMatch,
  onSkipCharacter,
  onResetMatch,
  onApplyMatching,
  onCharactersCreated
}: CharacterMatchingSectionProps) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Сопоставление персонажей</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Обнаружены новые персонажи</span>
            <div className="flex gap-2">
              <CreateNewCharactersDialog 
                seriesId={seriesId}
                seriesTitle={seriesTitle}
                unmatchedCharacters={characterMatches}
                onSuccess={onCharactersCreated}
              />
              <Button 
                onClick={onApplyMatching}
                disabled={characterMatches.every(m => m.status === 'unmatched')}
              >
                Применить сопоставления
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            В ответе ChatGPT были упомянуты персонажи, которые требуют сопоставления с существующими.
            Выберите соответствующего персонажа из списка или пропустите персонажа, если он не нужен.
          </p>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Персонаж из ChatGPT</TableHead>
                <TableHead>Существующий персонаж</TableHead>
                <TableHead>Совпадение</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {characterMatches.map((match, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="font-medium">{match.name}</div>
                  </TableCell>
                  <TableCell>
                    {match.status === 'unmatched' ? (
                      <Select 
                        value={match.selectedCharacterId || ""}
                        onValueChange={(value) => onManualMatch(index, value)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Выберите персонажа" />
                        </SelectTrigger>
                        <SelectContent>
                          {characters.map(character => (
                            <SelectItem key={character.id} value={character.id}>
                              {character.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : match.existingCharacter ? (
                      <div className="font-medium">{match.existingCharacter.name}</div>
                    ) : (
                      <div className="text-muted-foreground">—</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {match.status === 'matched' || match.status === 'manual' ? (
                      <div className="flex items-center">
                        <span
                          className={`inline-block w-16 h-2 rounded-full mr-2 ${
                            match.matchScore > 0.8 ? 'bg-green-500' :
                            match.matchScore > 0.5 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                        />
                        <span>{Math.round(match.matchScore * 100)}%</span>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">—</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {match.status === 'matched' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Check className="w-3 h-3 mr-1" />
                        Совпал
                      </span>
                    )}
                    {match.status === 'manual' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <Check className="w-3 h-3 mr-1" />
                        Выбран вручную
                      </span>
                    )}
                    {match.status === 'unmatched' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Не сопоставлен
                      </span>
                    )}
                    {match.status === 'skipped' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Пропущен
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {match.status === 'unmatched' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onSkipCharacter(index)}
                      >
                        Пропустить
                      </Button>
                    )}
                    {(match.status === 'matched' || match.status === 'manual' || match.status === 'skipped') && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onResetMatch(index)}
                      >
                        Сбросить
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          <div className="mt-4 flex justify-end">
            <Button 
              onClick={onApplyMatching}
              disabled={characterMatches.every(m => m.status === 'unmatched')}
            >
              Применить сопоставления
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 