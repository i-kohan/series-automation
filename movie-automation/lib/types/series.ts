export interface Series {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateSeriesDto {
    title: string;
}

export interface UpdateSeriesDto {
    title: string;
} 