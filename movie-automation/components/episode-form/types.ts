import { Character } from '@/lib/types/character';

// Интерфейс для JSON-ответа от ChatGPT
export interface ChatGptResponse {
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
export interface CharacterMatch {
  name: string; // Имя персонажа из ChatGPT
  existingCharacter: Character | null; // Найденный существующий персонаж
  matchScore: number; // Оценка совпадения (0-1)
  status: 'matched' | 'unmatched' | 'manual' | 'skipped'; // Статус сопоставления
  selectedCharacterId?: string; // ID выбранного вручную персонажа
}

// Упрощенная структура сюжетной линии для внутреннего использования
export interface SimplePlotLine {
  id?: string;
  title: string;
  description: string;
  characters: string[];
  keywords: string[];
} 