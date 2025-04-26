'use client';

import { useState } from 'react';
import { Character } from '@/lib/types/character';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Copy, CheckCircle2, Check, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

// Интерфейс для JSON-ответа от ChatGPT с массивом персонажей
interface CharacterGptResponse {
  characters: {
    name: string;
    aliases: string[];
    description: string;
    keywords: string[];
    quotes?: string[];
    imageUrls: string[];
  }[];
}

// Структура персонажа после парсинга для внутреннего использования
interface ParsedCharacter {
  seriesId: string;
  name: string;
  aliases: string[];
  description: string;
  keywords: string[];
  imageUrls: string[];
}

// Структура для сопоставления персонажей
interface CharacterMatch {
  name: string; // Имя персонажа из ChatGPT
  existingCharacter: Character | null; // Найденный существующий персонаж
  matchScore: number; // Оценка совпадения (0-1)
  status: 'matched' | 'unmatched' | 'manual' | 'skipped'; // Статус сопоставления
  selectedCharacterId?: string; // ID выбранного вручную персонажа
}

interface CreateNewCharactersDialogProps {
  seriesId: string;
  seriesTitle: string;
  unmatchedCharacters: CharacterMatch[];
  onSuccess: (createdCharacters: Character[]) => void;
}

export function CreateNewCharactersDialog({ 
  seriesId, 
  seriesTitle, 
  unmatchedCharacters, 
  onSuccess 
}: CreateNewCharactersDialogProps) {
  const [open, setOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [chatGptResponse, setChatGptResponse] = useState<string>('');
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [parsedCharacters, setParsedCharacters] = useState<ParsedCharacter[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Автоматически формируем предварительный JSON для ChatGPT
  const getInitialCharactersJson = () => {
    const characters = unmatchedCharacters
      .filter(char => char.status === 'unmatched' || char.status === 'skipped')
      .map(char => ({
        name: char.name,
        aliases: [],
        description: "", 
        keywords: [],
        quotes: [],
        imageUrls: []
      }));
    
    return JSON.stringify({ characters }, null, 2);
  };

  // Генерируем промпт для детализации персонажей
  const characterPrompt = `Помоги мне создать детальные профили для следующих персонажей из сериала "${seriesTitle}":
${unmatchedCharacters
  .filter(char => char.status === 'unmatched' || char.status === 'skipped')
  .map(char => `- ${char.name}`)
  .join('\n')}

Вот начальная структура данных, которую необходимо дополнить информацией:

\`\`\`json
${getInitialCharactersJson()}
\`\`\`

Для каждого персонажа необходимо добавить:
1. Возможные псевдонимы или прозвища (aliases)
2. Подробное описание персонажа в 3-5 предложений (description)
3. Ключевые черты характера, привычки, особенности (keywords)
4. Характерные цитаты или фразы (quotes)
5. URL изображений, если возможно, прямые ссылки на файлы (imageUrls)

Сделай персонажей разнообразными, с индивидуальными чертами характера и особенностями.

ВАЖНО: Верни только валидный JSON в указанном формате, который можно будет сразу использовать для создания персонажей.`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(characterPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
    toast.success('Промпт скопирован');
  };

  // Функция для парсинга JSON-ответа от ChatGPT
  const handleParseResponse = () => {
    try {
      // Попытка найти и извлечь JSON из ответа
      let jsonText = chatGptResponse;
      
      // Если текст содержит блоки кода, извлекаем JSON из первого блока
      const codeBlockMatch = chatGptResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonText = codeBlockMatch[1].trim();
      }
      
      const parsedData = JSON.parse(jsonText) as CharacterGptResponse;
      setParsingError(null);
      
      if (!parsedData.characters || !Array.isArray(parsedData.characters) || parsedData.characters.length === 0) {
        setParsingError('JSON должен содержать массив "characters"');
        toast.error('Некорректный формат JSON');
        return;
      }
      
      // Проверяем и подготавливаем каждого персонажа
      const validatedCharacters = parsedData.characters.map(char => {
        // Валидация и преобразование полей
        return {
          seriesId: seriesId,
          name: char.name || 'Неизвестный персонаж',
          aliases: Array.isArray(char.aliases) ? char.aliases : [],
          description: char.description || '',
          keywords: Array.isArray(char.keywords) ? char.keywords : [],
          // Фильтруем только валидные URL изображений
          imageUrls: Array.isArray(char.imageUrls) 
            ? char.imageUrls.filter(url => url.match(/^https?:\/\/.*\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i))
            : []
        } as ParsedCharacter;
      });
      
      setParsedCharacters(validatedCharacters);
      toast.success(`Разобрано ${validatedCharacters.length} персонажей`);
    } catch (error) {
      console.error('Ошибка парсинга JSON:', error);
      setParsingError('Не удалось разобрать JSON-ответ. Проверьте формат ответа от ChatGPT.');
      toast.error('Ошибка при обработке ответа ChatGPT');
    }
  };

  // Отправка персонажей на сервер
  const handleCreateCharacters = async () => {
    if (parsedCharacters.length === 0) {
      toast.error('Сначала обработайте ответ ChatGPT');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Последовательно создаем каждого персонажа
      const createdCharacters: Character[] = [];
      
      for (const character of parsedCharacters) {
        const response = await fetch('/api/characters', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(character),
        });
        
        if (!response.ok) {
          throw new Error(`Не удалось создать персонажа ${character.name}`);
        }
        
        const data = await response.json();
        createdCharacters.push(data);
      }
      
      toast.success(`Успешно создано ${createdCharacters.length} персонажей`);
      setParsedCharacters([]);
      setChatGptResponse('');
      
      // Закрываем диалог и вызываем колбэк с созданными персонажами
      setOpen(false);
      onSuccess(createdCharacters);
    } catch (error) {
      console.error('Ошибка при создании персонажей:', error);
      toast.error('Ошибка при создании персонажей');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="secondary"
          disabled={unmatchedCharacters.filter(c => c.status === 'unmatched' || c.status === 'skipped').length === 0}
        >
          Создать новых персонажей
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создание новых персонажей</DialogTitle>
          <DialogDescription>
            Создайте новых персонажей для добавления в эпизод. Несопоставленные персонажи: 
            {unmatchedCharacters
              .filter(c => c.status === 'unmatched' || c.status === 'skipped')
              .map(c => c.name)
              .join(', ')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Блок с промптом */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">            
                <div className="p-4 border rounded-md bg-muted/30">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-md font-medium">Промпт для ChatGPT</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyPrompt}
                      className="h-8"
                    >
                      {promptCopied ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      {promptCopied ? 'Скопировано' : 'Копировать'}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Скопируйте этот промпт, вставьте в ChatGPT и используйте результаты для создания персонажей
                  </p>
                  <div className="p-3 bg-background border rounded-md whitespace-pre-wrap text-sm font-mono">
                    {characterPrompt}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Обработка ответа ChatGPT */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-medium mb-2">Обработка ответа ChatGPT</h3>
              <div className="space-y-2">
                <Label htmlFor="chatgpt-response">Вставьте ответ от ChatGPT</Label>
                <Textarea
                  id="chatgpt-response"
                  placeholder="Вставьте сюда весь ответ от ChatGPT в формате JSON..."
                  value={chatGptResponse}
                  onChange={(e) => setChatGptResponse(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                {parsingError && (
                  <p className="text-sm text-red-500">{parsingError}</p>
                )}
              </div>
              <Button 
                type="button" 
                onClick={handleParseResponse}
                disabled={!chatGptResponse.trim()}
                className="w-full"
              >
                Обработать и проверить персонажей
              </Button>
            </CardContent>
          </Card>

          {/* Предпросмотр персонажей */}
          {parsedCharacters.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium mb-4">Предпросмотр персонажей ({parsedCharacters.length})</h3>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Имя</TableHead>
                        <TableHead>Псевдонимы</TableHead>
                        <TableHead>Описание</TableHead>
                        <TableHead className="w-[150px]">Ключевые слова</TableHead>
                        <TableHead className="w-[80px]">Изображения</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedCharacters.map((character, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{character.name}</TableCell>
                          <TableCell className="text-sm">{character.aliases.join(', ')}</TableCell>
                          <TableCell className="text-sm">
                            {character.description.length > 100 
                              ? `${character.description.substring(0, 100)}...` 
                              : character.description}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-wrap gap-1">
                              {character.keywords.slice(0, 3).map((keyword: string, idx: number) => (
                                <span key={idx} className="px-1.5 py-0.5 bg-primary/10 rounded-full truncate max-w-[100px]">
                                  {keyword}
                                </span>
                              ))}
                              {character.keywords.length > 3 && (
                                <span className="text-muted-foreground">+{character.keywords.length - 3}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {character.imageUrls.length > 0 ? (
                              <div className="flex items-center gap-1">
                                <Check className="h-4 w-4 text-green-500" />
                                <span className="text-xs">{character.imageUrls.length}</span>
                              </div>
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleCreateCharacters}
            disabled={isSubmitting || parsedCharacters.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Создание персонажей...
              </>
            ) : (
              `Создать ${parsedCharacters.length} персонажей`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}