import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient, saveImageToDisk } from '@/lib/aiEngineHelper';

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

    // 1. Check if Polza API key exists
    const polzaKey = process.env.POLZA_API_KEY;
    if (polzaKey) {
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
        if (polzaRes.ok) {
          const polzaData = await polzaRes.json();
          if (polzaData.data?.[0]?.url) {
            imageUrl = polzaData.data[0].url;
          }
        }
      } catch (err) {
        console.warn('Polza API request failed, switching to Imagen fallback:', err);
      }
    }

    // 2. Fallback to Gemini Imagen 3
    if (!imageUrl) {
      try {
        const ai = getGeminiClient();
        const imagenResponse = await ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: size.includes('1536') ? '3:2' : size.includes('1024x1536') ? '2:3' : '1:1',
          },
        });

        const imageBytes = imagenResponse.generatedImages?.[0]?.image?.imageBytes;
        if (imageBytes) {
          const saved = saveImageToDisk(filename, imageBytes);
          localAssetUrl = saved.localAssetUrl;
          imageUrl = localAssetUrl;
        }
      } catch (imagenErr) {
        console.warn('Imagen 3 API failed, generating stylized canvas token fallback:', imagenErr);
      }
    }

    // 3. Fallback: Generate SVG/Canvas placeholder image buffer if no API key or offline
    if (!imageUrl || !localAssetUrl) {
      const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#120c1f"/>
      <stop offset="50%" stop-color="#1e1338"/>
      <stop offset="100%" stop-color="#0a0512"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#ff4e00" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1536" fill="url(#bg)"/>
  <circle cx="512" cy="612" r="350" fill="url(#glow)"/>
  <rect x="64" y="64" width="896" height="1408" fill="none" stroke="#ff4e00" stroke-width="4" stroke-opacity="0.3" rx="16"/>
  <text x="512" y="550" font-family="sans-serif" font-size="48" font-weight="bold" fill="#ff4e00" text-anchor="middle">AETHER MAP AI ART</text>
  <text x="512" y="630" font-family="sans-serif" font-size="28" fill="#e0d6f2" text-anchor="middle">${model}</text>
  <foreignObject x="100" y="700" width="824" height="400">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color: #a395be; font-family: sans-serif; font-size: 20px; text-align: center; line-height: 1.6;">
      ${prompt.slice(0, 200)}...
    </div>
  </foreignObject>
</svg>`.trim();

      const saved = saveImageToDisk(filename, Buffer.from(svg, 'utf-8'));
      localAssetUrl = saved.localAssetUrl;
      imageUrl = localAssetUrl;
    }

    return NextResponse.json({
      success: true,
      data: [
        {
          url: imageUrl,
          localAssetUrl,
          model,
          prompt,
          size,
        },
      ],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка генерации арта' },
      { status: 500 }
    );
  }
}
