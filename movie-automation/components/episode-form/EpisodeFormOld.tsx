'use client';

import { useState, useEffect } from 'react';
import { Episode, PlotLine } from '@/lib/types/episode';
import { Character } from '@/lib/types/character';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Plus, X, Copy, CheckCircle2, Check, AlertTriangle } from 'lucide-react';
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
import { CreateNewCharactersDialog } from '@/components/CreateNewCharactersDialog';

// Интерфейс для JSON-ответа от ChatGPT
interface ChatGptResponse {
  keywords: string[];
  characters: string[];
  plotLines: {
    title: string;
    description: string;
    scenes: string[];
    characters: string[];
    keywords: string[];
    emotions: string[];
  }[];
}

// Структура для сопоставления персонажей
interface CharacterMatch {
  name: string; // Имя персонажа из ChatGPT
  existingCharacter: Character | null; // Найденный существующий персонаж
  matchScore: number; // Оценка совпадения (0-1)
  status: 'matched' | 'unmatched' | 'manual' | 'skipped'; // Статус сопоставления
  selectedCharacterId?: string; // ID выбранного вручную персонажа
}

interface EpisodeFormProps {
  seriesId: string;
  episode?: Episode;
  onSuccess: (episode: Episode) => void;
}

export function EpisodeForm({ seriesId, episode, onSuccess }: EpisodeFormProps) {
  const [title, setTitle] = useState(episode?.title || '');
  const [descriptions, setDescriptions] = useState<string[]>(episode?.descriptions || ['']);
  const [keywords, setKeywords] = useState(episode?.keywords?.join(', ') || '');
  const [videoUrl, setVideoUrl] = useState(episode?.videoUrl || '');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>(episode?.characters || []);
  const [plotLines, setPlotLines] = useState<(Omit<PlotLine, "id"> & { id?: string })[]>(
    episode?.plotLines || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [seriesTitle, setSeriesTitle] = useState<string>('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [chatGptResponse, setChatGptResponse] = useState<string>('');
  const [parsingError, setParsingError] = useState<string | null>(null);
  const isEditing = !!episode;

  // Новые состояния для сопоставления персонажей
  const [characterMatches, setCharacterMatches] = useState<CharacterMatch[]>([]);
  const [showCharacterMatching, setShowCharacterMatching] = useState(false);
  const [parsedCharacters, setParsedCharacters] = useState<string[]>([]);
  const [rawPlotLinesFromChatGpt, setRawPlotLinesFromChatGpt] = useState<ChatGptResponse['plotLines']>([]);

  // Загрузка персонажей для выбора
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Загрузка персонажей
        const charactersResponse = await fetch(`/api/characters?seriesId=${seriesId}`);
        if (!charactersResponse.ok) throw new Error('Не удалось получить персонажей');
        const charactersData = await charactersResponse.json();
        setCharacters(charactersData);
        
        // Загрузка информации о сериале
        const seriesResponse = await fetch(`/api/series/${seriesId}`);
        if (!seriesResponse.ok) throw new Error('Не удалось получить информацию о сериале');
        const seriesData = await seriesResponse.json();
        setSeriesTitle(seriesData.title);
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        toast.error('Не удалось загрузить необходимые данные');
      }
    };

    fetchData();
  }, [seriesId]);

  // Обработчик для создания новых персонажей
  const handleCharactersCreated = (createdCharacters: Character[]) => {
    // Добавляем новых персонажей в список существующих
    setCharacters(prev => [...prev, ...createdCharacters]);
    
    // Повторно выполняем сопоставление с сохраненными персонажами из ChatGPT
    if (parsedCharacters.length > 0) {
      matchCharacters(parsedCharacters);
    }
    
    toast.success(`Добавлено ${createdCharacters.length} новых персонажей`);
  };

  // Промпт для ChatGPT
  const getPrompt = () => {
    return `Помоги мне разработать детальную структуру для серии "${title || '[НАЗВАНИЕ СЕРИИ]'}" 
из сериала "${seriesTitle || '[НАЗВАНИЕ СЕРИАЛА]'}".

У меня есть следующие описания серии:
${descriptions.map((desc, i) => desc ? `${i+1}. ${desc}` : '').filter(Boolean).join('\n')}

ВАЖНО: По этим описаниям будет создаваться видеоконтент с использованием embeddings, поэтому описания должны быть визуально представимыми, подробными и последовательными. Они должны содержать достаточно деталей для генерации визуальных сцен.

Проанализируй информацию и создай целостную структуру серии. Определи основные сюжетные линии (не указывая прерывания между ними) и представь всю информацию в формате JSON по следующей структуре:

\`\`\`json
{
  "keywords": ["ключевое слово 1", "ключевое слово 2", ...],
  "characters": ["персонаж 1", "персонаж 2", ...],
  "plotLines": [
    {
      "title": "Название первой сюжетной линии",
      "description": "Детальное описание этой сюжетной линии",
      "scenes": [
        "Сцена 1: Место, время. Описание действий персонажей и деталей сцены.",
        "Сцена 2: Место, время. Описание действий персонажей и деталей сцены.",
        ...
      ],
      "characters": ["персонаж 1", "персонаж 2", ...],
      "keywords": ["ключевое слово 1", "ключевое слово 2", ...],
      "emotions": ["эмоция 1", "эмоция 2", ...]
    },
    {
      "title": "Название второй сюжетной линии",
      ...
    }
  ]
}
\`\`\`

Каждая сцена должна быть визуально представимой, с указанием места, времени и конкретных действий персонажей. Если сюжетные линии переплетаются и влияют друг на друга, учти это в описаниях, но не указывай переходы между ними.

Если одни и те же персонажи участвуют в разных сюжетных линиях, добавь их в массив characters для каждой соответствующей сюжетной линии.

Обязательно верни результат в виде валидного JSON-объекта, который можно будет автоматически разобрать.`;
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(getPrompt());
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
    toast.success('Промпт скопирован');
  };

  const handleAddDescription = () => {
    setDescriptions([...descriptions, '']);
  };

  const handleDescriptionChange = (index: number, value: string) => {
    const newDescriptions = [...descriptions];
    newDescriptions[index] = value;
    setDescriptions(newDescriptions);
  };

  const handleRemoveDescription = (index: number) => {
    const newDescriptions = [...descriptions];
    newDescriptions.splice(index, 1);
    setDescriptions(newDescriptions);
  };

  const handleCharacterToggle = (characterId: string) => {
    setSelectedCharacters(prev => 
      prev.includes(characterId)
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    );
  };

  // Управление сюжетными линиями
  const handleAddPlotLine = () => {
    setPlotLines([...plotLines, {
      title: '',
      description: '',
      characters: [],
      keywords: []
    }]);
  };

  const handleRemovePlotLine = (index: number) => {
    const newPlotLines = [...plotLines];
    newPlotLines.splice(index, 1);
    setPlotLines(newPlotLines);
  };

  const handlePlotLineChange = (index: number, key: keyof Omit<PlotLine, "id">, value: string | string[]) => {
    const newPlotLines = [...plotLines];
    newPlotLines[index] = {
      ...newPlotLines[index],
      [key]: value
    };
    setPlotLines(newPlotLines);
  };

  const handlePlotLineCharacterToggle = (plotLineIndex: number, characterId: string) => {
    const plotLine = plotLines[plotLineIndex];
    const currentCharacters = plotLine.characters || [];
    const updatedCharacters = currentCharacters.includes(characterId)
      ? currentCharacters.filter(id => id !== characterId)
      : [...currentCharacters, characterId];
    
    handlePlotLineChange(plotLineIndex, 'characters', updatedCharacters);
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
      
      const parsedData = JSON.parse(jsonText) as ChatGptResponse;
      setParsingError(null);
      
      // Заполняем форму данными из JSON
      
      // Ключевые слова
      if (parsedData.keywords && Array.isArray(parsedData.keywords)) {
        setKeywords(parsedData.keywords.join(', '));
      }
      
      // Сохраняем исходные данные для дальнейшей обработки
      if (parsedData.characters && Array.isArray(parsedData.characters)) {
        // Сохраняем персонажей для последующего использования
        setParsedCharacters(parsedData.characters);
        
        // Выполняем сопоставление персонажей
        matchCharacters(parsedData.characters);
      }
      
      if (parsedData.plotLines && Array.isArray(parsedData.plotLines)) {
        setRawPlotLinesFromChatGpt(parsedData.plotLines);
      }
      
      toast.success('JSON успешно обработан');
    } catch (error) {
      console.error('Ошибка парсинга JSON:', error);
      setParsingError('Не удалось разобрать JSON-ответ. Проверьте формат ответа от ChatGPT.');
      toast.error('Ошибка при обработке ответа ChatGPT');
    }
  };

  // Функция для сопоставления персонажей
  const matchCharacters = (gptCharacters: string[]) => {
    if (gptCharacters.length === 0 || characters.length === 0) {
      // Если нет персонажей для сопоставления или нет существующих персонажей,
      // пропускаем этап сопоставления
      applyMatchingResultsToPlotLines([]);
      return;
    }
    
    const matches: CharacterMatch[] = gptCharacters.map(charName => {
      // Ищем потенциальные совпадения
      const potentialMatches = characters.map(existingChar => {
        const nameScore = calculateStringMatchScore(charName, existingChar.name);
        
        // Сравниваем с псевдонимами
        let aliasScore = 0;
        if (existingChar.aliases && existingChar.aliases.length > 0) {
          for (const alias of existingChar.aliases) {
            aliasScore = Math.max(aliasScore, calculateStringMatchScore(charName, alias));
          }
        }
        
        // Общий счет - максимум между именем и псевдонимами
        const totalScore = Math.max(nameScore, aliasScore);
        
        return {
          character: existingChar,
          score: totalScore
        };
      });
      
      // Сортируем совпадения по убыванию счета
      potentialMatches.sort((a, b) => b.score - a.score);
      
      // Если есть хорошее совпадение (более 80%), считаем его автоматическим совпадением
      if (potentialMatches.length > 0 && potentialMatches[0].score >= 0.8) {
        return {
          name: charName,
          existingCharacter: potentialMatches[0].character,
          matchScore: potentialMatches[0].score,
          status: 'matched' as const
        };
      }
      
      return {
        name: charName,
        existingCharacter: null,
        matchScore: potentialMatches.length > 0 ? potentialMatches[0].score : 0,
        status: 'unmatched' as const
      };
    });
    
    setCharacterMatches(matches);
    
    // Определяем, нужно ли показывать интерфейс сопоставления
    const hasUnmatched = matches.some(match => match.status === 'unmatched');
    setShowCharacterMatching(hasUnmatched);
    
    // Если все персонажи сопоставлены автоматически, сразу применяем результаты
    if (!hasUnmatched) {
      applyMatchingResultsToPlotLines(matches);
    }
  };
  
  // Функция для расчета степени сходства строк (0-1)
  const calculateStringMatchScore = (str1: string, str2: string): number => {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // Точное совпадение
    if (s1 === s2) return 1;
    
    // Одна строка содержит другую
    if (s1.includes(s2) || s2.includes(s1)) {
      const ratio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
      return 0.8 + (0.2 * ratio);
    }
    
    // Простой алгоритм расстояния Левенштейна для частичного совпадения
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1;
    
    let similarity = 0;
    const minLen = Math.min(s1.length, s2.length);
    
    for (let i = 0; i < minLen; i++) {
      if (s1[i] === s2[i]) similarity++;
    }
    
    return similarity / maxLen;
  };
  
  // Обработка выбора персонажа вручную
  const handleManualMatch = (index: number, characterId: string) => {
    setCharacterMatches(prev => {
      const newMatches = [...prev];
      const selectedCharacter = characters.find(c => c.id === characterId) || null;
      
      newMatches[index] = {
        ...newMatches[index],
        existingCharacter: selectedCharacter,
        selectedCharacterId: characterId,
        status: 'manual'
      };
      
      return newMatches;
    });
  };
  
  // Пометка персонажа как пропущенного
  const handleSkipCharacter = (index: number) => {
    setCharacterMatches(prev => {
      const newMatches = [...prev];
      newMatches[index] = {
        ...newMatches[index],
        existingCharacter: null,
        selectedCharacterId: undefined,
        status: 'skipped'
      };
      return newMatches;
    });
  };
  
  // Сброс сопоставления
  const handleResetMatch = (index: number) => {
    setCharacterMatches(prev => {
      const newMatches = [...prev];
      newMatches[index] = {
        ...newMatches[index],
        existingCharacter: null,
        selectedCharacterId: undefined,
        status: 'unmatched'
      };
      return newMatches;
    });
  };
  
  // Применение результатов сопоставления
  const handleApplyMatching = () => {
    setShowCharacterMatching(false);
    applyMatchingResultsToPlotLines(characterMatches);
  };
  
  // Применение результатов сопоставления к сюжетным линиям
  const applyMatchingResultsToPlotLines = (matches: CharacterMatch[]) => {
    if (!rawPlotLinesFromChatGpt.length) return;
    
    // Создаем карту сопоставлений имя -> id
    const characterMap = new Map<string, string>();
    matches.forEach(match => {
      if (match.existingCharacter && (match.status === 'matched' || match.status === 'manual')) {
        characterMap.set(match.name.toLowerCase(), match.existingCharacter.id);
      }
    });
    
    // Подготавливаем новый список сопоставленных персонажей
    const matchedCharacterIds = Array.from(new Set(
      matches
        .filter(m => m.existingCharacter && (m.status === 'matched' || m.status === 'manual'))
        .map(m => m.existingCharacter!.id)
    ));
    setSelectedCharacters(matchedCharacterIds);
    
    // Обновляем сюжетные линии
    const updatedPlotLines = rawPlotLinesFromChatGpt.map(pl => {
      // Находим ID персонажей для этой сюжетной линии
      const plotLineCharIds: string[] = [];
      if (pl.characters && Array.isArray(pl.characters)) {
        pl.characters.forEach(charName => {
          const charId = characterMap.get(charName.toLowerCase());
          if (charId) {
            plotLineCharIds.push(charId);
          }
        });
      }
      
      // Объединяем сцены в одно описание, если они есть
      let description = pl.description || '';
      if (pl.scenes && Array.isArray(pl.scenes) && pl.scenes.length > 0) {
        description += '\n\n' + pl.scenes.join('\n\n');
      }
      
      return {
        id: undefined, // Для новых сюжетных линий ID будет присвоен сервером
        title: pl.title || '',
        description: description.trim(),
        characters: plotLineCharIds,
        keywords: pl.keywords || []
      };
    });
    
    setPlotLines(updatedPlotLines);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Название серии обязательно');
      return;
    }
    
    // Убираем пустые описания
    const filteredDescriptions = descriptions.filter(desc => desc.trim() !== '');
    
    const keywordsArray = keywords.split(',')
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0);
    
    // Проверяем и фильтруем сюжетные линии
    const validPlotLines = plotLines.filter(plotLine => 
      plotLine.title.trim() !== '' && plotLine.description.trim() !== ''
    );
    
    const payload = {
      seriesId,
      title: title.trim(),
      descriptions: filteredDescriptions,
      characters: selectedCharacters,
      keywords: keywordsArray,
      videoUrl: videoUrl.trim() || undefined,
      plotLines: validPlotLines.length > 0 ? validPlotLines : undefined
    };
    
    try {
      setIsSubmitting(true);
      
      const url = isEditing 
        ? `/api/episodes/${episode.id}`
        : '/api/episodes';
        
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
          ? 'Не удалось обновить серию' 
          : 'Не удалось создать серию'
        );
      }
      
      const data = await response.json();
      toast.success(isEditing 
        ? 'Серия успешно обновлена' 
        : 'Серия успешно создана'
      );
      onSuccess(data);
    } catch (error) {
      console.error('Failed to save episode:', error);
      toast.error(isEditing 
        ? 'Ошибка при обновлении серии' 
        : 'Ошибка при создании серии'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Основная информация - название и ссылка на видео */}
      <div>
        <h2 className="text-xl font-bold mb-4">Основная информация</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="flex items-center">
                  <span>Название серии</span>
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Введите название серии"
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  className={title ? "border-primary" : ""}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="videoUrl">Ссылка на видео</Label>
                <Input
                  id="videoUrl"
                  placeholder="URL видеофайла"
                  value={videoUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVideoUrl(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Описания/сюжеты */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Описания/сюжеты</h2>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handleAddDescription}
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
                    onChange={(e) => handleDescriptionChange(index, e.target.value)}
                    rows={3}
                    className="flex-1"
                  />
                  {descriptions.length > 1 && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="icon"
                      onClick={() => handleRemoveDescription(index)}
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

      {/* Промпт-секция */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">Промпт для ChatGPT</h3>
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
            <p className="text-sm text-muted-foreground mb-4">
              Скопируйте этот промпт и отправьте в ChatGPT. Полученные результаты можно использовать, чтобы заполнить информацию о серии и добавить сюжетные линии.
            </p>
            <div className="p-4 bg-secondary/20 rounded-md whitespace-pre-wrap text-sm font-mono">
              {getPrompt()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Обработка ответа ChatGPT */}
      <div>
        <h2 className="text-xl font-bold mb-4">Обработка ответа ChatGPT</h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
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
      </div>

      {/* Интерфейс сопоставления персонажей */}
      {showCharacterMatching && characterMatches.length > 0 && (
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
                    onSuccess={handleCharactersCreated}
                  />
                  <Button 
                    onClick={handleApplyMatching}
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
                            onValueChange={(value) => handleManualMatch(index, value)}
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
                            onClick={() => handleSkipCharacter(index)}
                          >
                            Пропустить
                          </Button>
                        )}
                        {(match.status === 'matched' || match.status === 'manual' || match.status === 'skipped') && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleResetMatch(index)}
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
                  onClick={handleApplyMatching}
                  disabled={characterMatches.every(m => m.status === 'unmatched')}
                >
                  Применить сопоставления
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ключевые слова */}
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
          </CardContent>
        </Card>
      </div>

      {/* Персонажи */}
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
                      onCheckedChange={() => handleCharacterToggle(character.id)}
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

      {/* Сюжетные линии */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Сюжетные линии ({plotLines.length})</h2>
          <Button 
            type="button" 
            onClick={handleAddPlotLine} 
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
                    onClick={() => handleRemovePlotLine(index)}
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
                      onChange={(e) => handlePlotLineChange(index, 'title', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor={`plotline-description-${index}`}>Описание</Label>
                    <Textarea
                      id={`plotline-description-${index}`}
                      placeholder="Подробное описание сюжетной линии"
                      value={plotLine.description}
                      onChange={(e) => handlePlotLineChange(index, 'description', e.target.value)}
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
                        handlePlotLineChange(index, 'keywords', keywordsArray);
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
                              onCheckedChange={() => handlePlotLineCharacterToggle(index, character.id)}
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
      
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Сохранение...' : 'Создание...'}
            </>
          ) : (
            isEditing ? 'Сохранить изменения' : 'Создать серию'
          )}
        </Button>
      </div>
    </form>
  );
} 