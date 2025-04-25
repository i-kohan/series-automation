import { NextResponse } from 'next/server';
import { characterService } from '@/lib/services/characterService';
import { UpdateCharacterDto } from '@/lib/types/character';

// Получение конкретного персонажа
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const character = await characterService.getCharacterById(params.id);
    
    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(character);
  } catch (error) {
    console.error('Failed to fetch character:', error);
    return NextResponse.json(
      { error: 'Failed to fetch character' },
      { status: 500 }
    );
  }
}

// Обновление персонажа
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const dto: UpdateCharacterDto = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.aliases !== undefined && { aliases: body.aliases }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.keywords !== undefined && { keywords: body.keywords }),
      ...(body.imageUrls !== undefined && { imageUrls: body.imageUrls }),
      ...(body.speechSample !== undefined && { speechSample: body.speechSample })
    };

    const character = await characterService.updateCharacter(params.id, dto);
    
    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(character);
  } catch (error) {
    console.error('Failed to update character:', error);
    return NextResponse.json(
      { error: 'Failed to update character' },
      { status: 500 }
    );
  }
}

// Удаление персонажа
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const success = await characterService.deleteCharacter(params.id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete character:', error);
    return NextResponse.json(
      { error: 'Failed to delete character' },
      { status: 500 }
    );
  }
} 