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
        id: 'black-forest-labs/flux-1-schnell',
        name: 'FLUX.1 Schnell',
        provider: 'Black Forest Labs / Polza',
        description: 'Ультра-детализированная фэнтези генерация с реалистичным светом и текстурами',
        supportsTransparency: false,
        isDefault: false,
      },
      {
        id: 'bytedance/seedream-4',
        name: 'Seedream 4',
        provider: 'ByteDance / Polza',
        description: 'Кинематографическая детализация персонажей и фэнтезийных пейзажей',
        supportsTransparency: false,
        isDefault: false,
      },
      {
        id: 'stabilityai/stable-diffusion-xl-base-1.0',
        name: 'Stable Diffusion XL (SDXL)',
        provider: 'Stability AI / Polza',
        description: 'Классическая модель для стилизованных игровых карт и локаций',
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
        provider: 'OpenAI / Polza',
        description: 'Высокоточные фэнтези иллюстрации с точным соблюдением деталей промпта',
        supportsTransparency: false,
        isDefault: false,
      },
    ],
    defaultModel: 'tongyi-mai/z-image',
  });
}
