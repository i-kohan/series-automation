import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Episode, CreateEpisodeDto, UpdateEpisodeDto } from '../types/episode';

class EpisodeRepository {
  private dataPath: string;

  constructor() {
    this.dataPath = path.join(process.cwd(), '../shared-data/series/episodes.json');
    this.ensureDataFileExists();
  }

  private ensureDataFileExists(): void {
    const dirPath = path.dirname(this.dataPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    if (!fs.existsSync(this.dataPath)) {
      fs.writeFileSync(this.dataPath, JSON.stringify([]));
    }
  }

  private async readData(): Promise<Episode[]> {
    const data = await fs.promises.readFile(this.dataPath, 'utf-8');
    return JSON.parse(data || '[]');
  }

  private async writeData(data: Episode[]): Promise<void> {
    await fs.promises.writeFile(this.dataPath, JSON.stringify(data, null, 2));
  }

  async findAll(): Promise<Episode[]> {
    return await this.readData();
  }

  async findBySeriesId(seriesId: string): Promise<Episode[]> {
    const episodes = await this.readData();
    return episodes.filter(episode => episode.seriesId === seriesId);
  }

  async findById(id: string): Promise<Episode | null> {
    const episodes = await this.readData();
    return episodes.find(episode => episode.id === id) || null;
  }

  async create(dto: CreateEpisodeDto): Promise<Episode> {
    const episodes = await this.readData();
    
    const now = new Date().toISOString();
    
    // Создаем ID для каждой сюжетной линии
    const plotLines = dto.plotLines ? dto.plotLines.map(plotLine => ({
      ...plotLine,
      id: uuidv4()
    })) : undefined;
    
    const newEpisode: Episode = {
      id: uuidv4(),
      seriesId: dto.seriesId,
      title: dto.title,
      descriptions: dto.descriptions || [],
      characters: dto.characters || [],
      keywords: dto.keywords || [],
      videoUrl: dto.videoUrl,
      plotLines,
      createdAt: now,
      updatedAt: now
    };
    
    episodes.push(newEpisode);
    await this.writeData(episodes);
    
    return newEpisode;
  }

  async update(id: string, dto: UpdateEpisodeDto): Promise<Episode | null> {
    const episodes = await this.readData();
    const index = episodes.findIndex(episode => episode.id === id);
    
    if (index === -1) {
      return null;
    }
    
    // Если обновляем сюжетные линии, проверяем/назначаем ID для каждой линии
    let plotLines = dto.plotLines;
    if (plotLines) {
      plotLines = plotLines.map(plotLine => {
        // Если у сюжетной линии нет ID, назначаем новый
        if (!plotLine.id) {
          return { ...plotLine, id: uuidv4() };
        }
        return plotLine;
      });
    }
    
    const updatedEpisode = {
      ...episodes[index],
      ...dto,
      plotLines,
      updatedAt: new Date().toISOString()
    };
    
    episodes[index] = updatedEpisode;
    await this.writeData(episodes);
    
    return updatedEpisode;
  }

  async delete(id: string): Promise<boolean> {
    const episodes = await this.readData();
    const initialLength = episodes.length;
    
    const filteredEpisodes = episodes.filter(episode => episode.id !== id);
    
    if (filteredEpisodes.length === initialLength) {
      return false;
    }
    
    await this.writeData(filteredEpisodes);
    return true;
  }

  async deleteBySeriesId(seriesId: string): Promise<number> {
    const episodes = await this.readData();
    const initialLength = episodes.length;
    
    const filteredEpisodes = episodes.filter(episode => episode.seriesId !== seriesId);
    const deletedCount = initialLength - filteredEpisodes.length;
    
    await this.writeData(filteredEpisodes);
    return deletedCount;
  }
}

export const episodeRepository = new EpisodeRepository(); 