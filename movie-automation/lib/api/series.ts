import { Series, CreateSeriesDto, UpdateSeriesDto } from '../types/series';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const seriesApi = {
    getAll: async (): Promise<Series[]> => {
        const response = await fetch(`${API_URL}/api/series/`);
        if (!response.ok) {
            throw new Error('Failed to fetch series');
        }
        return response.json();
    },

    getById: async (id: number): Promise<Series> => {
        const response = await fetch(`${API_URL}/api/series/${id}`);
        if (!response.ok) {
            throw new Error('Failed to fetch series');
        }
        return response.json();
    },

    create: async (series: CreateSeriesDto): Promise<Series> => {
        const response = await fetch(`${API_URL}/api/series/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(series),
        });
        if (!response.ok) {
            throw new Error('Failed to create series');
        }
        return response.json();
    },

    update: async (id: number, series: UpdateSeriesDto): Promise<Series> => {
        const response = await fetch(`${API_URL}/api/series/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(series),
        });
        if (!response.ok) {
            throw new Error('Failed to update series');
        }
        return response.json();
    },

    delete: async (id: number): Promise<void> => {
        const response = await fetch(`${API_URL}/api/series/${id}`, {
            method: 'DELETE',
        });
        if (!response.ok) {
            throw new Error('Failed to delete series');
        }
    },
}; 