export interface Episode {
  id: string;
  seriesId: string;
  title: string;
  descriptions: string[];
  characters: string[]; // ID персонажей, участвующих в серии
  keywords: string[];
  videoUrl?: string; // Ссылка на видеофайл
  plotLines?: PlotLine[]; // Сюжетные линии
  createdAt: string;
  updatedAt: string;
}

export interface PlotLine {
  id: string;
  title: string;
  description: string;
  characters: string[]; // ID персонажей в этой сюжетной линии
  keywords: string[];
}

export interface CreateEpisodeDto {
  seriesId: string;
  title: string;
  descriptions?: string[];
  characters?: string[];
  keywords?: string[];
  videoUrl?: string;
  plotLines?: Omit<PlotLine, "id">[];
}

export interface UpdateEpisodeDto {
  title?: string;
  descriptions?: string[];
  characters?: string[];
  keywords?: string[];
  videoUrl?: string;
  plotLines?: PlotLine[];
} 