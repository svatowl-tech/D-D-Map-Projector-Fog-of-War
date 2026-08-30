import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    models: [
      {
        id: 'tongyi-mai/z-image',
        name: 'Tongyi Z-Image',
        provider: 'Alibaba Cloud / Polza',
        description: 'Основная нейросеть для художественных концепт-артов и портретов D&D',
        supportsTransparency: false,
        isDefault: true,
      },
      {
        id: 'google/gemini-2.5-flash-image',
        name: 'Gemini 2.5 Flash Image / Imagen 3',
        provider: 'Google AI',
        description: 'Быстрая генерация высокого качества с глубоким пониманием фэнтези-контекста',
        supportsTransparency: false,
        isDefault: false,
      },
      {
        id: 'bytedance/seedream-4',
        name: 'Seedream 4',
        provider: 'ByteDance',
        description: 'Кинематографическая детализация персонажей и фэнтезийных пейзажей',
        supportsTransparency: false,
        isDefault: false,
      },
      {
        id: 'gpt-image-1',
        name: 'GPT Image 1 (Token Alpha)',
        provider: 'OpenAI / Polza',
        description: 'Специальная генерация с поддержкой прозрачного фона для токенов VTT',
        supportsTransparency: true,
        isDefault: false,
      },
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        provider: 'OpenAI',
        description: 'Высокоточные фэнтези Иллюстрации с точным соблюдением деталей промпта',
        supportsTransparency: false,
        isDefault: false,
      },
    ],
    defaultModel: 'tongyi-mai/z-image',
  });
}
