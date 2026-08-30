import { NextRequest, NextResponse } from 'next/server';
import { saveImageToDisk } from '@/lib/aiEngineHelper';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageData, filename = `saved_${Date.now()}.png` } = body;

    if (!imageData) {
      return NextResponse.json(
        { success: false, error: 'Параметр imageData обязателен' },
        { status: 400 }
      );
    }

    let buffer: Buffer;

    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      const res = await fetch(imageData);
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const cleanBase64 = imageData.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(cleanBase64, 'base64');
    }

    const { filePath, localAssetUrl } = saveImageToDisk(filename, buffer);

    return NextResponse.json({
      success: true,
      savedFilePath: filePath,
      localAssetUrl,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка сохранения изображения' },
      { status: 500 }
    );
  }
}
