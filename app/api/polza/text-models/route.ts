import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    models: [
      {
        id: 'deepseek/deepseek-r1-distill-llama-70b',
        name: 'DeepSeek R1 (Distill LLaMA 70B)',
        provider: 'DeepSeek',
        description: 'Рассуждающая модель с блоком мышления <think> для глубоких D&D правил',
        supportsReasoning: true,
        isDefault: true,
      },
      {
        id: 'google/gemma-3-27b-it',
        name: 'Google Gemma 3 27B IT',
        provider: 'Google',
        description: 'Высокоскоростная оптимизированная модель для генерации игрового текста',
        supportsReasoning: false,
        isDefault: false,
      },
      {
        id: 'openai/gpt-oss-20b',
        name: 'OpenAI GPT-OSS 20B',
        provider: 'OpenAI',
        description: 'Открытая компактная модель для генерации элементов и статблоков',
        supportsReasoning: false,
        isDefault: false,
      },
      {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek V3 (Chat)',
        provider: 'DeepSeek',
        description: 'Флагманская языковая модель для генерации художественного лора и квестов',
        supportsReasoning: false,
        isDefault: false,
      },
      {
        id: 'openai/gpt-4o',
        name: 'OpenAI GPT-4o',
        provider: 'OpenAI',
        description: 'Универсальная мультимодальная модель высокого класса',
        supportsReasoning: false,
        isDefault: false,
      },
    ],
    defaultModel: 'deepseek/deepseek-r1-distill-llama-70b',
  });
}
