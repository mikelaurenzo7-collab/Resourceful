import { NextRequest, NextResponse } from 'next/server';
import { analyzeDeferredMaintenance } from '@/lib/services/gemini';
import { applyRateLimit } from '@/lib/rate-limit';
import { apiLogger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const rateLimitResponse = await applyRateLimit(req, {
    prefix: 'photo-analysis',
    limit: 20,
    windowSeconds: 60,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const formData = await req.formData();
    const caption = formData.get('caption') as string || 'General condition issue';
    const propertyType = formData.get('propertyType') as string || 'residential';
    
    // Support multiple images for a single analytical inference
    const images: { data: string; mimeType: string }[] = [];
    
    for (const [key, value] of Array.from(formData.entries())) {
      if (key.startsWith('image') && value instanceof File) {
        if (value.size > 15 * 1024 * 1024) {
          return NextResponse.json({ error: 'Individual image too large. Max 15MB.' }, { status: 400 });
        }
        const arrayBuffer = await value.arrayBuffer();
        images.push({
          data: Buffer.from(arrayBuffer).toString('base64'),
          mimeType: value.type
        });
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ error: 'No images provided for analysis' }, { status: 400 });
    }

    const analysisContext = await analyzeDeferredMaintenance(images, caption, propertyType);

    if (!analysisContext) {
      return NextResponse.json({ error: 'Analysis engine failed to process imagery. Try taking clearer photos.' }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      data: analysisContext,
    });
  } catch (error) {
    apiLogger.error({ err: error instanceof Error ? error.message : error }, '/api/intake/photo-analysis route failed');
    return NextResponse.json({ error: 'Internal server error processing vision intelligence' }, { status: 500 });
  }
}
