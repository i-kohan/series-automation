import { NextResponse } from 'next/server';
import { episodeService } from '@/lib/services/episodeService';

// Получение списка серий с опциональной фильтрацией по seriesId
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get('seriesId');
    
    if (seriesId) {
      const episodes = await episodeService.getEpisodesBySeriesId(seriesId);
      return NextResponse.json(episodes);
    } else {
      const episodes = await episodeService.getAllEpisodes();
      return NextResponse.json(episodes);
    }
  } catch (error) {
    console.error('Failed to fetch episodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch episodes' },
      { status: 500 }
    );
  }
}

// Создание новой серии
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.seriesId) {
      return NextResponse.json(
        { error: 'Series ID is required' },
        { status: 400 }
      );
    }
    
    if (!body.title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }
    
    const episode = await episodeService.createEpisode({
      seriesId: body.seriesId,
      title: body.title,
      descriptions: body.descriptions || [],
      characters: body.characters || [],
      keywords: body.keywords || [],
      videoUrl: body.videoUrl,
      plotLines: body.plotLines
    });
    
    return NextResponse.json(episode);
  } catch (error: unknown) {
    console.error('Failed to create episode:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage === 'Series not found') {
      return NextResponse.json(
        { error: 'Series not found' },
        { status: 404 }
      );
    }
    
    if (errorMessage.includes('One or more characters are invalid')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create episode' },
      { status: 500 }
    );
  }
}
