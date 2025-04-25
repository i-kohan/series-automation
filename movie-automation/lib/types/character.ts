export interface Character {
  id: string;
  seriesId: string;
  name: string;
  aliases: string[];
  description: string;
  keywords: string[];
  imageUrls?: string[];
  speechSample?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCharacterDto {
  seriesId: string;
  name: string;
  aliases?: string[];
  description?: string;
  keywords?: string[];
  imageUrls?: string[];
  speechSample?: string;
}

export interface UpdateCharacterDto {
  name?: string;
  aliases?: string[];
  description?: string;
  keywords?: string[];
  imageUrls?: string[];
  speechSample?: string;
} 