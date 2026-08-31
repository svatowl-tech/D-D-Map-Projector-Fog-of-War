import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    models: [
      {
        id: 'deepseek/deepseek-r1-distill-llama-70b',
        name: 'DeepSeek R1 (Distill LLaMA 70B)',
        provider: 'DeepSeek / Polza',
        description: 'Рассуждающая модель с блоком мышления <think> для глубоких D&D правил',
        supportsReasoning: true,
        isDefault: true,
      },
      {
        id: 'deepseek/deepseek-chat',
        name: 'DeepSeek V3 (Chat)',
        provider: 'DeepSeek / Polza',
        description: 'Флагманская языковая модель для генерации художественного лора и квестов',
        supportsReasoning: false,
        isDefault: false,
      },
      {
        id: 'qwen/qwen-2.5-72b-instruct',
        name: 'Qwen 2.5 72B Instruct',
        provider: 'Alibaba Cloud / Polza',
        description: 'Мощная мультиязычная модель с великолепным русским языком для сценариев',
        supportsReasoning: false,
        isDefault: false,
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct',
        name: 'Meta LLaMA 3.3 70B',
        provider: 'Meta / Polza',
        description: 'Высокоскоростная открытая модель для генерации боевых статблоков',
        supportsReasoning: false,
        isDefault: false,
      },
      {
        id: 'openai/gpt-4o',
        name: 'OpenAI GPT-4o',
        provider: 'OpenAI / Polza',
        description: 'Универсальная мультимодальная модель высокого класса через Polza AI',
        supportsReasoning: false,
        isDefault: false,
      },
    ],
    defaultModel: 'deepseek/deepseek-r1-distill-llama-70b',
  });
}
