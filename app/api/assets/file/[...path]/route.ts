import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: 'Путь к файлу не указан' }, { status: 400 });
    }

    // Resolve path safely relative to process.cwd()
    const relativePath = pathSegments.join('/');
    const absolutePath = path.resolve(process.cwd(), relativePath);

    // Prevent Path Traversal security risk
    if (!absolutePath.startsWith(process.cwd())) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
    }

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.json') contentType = 'application/json';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка чтения файла' }, { status: 500 });
  }
}
