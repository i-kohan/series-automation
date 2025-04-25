import { Episode, CreateEpisodeDto, UpdateEpisodeDto } from '../types/episode';
import { episodeRepository } from '../repositories/episodeRepository';
import { characterRepository } from '../repositories/characterRepository';
import { seriesRepository } from '../repositories/seriesRepository';

class EpisodeService {
  async getAllEpisodes(): Promise<Episode[]> {
    return await episodeRepository.findAll();
  }

  async getEpisodesBySeriesId(seriesId: string): Promise<Episode[]> {
    return await episodeRepository.findBySeriesId(seriesId);
  }

  async getEpisodeById(id: string): Promise<Episode | null> {
    return await episodeRepository.findById(id);
  }

  async createEpisode(dto: CreateEpisodeDto): Promise<Episode> {
    // Проверяем, существует ли сериал
    const series = await seriesRepository.findById(dto.seriesId);
    if (!series) {
      throw new Error('Series not found');
    }

    // Проверяем, существуют ли указанные персонажи и принадлежат ли они этому сериалу
    if (dto.characters && dto.characters.length > 0) {
      const validCharacters = await Promise.all(
        dto.characters.map(async characterId => {
          const character = await characterRepository.findById(characterId);
          return character && character.seriesId === dto.seriesId;
        })
      );

      const allCharactersValid = validCharacters.every(Boolean);
      if (!allCharactersValid) {
        throw new Error('One or more characters are invalid or do not belong to this series');
      }
    }

    return await episodeRepository.create(dto);
  }

  async updateEpisode(id: string, dto: UpdateEpisodeDto): Promise<Episode | null> {
    const episode = await episodeRepository.findById(id);
    if (!episode) {
      return null;
    }

    // Проверяем, существуют ли указанные персонажи и принадлежат ли они этому сериалу
    if (dto.characters && dto.characters.length > 0) {
      const validCharacters = await Promise.all(
        dto.characters.map(async characterId => {
          const character = await characterRepository.findById(characterId);
          return character && character.seriesId === episode.seriesId;
        })
      );

      const allCharactersValid = validCharacters.every(Boolean);
      if (!allCharactersValid) {
        throw new Error('One or more characters are invalid or do not belong to this series');
      }
    }

    return await episodeRepository.update(id, dto);
  }

  async deleteEpisode(id: string): Promise<boolean> {
    return await episodeRepository.delete(id);
  }

  async deleteEpisodesBySeriesId(seriesId: string): Promise<number> {
    return await episodeRepository.deleteBySeriesId(seriesId);
  }
}

export const episodeService = new EpisodeService(); 