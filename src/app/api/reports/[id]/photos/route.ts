// ─── Photo Upload API ───────────────────────────────────────────────────────
// POST: Accept multipart form data, upload to Supabase Storage, create photos
// row, return photo record. Requires authenticated user who owns the report.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { photoUploadSchema } from '@/lib/validations/report';
import { getReportById } from '@/lib/repository/reports';
import { applyRateLimit } from '@/lib/rate-limit';
import type { PhotoInsert } from '@/types/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Rate limit: 60 photo uploads per 15 minutes per IP ───────────────
    const rateLimited = await applyRateLimit(request, { prefix: 'photo-upload', limit: 60, windowSeconds: 900 });
    if (rateLimited) return rateLimited;

    const { id: reportId } = await params;

    // ── Authenticate user ──────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ── Verify report ownership ────────────────────────────────────────────
    const report = await getReportById(reportId);

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    if (report.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to upload photos to this report' },
        { status: 403 }
      );
    }

    // ── Parse multipart form data ──────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const photoType = formData.get('photo_type') as string | null;
    const sortOrder = formData.get('sort_order') as string | null;
    const caption = formData.get('caption') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // ── Validate file size (max 50MB) ────────────────────────────────────
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 413 }
      );
    }

    // ── Validate file type ───────────────────────────────────────────────
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Accepted: JPEG, PNG, WebP, HEIC.' },
        { status: 400 }
      );
    }

    // ── Validate metadata ──────────────────────────────────────────────────
    const parsed = photoUploadSchema.safeParse({
      photo_type: photoType,
      sort_order: sortOrder ? parseInt(sortOrder, 10) : 0,
      caption: caption ?? null,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // ── Upload to Supabase Storage ─────────────────────────────────────────
    const admin = createAdminClient();
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `photos/${reportId}/${filename}`;

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from('reports')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[api/photos] Upload error:', uploadError.message);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // ── Create photos row ──────────────────────────────────────────────────
    const photoData: PhotoInsert = {
      report_id: reportId,
      photo_type: parsed.data.photo_type,
      storage_path: storagePath,
      sort_order: parsed.data.sort_order,
      caption: parsed.data.caption ?? null,
      ai_analysis: null,
    };

    const { data: photo, error: insertError } = await admin
      .from('photos')
      .insert(photoData)
      .select()
      .single();

    if (insertError || !photo) {
      console.error('[api/photos] Insert error:', insertError?.message);
      // Clean up uploaded file on DB insert failure
      await admin.storage.from('reports').remove([storagePath]);
      return NextResponse.json(
        { error: 'Failed to create photo record' },
        { status: 500 }
      );
    }

    return NextResponse.json({ photo }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/photos] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
