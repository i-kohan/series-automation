'use client';

import { useState } from 'react';
import { Character } from '@/lib/types/character';
import { CharacterMatch, ChatGptResponse } from '../types';
import { calculateStringMatchScore } from '../utils';

interface UseCharacterMatchingProps {
  characters: Character[];
  onMatchingComplete?: (matches: CharacterMatch[]) => void; 
}

export function useCharacterMatching({ characters, onMatchingComplete }: UseCharacterMatchingProps) {
  const [characterMatches, setCharacterMatches] = useState<CharacterMatch[]>([]);
  const [showCharacterMatching, setShowCharacterMatching] = useState(false);
  const [parsedCharacters, setParsedCharacters] = useState<string[]>([]);
  const [rawPlotLinesFromChatGpt, setRawPlotLinesFromChatGpt] = useState<ChatGptResponse['plotLines']>([]);

  // Функция для сопоставления персонажей
  const matchCharacters = (gptCharacters: string[]) => {
    if (gptCharacters.length === 0 || characters.length === 0) {
      if (onMatchingComplete) {
        onMatchingComplete([]);
      }
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
    if (!hasUnmatched && onMatchingComplete) {
      onMatchingComplete(matches);
    }

    return matches;
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
    if (onMatchingComplete) {
      onMatchingComplete(characterMatches);
    }
  };

  // Процесс сопоставления персонажей из ответа ChatGPT
  const processCharactersFromResponse = (parsedData: ChatGptResponse) => {
    // Сохраняем сюжетные линии для последующего использования
    if (parsedData.plotLines && Array.isArray(parsedData.plotLines)) {
      setRawPlotLinesFromChatGpt(parsedData.plotLines);
    }

    // Сохраняем персонажей для последующего использования
    if (parsedData.characters && Array.isArray(parsedData.characters)) {
      setParsedCharacters(parsedData.characters);
      return matchCharacters(parsedData.characters);
    }

    return null;
  };

  return {
    characterMatches,
    showCharacterMatching,
    parsedCharacters,
    rawPlotLinesFromChatGpt,
    matchCharacters,
    handleManualMatch,
    handleSkipCharacter,
    handleResetMatch,
    handleApplyMatching,
    processCharactersFromResponse
  };
} 