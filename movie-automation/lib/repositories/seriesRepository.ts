import { Series, CreateSeriesDto, UpdateSeriesDto } from '../types/series';
import fs from 'fs/promises';
import path from 'path';

const SERIES_DATA_PATH = path.join(process.cwd(), '../shared-data/series/series.json');

class SeriesRepository {
    private async ensureDataFile(): Promise<void> {
        try {
            await fs.access(SERIES_DATA_PATH);
        } catch {
            await fs.writeFile(SERIES_DATA_PATH, JSON.stringify([]));
        }
    }

    private async readData(): Promise<Series[]> {
        await this.ensureDataFile();
        const data = await fs.readFile(SERIES_DATA_PATH, 'utf-8');
        return JSON.parse(data);
    }

    private async writeData(data: Series[]): Promise<void> {
        await fs.writeFile(SERIES_DATA_PATH, JSON.stringify(data, null, 2));
    }

    async findAll(): Promise<Series[]> {
        return this.readData();
    }

    async findById(id: string): Promise<Series | null> {
        const series = await this.readData();
        return series.find(s => s.id === id) || null;
    }

    async create(dto: CreateSeriesDto): Promise<Series> {
        const series = await this.readData();
        const newSeries: Series = {
            id: crypto.randomUUID(),
            title: dto.title,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        series.push(newSeries);
        await this.writeData(series);
        return newSeries;
    }

    async update(id: string, dto: UpdateSeriesDto): Promise<Series | null> {
        const series = await this.readData();
        const index = series.findIndex(s => s.id === id);
        if (index === -1) return null;

        const updatedSeries: Series = {
            ...series[index],
            title: dto.title,
            updatedAt: new Date()
        };
        series[index] = updatedSeries;
        await this.writeData(series);
        return updatedSeries;
    }

    async delete(id: string): Promise<boolean> {
        const series = await this.readData();
        const index = series.findIndex(s => s.id === id);
        if (index === -1) return false;

        series.splice(index, 1);
        await this.writeData(series);
        return true;
    }
}

export const seriesRepository = new SeriesRepository(); 