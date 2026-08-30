import { NextRequest, NextResponse } from 'next/server';
import { compileArtPrompt } from '@/lib/aiEngineHelper';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { entity, stylePreset = 'dnd_cinematic' } = body;

    if (!entity) {
      return NextResponse.json(
        { success: false, error: 'Параметр entity обязателен' },
        { status: 400 }
      );
    }

    const { prompt, optimalSize } = compileArtPrompt(entity, stylePreset);

    return NextResponse.json({
      success: true,
      prompt,
      optimalSize,
      stylePreset,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка компиляции промпта' },
      { status: 500 }
    );
  }
}
