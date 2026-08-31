import { NextRequest, NextResponse } from 'next/server';
import { saveImageToDisk } from '@/lib/aiEngineHelper';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      model = 'tongyi-mai/z-image',
      prompt = 'Fantasy concept art',
      size = '1024x1536',
      saveToDisk = true,
    } = body;

    let imageUrl = '';
    let localAssetUrl = '';
    const timestamp = Date.now();
    const filename = `${timestamp}_polza_art.png`;

    const polzaKey = process.env.POLZA_API_KEY || process.env.NEXT_PUBLIC_POLZA_API_KEY;

    if (!polzaKey) {
      throw new Error('POLZA_API_KEY не настроен. Пожалуйста, укажите ваш ключ Polza AI в настройках проекта.');
    }

    // 1. Polza AI Image Generation API call
    try {
      const polzaRes = await fetch('https://api.polza.ai/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${polzaKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          size,
        }),
      });

      if (!polzaRes.ok) {
        const errText = await polzaRes.text();
        throw new Error(`Ошибка Polza AI Image API (${polzaRes.status}): ${errText}`);
      }

      const polzaData = await polzaRes.json();
      if (polzaData.data?.[0]?.url) {
        imageUrl = polzaData.data[0].url;

        // Если указано saveToDisk, скачиваем картинку и сохраняем локально
        if (saveToDisk && imageUrl.startsWith('http')) {
          try {
            const imgFetch = await fetch(imageUrl);
            if (imgFetch.ok) {
              const arrayBuffer = await imgFetch.arrayBuffer();
              const saved = saveImageToDisk(filename, Buffer.from(arrayBuffer));
              localAssetUrl = saved.localAssetUrl;
              imageUrl = localAssetUrl;
            }
          } catch (fetchErr) {
            console.warn('Не удалось локально кэшировать URL изображения Polza AI:', fetchErr);
          }
        }
      } else if (polzaData.data?.[0]?.b64_json) {
        const saved = saveImageToDisk(filename, polzaData.data[0].b64_json);
        localAssetUrl = saved.localAssetUrl;
        imageUrl = localAssetUrl;
      }
    } catch (err: any) {
      throw new Error(`Ошибка запроса Polza AI Image API: ${err.message}`);
    }

    return NextResponse.json({
      success: true,
      data: [
        {
          url: localAssetUrl || imageUrl,
          localAssetUrl,
          model,
          prompt,
          size,
        },
      ],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка генерации арта через Polza AI' },
      { status: 500 }
    );
  }
}
