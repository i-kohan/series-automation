'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ChatGptResponse } from '../types';
import { parseJsonResponse } from '../utils';

interface UseChatGptParserProps {
  onParsingSuccess?: (parsedData: ChatGptResponse) => void;
}

export function useChatGptParser({ onParsingSuccess }: UseChatGptParserProps = {}) {
  const [chatGptResponse, setChatGptResponse] = useState<string>('');
  const [parsingError, setParsingError] = useState<string | null>(null);

  // Функция для парсинга JSON-ответа от ChatGPT
  const handleParseResponse = () => {
    try {
      const parsedData = parseJsonResponse(chatGptResponse) as ChatGptResponse;
      setParsingError(null);
      
      if (!parsedData.characters && !parsedData.plotLines) {
        setParsingError('JSON должен содержать поля "characters" и/или "plotLines"');
        toast.error('Некорректный формат JSON');
        return null;
      }
      
      toast.success('JSON успешно обработан');

      // Вызываем колбэк при успешном парсинге
      if (onParsingSuccess) {
        onParsingSuccess(parsedData);
      }

      return parsedData;
    } catch (error) {
      console.error('Ошибка парсинга JSON:', error);
      setParsingError('Не удалось разобрать JSON-ответ. Проверьте формат ответа от ChatGPT.');
      toast.error('Ошибка при обработке ответа ChatGPT');
      return null;
    }
  };

  return {
    chatGptResponse,
    setChatGptResponse,
    parsingError,
    setParsingError,
    parseResponse: handleParseResponse
  };
} 