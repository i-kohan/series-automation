import { NextResponse } from 'next/server';
import { seriesService } from '@/lib/services/seriesService';
import { CreateSeriesDto } from '@/lib/types/series';

export async function GET() {
    try {
        const series = await seriesService.getAllSeries();
        return NextResponse.json(series);
    } catch (error) {
        console.error('Failed to fetch series:', error);
        return NextResponse.json(
            { error: 'Failed to fetch series' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const dto: CreateSeriesDto = {
            title: body.title
        };

        const series = await seriesService.createSeries(dto);
        return NextResponse.json(series);
    } catch (error) {
        console.error('Failed to create series:', error);
        return NextResponse.json(
            { error: 'Failed to create series' },
            { status: 500 }
        );
    }
} 