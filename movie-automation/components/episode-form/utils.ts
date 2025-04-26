/**
 * Генерирует промпт для ChatGPT на основе информации о серии
 */
export function getEpisodePrompt(
  title: string, 
  seriesTitle: string, 
  descriptions: string[]
): string {
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
}

/**
 * Рассчитывает степень сходства между двумя строками (от 0 до 1)
 */
export function calculateStringMatchScore(str1: string, str2: string): number {
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
}

/**
 * Парсит JSON-ответ от ChatGPT
 */
export function parseJsonResponse(jsonText: string) {
  // Если текст содержит блоки кода, извлекаем JSON из первого блока
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonText = codeBlockMatch[1].trim();
  }
  
  return JSON.parse(jsonText);
} 