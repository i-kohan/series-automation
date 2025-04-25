import { Character, CreateCharacterDto, UpdateCharacterDto } from '../types/character';
import { characterRepository } from '../repositories/characterRepository';

export class CharacterService {
    async getAllCharacters(): Promise<Character[]> {
        return characterRepository.findAll();
    }

    async getCharactersBySeriesId(seriesId: string): Promise<Character[]> {
        return characterRepository.findBySeriesId(seriesId);
    }

    async getCharacterById(id: string): Promise<Character | null> {
        return characterRepository.findById(id);
    }

    async createCharacter(dto: CreateCharacterDto): Promise<Character> {
        return characterRepository.create(dto);
    }

    async updateCharacter(id: string, dto: UpdateCharacterDto): Promise<Character | null> {
        return characterRepository.update(id, dto);
    }

    async deleteCharacter(id: string): Promise<boolean> {
        return characterRepository.delete(id);
    }

    async deleteCharactersBySeriesId(seriesId: string): Promise<number> {
        return characterRepository.deleteBySeriesId(seriesId);
    }
}

// Создаем синглтон для сервиса
export const characterService = new CharacterService(); 