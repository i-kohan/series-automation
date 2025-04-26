'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface ChatGptResponseInputProps {
  value: string;
  onChange: (value: string) => void;
  onParse: () => void;
  parsingError: string | null;
  rows?: number;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  buttonLabel?: string;
}

export function ChatGptResponseInput({
  value,
  onChange,
  onParse,
  parsingError,
  rows = 8,
  disabled = false,
  placeholder = 'Вставьте сюда весь ответ от ChatGPT в формате JSON...',
  label = 'Вставьте ответ от ChatGPT',
  buttonLabel = 'Обработать и проверить'
}: ChatGptResponseInputProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="chatgpt-response">{label}</Label>
        <Textarea
          id="chatgpt-response"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="font-mono text-sm"
          disabled={disabled}
        />
        {parsingError && (
          <p className="text-sm text-red-500">{parsingError}</p>
        )}
      </div>
      <Button 
        type="button" 
        onClick={onParse}
        disabled={disabled || !value.trim()}
        className="w-full"
      >
        {buttonLabel}
      </Button>
    </div>
  );
} 