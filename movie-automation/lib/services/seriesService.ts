import { Series, CreateSeriesDto, UpdateSeriesDto } from '../types/series';
import { seriesRepository } from '../repositories/seriesRepository';

export class SeriesService {
    async getAllSeries(): Promise<Series[]> {
        return seriesRepository.findAll();
    }

    async getSeriesById(id: string): Promise<Series | null> {
        return seriesRepository.findById(id);
    }

    async createSeries(dto: CreateSeriesDto): Promise<Series> {
        return seriesRepository.create(dto);
    }

    async updateSeries(id: string, dto: UpdateSeriesDto): Promise<Series | null> {
        return seriesRepository.update(id, dto);
    }

    async deleteSeries(id: string): Promise<boolean> {
        return seriesRepository.delete(id);
    }
}

// Создаем синглтон для сервиса
export const seriesService = new SeriesService(); 