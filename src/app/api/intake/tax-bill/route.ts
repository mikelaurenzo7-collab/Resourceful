import { NextRequest, NextResponse } from 'next/server';
import { parseTaxBill } from '@/lib/services/gemini';
import { applyRateLimit } from '@/lib/rate-limit';
import { apiLogger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req, {
    prefix: 'tax-bill-ocr',
    limit: 10,
    windowSeconds: 60,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type;

    const extractedData = await parseTaxBill(mimeType, base64Data);

    if (!extractedData) {
      return NextResponse.json({ error: 'Failed to extract text. Image too blurry or incompatible format.' }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      data: extractedData,
    });
  } catch (error) {
    apiLogger.error({ err: error instanceof Error ? error.message : error }, '/api/intake/tax-bill route failed');
    return NextResponse.json({ error: 'Internal server error processing document' }, { status: 500 });
  }
}
