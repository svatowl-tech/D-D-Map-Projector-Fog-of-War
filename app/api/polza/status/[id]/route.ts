import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return NextResponse.json({
    success: true,
    id,
    status: 'completed',
    progress: 100,
    message: 'Задача успешна завершена',
  });
}
