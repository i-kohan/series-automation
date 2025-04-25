import { Character, CreateCharacterDto, UpdateCharacterDto } from '../types/character';
import fs from 'fs/promises';
import path from 'path';

const CHARACTERS_DATA_PATH = path.join(process.cwd(), '../shared-data/series/characters.json');

class CharacterRepository {
    private async ensureDataFile(): Promise<void> {
        try {
            await fs.access(CHARACTERS_DATA_PATH);
        } catch {
            await fs.writeFile(CHARACTERS_DATA_PATH, JSON.stringify([]));
        }
    }

    private async readData(): Promise<Character[]> {
        await this.ensureDataFile();
        const data = await fs.readFile(CHARACTERS_DATA_PATH, 'utf-8');
        return JSON.parse(data);
    }

    private async writeData(data: Character[]): Promise<void> {
        await fs.writeFile(CHARACTERS_DATA_PATH, JSON.stringify(data, null, 2));
    }

    async findAll(): Promise<Character[]> {
        return this.readData();
    }

    async findBySeriesId(seriesId: string): Promise<Character[]> {
        const characters = await this.readData();
        return characters.filter(c => c.seriesId === seriesId);
    }

    async findById(id: string): Promise<Character | null> {
        const characters = await this.readData();
        return characters.find(c => c.id === id) || null;
    }

    async create(dto: CreateCharacterDto): Promise<Character> {
        const characters = await this.readData();
        const newCharacter: Character = {
            id: crypto.randomUUID(),
            seriesId: dto.seriesId,
            name: dto.name,
            aliases: dto.aliases || [],
            description: dto.description || '',
            keywords: dto.keywords || [],
            imageUrls: dto.imageUrls || [],
            speechSample: dto.speechSample,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        characters.push(newCharacter);
        await this.writeData(characters);
        return newCharacter;
    }

    async update(id: string, dto: UpdateCharacterDto): Promise<Character | null> {
        const characters = await this.readData();
        const index = characters.findIndex(c => c.id === id);
        if (index === -1) return null;

        const updatedCharacter: Character = {
            ...characters[index],
            ...(dto.name && { name: dto.name }),
            ...(dto.aliases && { aliases: dto.aliases }),
            ...(dto.description && { description: dto.description }),
            ...(dto.keywords && { keywords: dto.keywords }),
            ...(dto.imageUrls !== undefined && { imageUrls: dto.imageUrls }),
            ...(dto.speechSample !== undefined && { speechSample: dto.speechSample }),
            updatedAt: new Date()
        };
        characters[index] = updatedCharacter;
        await this.writeData(characters);
        return updatedCharacter;
    }

    async delete(id: string): Promise<boolean> {
        const characters = await this.readData();
        const index = characters.findIndex(c => c.id === id);
        if (index === -1) return false;

        characters.splice(index, 1);
        await this.writeData(characters);
        return true;
    }

    async deleteBySeriesId(seriesId: string): Promise<number> {
        const characters = await this.readData();
        const initialCount = characters.length;
        const filteredCharacters = characters.filter(c => c.seriesId !== seriesId);
        
        if (filteredCharacters.length < initialCount) {
            await this.writeData(filteredCharacters);
            return initialCount - filteredCharacters.length;
        }
        
        return 0;
    }
}

export const characterRepository = new CharacterRepository(); 