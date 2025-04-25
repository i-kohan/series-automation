import { NextResponse } from 'next/server';
import { characterService } from '@/lib/services/characterService';
import { CreateCharacterDto } from '@/lib/types/character';

// Получение всех персонажей или персонажей конкретного сериала
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seriesId = searchParams.get('seriesId');
    
    if (seriesId) {
      const characters = await characterService.getCharactersBySeriesId(seriesId);
      return NextResponse.json(characters);
    }
    
    const characters = await characterService.getAllCharacters();
    return NextResponse.json(characters);
  } catch (error) {
    console.error('Failed to fetch characters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch characters' },
      { status: 500 }
    );
  }
}

// Создание нового персонажа
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.seriesId) {
      return NextResponse.json(
        { error: 'Series ID is required' },
        { status: 400 }
      );
    }
    
    if (!body.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    
    const dto: CreateCharacterDto = {
      seriesId: body.seriesId,
      name: body.name,
      aliases: body.aliases || [],
      description: body.description || '',
      keywords: body.keywords || [],
      imageUrls: body.imageUrls || [],
      speechSample: body.speechSample
    };

    const character = await characterService.createCharacter(dto);
    return NextResponse.json(character);
  } catch (error) {
    console.error('Failed to create character:', error);
    return NextResponse.json(
      { error: 'Failed to create character' },
      { status: 500 }
    );
  }
} 