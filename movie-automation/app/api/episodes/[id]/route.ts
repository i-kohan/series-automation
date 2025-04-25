import { NextResponse } from 'next/server';
import { episodeService } from '@/lib/services/episodeService';

// Получение серии по ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const episode = await episodeService.getEpisodeById(id);
    
    if (!episode) {
      return NextResponse.json(
        { error: 'Episode not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(episode);
  } catch (error) {
    console.error('Failed to fetch episode:', error);
    return NextResponse.json(
      { error: 'Failed to fetch episode' },
      { status: 500 }
    );
  }
}

// Обновление серии по ID
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();
    
    const updatedEpisode = await episodeService.updateEpisode(id, {
      title: body.title,
      descriptions: body.descriptions,
      characters: body.characters,
      keywords: body.keywords,
      videoUrl: body.videoUrl,
      plotLines: body.plotLines
    });
    
    if (!updatedEpisode) {
      return NextResponse.json(
        { error: 'Episode not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedEpisode);
  } catch (error: unknown) {
    console.error('Failed to update episode:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('One or more characters are invalid')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update episode' },
      { status: 500 }
    );
  }
}

// Удаление серии по ID
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const success = await episodeService.deleteEpisode(id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Episode not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete episode:', error);
    return NextResponse.json(
      { error: 'Failed to delete episode' },
      { status: 500 }
    );
  }
} 