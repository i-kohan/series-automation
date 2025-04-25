import { NextResponse } from 'next/server';
import { seriesService } from '@/lib/services/seriesService';
import { UpdateSeriesDto } from '@/lib/types/series';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const series = await seriesService.getSeriesById(params.id);
        if (!series) {
            return NextResponse.json(
                { error: 'Series not found' },
                { status: 404 }
            );
        }
        return NextResponse.json(series);
    } catch (error) {
        console.error('Failed to fetch series:', error);
        return NextResponse.json(
            { error: 'Failed to fetch series' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();
        const dto: UpdateSeriesDto = {
            title: body.title
        };

        const series = await seriesService.updateSeries(params.id, dto);
        if (!series) {
            return NextResponse.json(
                { error: 'Series not found' },
                { status: 404 }
            );
        }
        return NextResponse.json(series);
    } catch (error) {
        console.error('Failed to update series:', error);
        return NextResponse.json(
            { error: 'Failed to update series' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const success = await seriesService.deleteSeries(params.id);
        if (!success) {
            return NextResponse.json(
                { error: 'Series not found' },
                { status: 404 }
            );
        }
        return NextResponse.json({ message: 'Series deleted successfully' });
    } catch (error) {
        console.error('Failed to delete series:', error);
        return NextResponse.json(
            { error: 'Failed to delete series' },
            { status: 500 }
        );
    }
} 