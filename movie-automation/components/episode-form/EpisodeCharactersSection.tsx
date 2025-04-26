'use client';

import { Character } from '@/lib/types/character';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface EpisodeCharactersSectionProps {
  characters: Character[];
  selectedCharacters: string[];
  onCharacterToggle: (characterId: string) => void;
}

export function EpisodeCharactersSection({
  characters,
  selectedCharacters,
  onCharacterToggle
}: EpisodeCharactersSectionProps) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Персонажи в серии</h2>
      <Card>
        <CardContent className="pt-6">
          {characters.length === 0 ? (
            <p className="text-muted-foreground">Нет доступных персонажей для выбора</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {characters.map(character => (
                <div key={character.id} className="flex items-start space-x-2">
                  <Checkbox 
                    id={`character-${character.id}`} 
                    checked={selectedCharacters.includes(character.id)}
                    onCheckedChange={() => onCharacterToggle(character.id)}
                  />
                  <Label 
                    htmlFor={`character-${character.id}`}
                    className="cursor-pointer flex-1"
                  >
                    <div className="flex items-center gap-2">
                      {character.imageUrls && character.imageUrls.length > 0 && (
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                          <img 
                            src={character.imageUrls[0]} 
                            alt={character.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{character.name}</p>
                        {character.aliases && character.aliases.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {character.aliases.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 