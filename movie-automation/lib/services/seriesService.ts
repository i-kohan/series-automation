import { Series, CreateSeriesDto, UpdateSeriesDto } from '../types/series';
import { seriesRepository } from '../repositories/seriesRepository';
import { characterService } from './characterService';
import { episodeService } from './episodeService';

class SeriesService {
    async getAllSeries(): Promise<Series[]> {
        return await seriesRepository.findAll();
    }

    async getSeriesById(id: string): Promise<Series | null> {
        return await seriesRepository.findById(id);
    }

    async createSeries(dto: CreateSeriesDto): Promise<Series> {
        return await seriesRepository.create(dto);
    }

    async updateSeries(id: string, dto: UpdateSeriesDto): Promise<Series | null> {
        return await seriesRepository.update(id, dto);
    }

    async deleteSeries(id: string): Promise<boolean> {
        // Удаляем все персонажи, связанные с этим сериалом
        await characterService.deleteCharactersBySeriesId(id);
        
        // Удаляем все серии, связанные с этим сериалом
        await episodeService.deleteEpisodesBySeriesId(id);
        
        // Удаляем сам сериал
        return await seriesRepository.delete(id);
    }
}

// Создаем синглтон для сервиса
export const seriesService = new SeriesService(); 