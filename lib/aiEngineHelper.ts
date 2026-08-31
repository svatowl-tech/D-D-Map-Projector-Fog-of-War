import fs from 'fs';
import path from 'path';

// Polza AI Chat Completions helper
export interface PolzaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface PolzaChatOptions {
  model?: string;
  messages: PolzaChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export async function callPolzaChatCompletions(options: PolzaChatOptions): Promise<{ text: string; reasoning?: string }> {
  const apiKey = process.env.POLZA_API_KEY || process.env.NEXT_PUBLIC_POLZA_API_KEY;
  if (!apiKey) {
    throw new Error('POLZA_API_KEY не настроен. Пожалуйста, укажите ваш ключ Polza AI в настройках проекта.');
  }

  const model = options.model || 'deepseek/deepseek-r1-distill-llama-70b';
  const temperature = options.temperature ?? 0.7;

  const res = await fetch('https://api.polza.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature,
      max_tokens: options.max_tokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ошибка Polza AI API (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const message = choice?.message;

  let text = message?.content || '';
  let reasoning = message?.reasoning_content || '';

  // Если модель вернула блок мышления в виде тегов <think> внутри content
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    reasoning = reasoning ? `${reasoning}\n${thinkMatch[1].trim()}` : thinkMatch[1].trim();
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  }

  return { text, reasoning };
}

// Directory helpers
export const ASSETS_DATA_DIR = path.join(process.cwd(), 'assets', 'data', 'ai-generated');
export const CAMPAIGNS_DATA_DIR = path.join(process.cwd(), 'assets', 'data', 'Campaigns');

export function ensureDataDirsExist() {
  if (!fs.existsSync(ASSETS_DATA_DIR)) {
    fs.mkdirSync(ASSETS_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CAMPAIGNS_DATA_DIR)) {
    fs.mkdirSync(CAMPAIGNS_DATA_DIR, { recursive: true });
  }
}

// Save JSON to disk safely
export function saveJsonToDisk(folder: string, filename: string, data: any): string {
  const targetDir = folder === 'Campaigns' ? CAMPAIGNS_DATA_DIR : ASSETS_DATA_DIR;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
}

// Save image Buffer / Base64 to disk
export function saveImageToDisk(filename: string, base64OrBuffer: Buffer | string): { filePath: string; localAssetUrl: string } {
  ensureDataDirsExist();
  const filePath = path.join(ASSETS_DATA_DIR, filename);

  if (typeof base64OrBuffer === 'string') {
    const cleanBase64 = base64OrBuffer.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    fs.writeFileSync(filePath, buffer);
  } else {
    fs.writeFileSync(filePath, base64OrBuffer);
  }

  const relativePath = path.relative(process.cwd(), filePath);
  const localAssetUrl = `/api/assets/file/${relativePath.replace(/\\/g, '/')}`;
  return { filePath, localAssetUrl };
}

// Art style presets compiler
export function compileArtPrompt(entity: any, stylePreset: string = 'dnd_cinematic'): { prompt: string; optimalSize: string } {
  const name = entity?.name || entity?.title || 'Fantasy entity';
  const type = entity?.entityType || entity?.type || 'character';
  const description = entity?.description || entity?.appearance || entity?.userPrompt || '';
  const raceClass = [entity?.race, entity?.class].filter(Boolean).join(' ');

  let basePrompt = `${name}, ${type} ${raceClass}. ${description}`.trim();

  let styleModifier = '';
  let optimalSize = '1024x1536';

  switch (stylePreset) {
    case 'grimdark':
      styleModifier = 'grimdark dark fantasy aesthetic, brutal gritty textures, high contrast deep shadows, muted cold color palette, Warhammer inspired art';
      optimalSize = type === 'location' ? '1536x1024' : '1024x1536';
      break;
    case 'watercolor_rpg':
      styleModifier = 'classic RPG book illustration, delicate watercolor wash, fine black ink outlines, warm parchment texture, soft elegant strokes';
      optimalSize = '1024x1024';
      break;
    case 'concept_art':
      styleModifier = 'AAA video game concept art, 8k resolution, cinematic volumetric lighting, Unreal Engine 5 render style, dramatic composition';
      optimalSize = type === 'location' ? '1536x1024' : '1024x1536';
      break;
    case 'oil_painting':
      styleModifier = 'classical oil painting, dramatic chiaroscuro lighting, rich textured brushstrokes, Renaissance masterpiece lighting';
      optimalSize = '1024x1536';
      break;
    case 'isometric_token':
      styleModifier = 'top-down isometric VTT token miniature, circular clean border, transparent or clean isolated background, highly detailed tabletop gaming portrait';
      optimalSize = '1024x1024';
      break;
    case 'anime_fantasy':
      styleModifier = 'vibrant anime fantasy art style, dynamic magical particle effects, crisp clean lineart, vivid glowing colors';
      optimalSize = '1024x1536';
      break;
    case 'retro_pixel':
      styleModifier = 'detailed 16-bit pixel art style, classic SNES RPG sprite graphic, crisp pixel grid, vibrant color palette';
      optimalSize = '1024x1024';
      break;
    case 'dnd_cinematic':
    default:
      styleModifier = 'official D&D 5e rulebook art style, cinematic fantasy portrait, rich detailed digital painting, heroic epic lighting';
      optimalSize = type === 'location' ? '1536x1024' : '1024x1536';
      break;
  }

  const finalPrompt = `Masterpiece fantasy concept art: ${basePrompt}. ${styleModifier}. High resolution, highly detailed, professional digital art.`;

  return { prompt: finalPrompt, optimalSize };
}
