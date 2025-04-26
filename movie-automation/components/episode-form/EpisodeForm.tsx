'use client';

import { useState, useEffect } from 'react';
import { Episode } from '@/lib/types/episode';
import { Character } from '@/lib/types/character';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { SimplePlotLine } from './types';
import { getEpisodePrompt } from './utils';

// Импортируем созданные компоненты
import { EpisodeDescriptionsSection } from './EpisodeDescriptionsSection';


// Импортируем хуки
import { useCharacterMatching } from './hooks/useCharacterMatching';
import { useChatGptParser } from './hooks/useChatGptParser';
import { ChatGptResponseInput } from '../ChatGptResponseInput';
import { CopyPromptCard } from '../CopyPromptCard';
import { CharacterMatchingSection } from './CharacterMatchingSection';
import { EpisodeCharactersSection } from './EpisodeCharactersSection';
import { EpisodeKeywordsSection } from './EpisodeKeywordsSection';
import { PlotLinesSection } from './PlotLinesSection';

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
  const [plotLines, setPlotLines] = useState<SimplePlotLine[]>(
    episode?.plotLines?.map(pl => ({
      id: pl.id,
      title: pl.title,
      description: pl.description,
      characters: pl.characters || [],
      keywords: pl.keywords || []
    })) || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [seriesTitle, setSeriesTitle] = useState<string>('');
  const isEditing = !!episode;

  // Используем созданные хуки
  const {
    characterMatches,
    showCharacterMatching,
    rawPlotLinesFromChatGpt,
    handleManualMatch,
    handleSkipCharacter,
    handleResetMatch,
    handleApplyMatching,
    processCharactersFromResponse
  } = useCharacterMatching({ 
    characters,
    onMatchingComplete: applyMatchingResultsToPlotLines
  });

  const {
    chatGptResponse,
    setChatGptResponse,
    parsingError,
    parseResponse
  } = useChatGptParser({
    onParsingSuccess: (parsedData) => {
      // Ключевые слова
      if (parsedData.keywords && Array.isArray(parsedData.keywords)) {
        setKeywords(parsedData.keywords.join(', '));
      }
      
      // Обрабатываем персонажей и сюжетные линии
      processCharactersFromResponse(parsedData);
    }
  });

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
    
    toast.success(`Добавлено ${createdCharacters.length} новых персонажей`);
  };

  // Обработчики описаний
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

  // Управление выбором персонажей
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

  const handlePlotLineChange = (index: number, key: keyof SimplePlotLine, value: string | string[]) => {
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
  
  // Применение результатов сопоставления к сюжетным линиям
  function applyMatchingResultsToPlotLines(matches: typeof characterMatches) {
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
  }

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

      {/* Описания/сюжеты - используем компонент */}
      <EpisodeDescriptionsSection 
        descriptions={descriptions}
        onDescriptionChange={handleDescriptionChange}
        onAddDescription={handleAddDescription}
        onRemoveDescription={handleRemoveDescription}
      />

      {/* Промпт-секция - используем компонент */}
      <CopyPromptCard
        title="Промпт для ChatGPT"
        description="Скопируйте этот промпт и отправьте в ChatGPT. Полученные результаты можно использовать, чтобы заполнить информацию о серии и добавить сюжетные линии."
        prompt={getEpisodePrompt(title, seriesTitle, descriptions)}
      />

      {/* Обработка ответа ChatGPT - используем компонент */}
      <div>
        <h2 className="text-xl font-bold mb-4">Обработка ответа ChatGPT</h2>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <ChatGptResponseInput
              value={chatGptResponse}
              onChange={setChatGptResponse}
              onParse={parseResponse}
              parsingError={parsingError}
              buttonLabel="Обработать и заполнить форму"
            />
          </CardContent>
        </Card>
      </div>

      {/* Интерфейс сопоставления персонажей - используем компонент */}
      {showCharacterMatching && characterMatches.length > 0 && (
        <CharacterMatchingSection
          seriesId={seriesId}
          seriesTitle={seriesTitle}
          characterMatches={characterMatches}
          characters={characters}
          onManualMatch={handleManualMatch}
          onSkipCharacter={handleSkipCharacter}
          onResetMatch={handleResetMatch}
          onApplyMatching={handleApplyMatching}
          onCharactersCreated={handleCharactersCreated}
        />
      )}

      {/* Ключевые слова - используем компонент */}
      <EpisodeKeywordsSection 
        keywords={keywords}
        onChange={setKeywords}
      />

      {/* Персонажи - используем компонент */}
      <EpisodeCharactersSection
        characters={characters}
        selectedCharacters={selectedCharacters}
        onCharacterToggle={handleCharacterToggle}
      />

      {/* Сюжетные линии - используем компонент */}
      <PlotLinesSection
        plotLines={plotLines}
        characters={characters}
        onAddPlotLine={handleAddPlotLine}
        onRemovePlotLine={handleRemovePlotLine}
        onPlotLineChange={handlePlotLineChange}
        onPlotLineCharacterToggle={handlePlotLineCharacterToggle}
      />
      
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