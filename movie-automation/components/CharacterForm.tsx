'use client';

import { useState, useEffect } from 'react';
import { Character } from '@/lib/types/character';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Copy, CheckCircle2, Plus, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Интерфейс для JSON-ответа от ChatGPT
interface CharacterGptResponse {
  name: string;
  aliases: string[];
  description: string;
  keywords: string[];
  quotes?: string[];
  imageUrls: string[];
}

interface CharacterFormProps {
  seriesId: string;
  character?: Character;
  onSuccess: (character: Character) => void;
}

export function CharacterForm({ seriesId, character, onSuccess }: CharacterFormProps) {
  const [name, setName] = useState(character?.name || '');
  const [aliases, setAliases] = useState(character?.aliases?.join(', ') || '');
  const [description, setDescription] = useState(character?.description || '');
  const [keywords, setKeywords] = useState(character?.keywords?.join(', ') || '');
  const [imageUrls, setImageUrls] = useState<string[]>(
    character?.imageUrls && character.imageUrls.length > 0 
      ? character.imageUrls 
      : []
  );
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [seriesTitle, setSeriesTitle] = useState<string>('');
  const [chatGptResponse, setChatGptResponse] = useState<string>('');
  const [parsingError, setParsingError] = useState<string | null>(null);
  const isEditing = !!character;

  useEffect(() => {
    const fetchSeriesTitle = async () => {
      try {
        const response = await fetch(`/api/series/${seriesId}`);
        if (!response.ok) throw new Error('Не удалось получить информацию о сериале');
        const data = await response.json();
        setSeriesTitle(data.title);
      } catch (error) {
        console.error('Ошибка при загрузке названия сериала:', error);
      }
    };

    fetchSeriesTitle();
  }, [seriesId]);

  const characterPrompt = `Помоги мне собрать информацию о персонаже "${name || '[ИМЯ ПЕРСОНАЖА]'}" из сериала "${seriesTitle || '[НАЗВАНИЕ СЕРИАЛА]'}".

Предоставь ответ в формате JSON по следующей структуре:

\`\`\`json
{
  "name": "Полное имя персонажа",
  "aliases": ["Псевдоним 1", "Псевдоним 2"],
  "description": "Краткое описание персонажа (2-3 предложения)",
  "keywords": ["черта характера 1", "особенность 2", "привычка 3"],
  "quotes": ["Характерная фраза 1", "Цитата 2", "Фраза 3"],
  "imageUrls": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
}
\`\`\`

ВАЖНО для поля imageUrls: предоставь только прямые ссылки на изображения (заканчивающиеся на .jpg, .png или .webp), которые можно использовать в теге <img src="...">. Убедись, что это не ссылки на страницы сайтов, а прямые URL-адреса к файлам изображений.

Возврати только валидный JSON без дополнительного текста.`;

  const getFormattedPrompt = () => {
    const namePart = name 
      ? `<span class="font-bold text-primary">"${name}"</span>` 
      : '<span class="italic text-muted-foreground">[ВВЕДИТЕ ИМЯ ПЕРСОНАЖА]</span>';
    
    const seriesPart = seriesTitle 
      ? `<span class="font-semibold">"${seriesTitle}"</span>` 
      : '<span class="italic text-muted-foreground">[НАЗВАНИЕ СЕРИАЛА]</span>';
    
    return `Помоги мне собрать информацию о персонаже ${namePart} из сериала ${seriesPart}.

Предоставь ответ в формате JSON по следующей структуре:

<pre class="p-2 bg-black/5 rounded-md">
{
  "name": "Полное имя персонажа",
  "aliases": ["Псевдоним 1", "Псевдоним 2"],
  "description": "Краткое описание персонажа (2-3 предложения)",
  "keywords": ["черта характера 1", "особенность 2", "привычка 3"],
  "quotes": ["Характерная фраза 1", "Цитата 2", "Фраза 3"],
  "imageUrls": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
}
</pre>

<span class="text-amber-500 font-semibold">ВАЖНО для поля imageUrls:</span> предоставь только прямые ссылки на изображения (заканчивающиеся на .jpg, .png или .webp), которые можно использовать в теге &lt;img src="..."&gt;. Убедись, что это не ссылки на страницы сайтов, а прямые URL-адреса к файлам изображений.

Возврати только валидный JSON без дополнительного текста.`;
  };

  const handleCopyPrompt = () => {
    // Копируем оригинальный промпт без HTML-разметки
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
      
      // Заполняем форму данными из JSON
      if (parsedData.name) {
        setName(parsedData.name);
      }
      
      if (parsedData.aliases && Array.isArray(parsedData.aliases)) {
        setAliases(parsedData.aliases.join(', '));
      }
      
      if (parsedData.description) {
        setDescription(parsedData.description);
      }
      
      if (parsedData.keywords && Array.isArray(parsedData.keywords)) {
        setKeywords(parsedData.keywords.join(', '));
      }
      
      if (parsedData.imageUrls && Array.isArray(parsedData.imageUrls)) {
        // Фильтруем только валидные URL изображений
        const validImageUrls = parsedData.imageUrls.filter(url => 
          url.match(/^https?:\/\/.*\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i)
        );
        setImageUrls(validImageUrls);
      }
      
      toast.success('JSON успешно обработан и заполнены поля формы');
    } catch (error) {
      console.error('Ошибка парсинга JSON:', error);
      setParsingError('Не удалось разобрать JSON-ответ. Проверьте формат ответа от ChatGPT.');
      toast.error('Ошибка при обработке ответа ChatGPT');
    }
  };

  const handleAddImageUrl = () => {
    if (newImageUrl.trim()) {
      setImageUrls([...imageUrls, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const handleRemoveImageUrl = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Имя персонажа обязательно');
      return;
    }
    
    const aliasesArray = aliases.split(',')
      .map(alias => alias.trim())
      .filter(alias => alias.length > 0);
      
    const keywordsArray = keywords.split(',')
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0);
    
    const payload = {
      seriesId,
      name: name.trim(),
      aliases: aliasesArray,
      description: description.trim(),
      keywords: keywordsArray,
      imageUrls: imageUrls
    };
    
    try {
      setIsSubmitting(true);
      
      const url = isEditing 
        ? `/api/characters/${character.id}`
        : '/api/characters';
        
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(isEditing 
          ? 'Не удалось обновить персонажа' 
          : 'Не удалось создать персонажа'
        );
      }
      
      const data = await response.json();
      toast.success(isEditing 
        ? 'Персонаж успешно обновлен' 
        : 'Персонаж успешно создан'
      );
      onSuccess(data);
    } catch (error) {
      console.error('Failed to save character:', error);
      toast.error(isEditing 
        ? 'Ошибка при обновлении персонажа' 
        : 'Ошибка при создании персонажа'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Блок с промптом */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center">
                  <span>Имя персонажа</span>
                  <span className="text-red-500 ml-1">*</span>
                  <span className="ml-auto text-xs text-muted-foreground">(автоматически обновляется в промпте)</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Введите имя персонажа"
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  className={name ? "border-primary" : ""}
                  required
                />
              </div>
              
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
                  Скопируйте этот промпт, вставьте в ChatGPT и используйте результаты для заполнения полей ниже
                </p>
                <div className="p-3 bg-background border rounded-md whitespace-pre-wrap text-sm">
                  <div dangerouslySetInnerHTML={{ __html: getFormattedPrompt() }} />
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
              Обработать и заполнить форму
            </Button>
          </CardContent>
        </Card>

        {/* Базовая информация */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Основная информация</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aliases">Псевдонимы</Label>
                <Input
                  id="aliases"
                  placeholder="Через запятую"
                  value={aliases}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAliases(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  placeholder="Краткое описание персонажа"
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="keywords">Ключевые слова</Label>
                <Textarea
                  id="keywords"
                  placeholder="Через запятую"
                  value={keywords}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setKeywords(e.target.value)}
                  rows={2}
                />
                {keywords && (
                  <div className="p-2 bg-secondary rounded-md mt-1">
                    <div className="flex flex-wrap gap-1">
                      {keywords.split(',')
                        .map(keyword => keyword.trim())
                        .filter(keyword => keyword.length > 0)
                        .map((keyword, idx) => (
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
            </div>
          </CardContent>
        </Card>

        {/* Изображения */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Изображения</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Добавить изображение</Label>
                <div className="flex space-x-2">
                  <Input
                    placeholder="URL изображения"
                    value={newImageUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewImageUrl(e.target.value)}
                  />
                  <Button 
                    type="button" 
                    onClick={handleAddImageUrl}
                    disabled={!newImageUrl.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Вставьте ссылки на изображения из результатов запроса ChatGPT или любые другие подходящие ссылки
                </p>
              </div>
              
              <div className="mt-2 space-y-2">
                <Label htmlFor="bulkImageUrls">Быстрое добавление нескольких URL</Label>
                <Textarea
                  id="bulkImageUrls"
                  placeholder="Вставьте несколько URL изображений, каждый с новой строки"
                  rows={3}
                  onChange={(e) => {
                    const urls = e.target.value
                      .split(/[\n,]/)
                      .map(url => url.trim())
                      .filter(url => url.length > 0 && url.startsWith('http'));
                    
                    if (urls.length > 0) {
                      setImageUrls(prev => [...prev, ...urls]);
                      e.target.value = '';
                      toast.success(`Добавлено ${urls.length} изображений`);
                    }
                  }}
                />
              </div>
              
              {imageUrls.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {imageUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square overflow-hidden rounded-md border">
                        <img 
                          src={url} 
                          alt={`${name || 'Персонаж'} ${index + 1}`}
                          className="object-cover w-full h-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Ошибка+загрузки';
                          }}
                        />
                      </div>
                      <Button 
                        variant="destructive"
                        size="icon"
                        className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveImageUrl(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Сохранение...' : 'Создание...'}
            </>
          ) : (
            isEditing ? 'Сохранить изменения' : 'Создать персонажа'
          )}
        </Button>
      </div>
    </form>
  );
} 