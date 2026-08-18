// ─── Partner API: Report Status ──────────────────────────────────────────────
// GET /api/v1/reports/{id} — check report status and get PDF download URL.
// Authenticated via Bearer token. Partners can only access their own reports.

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/services/partner-api-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRateLimit } from '@/lib/rate-limit';
import type { Report } from '@/types/database';
import { apiLogger } from '@/lib/logger';

function extractBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Status endpoints are naturally polled. Keep the allowance materially
    // higher than create traffic while still bounding accidental/hostile loops.
    const rateLimited = await applyRateLimit(request, {
      prefix: 'v1-report-status',
      limit: 600,
      windowSeconds: 900,
    });
    if (rateLimited) return rateLimited;

    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Missing Authorization header. Use: Bearer rfl_xxxxx' },
        { status: 401 }
      );
    }

    const { partner, error: authError } = await validateApiKey(token);
    if (authError || !partner) {
      return NextResponse.json(
        { error: authError ?? 'Authentication failed' },
        { status: 403 }
      );
    }

    const reportId = params.id;
    const supabase = createAdminClient();

    const { data: rawReport, error: fetchError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .eq('api_partner_id', partner.id)
      .single();

    if (fetchError || !rawReport) {
      return NextResponse.json(
        { error: 'Report not found or access denied' },
        { status: 404 }
      );
    }

    const report = rawReport as unknown as Report;

    const response: Record<string, unknown> = {
      reportId: report.id,
      status: report.status,
      propertyAddress: report.property_address,
      city: report.city,
      state: report.state,
      county: report.county,
      createdAt: report.created_at,
      pipelineStage: report.pipeline_last_completed_stage,
    };

    if (
      report.status === 'pending_approval' ||
      report.status === 'approved' ||
      report.status === 'delivered'
    ) {
      const { data: rawPropData } = await supabase
        .from('property_data')
        .select('assessed_value, market_value_estimate_low, market_value_estimate_high')
        .eq('report_id', reportId)
        .single();

      if (rawPropData) {
        const propData = rawPropData as unknown as {
          assessed_value: number | null;
          market_value_estimate_low: number | null;
          market_value_estimate_high: number | null;
        };
        response.assessedValue = propData.assessed_value;
        response.marketValueEstimateLow = propData.market_value_estimate_low;
        response.marketValueEstimateHigh = propData.market_value_estimate_high;
        // Do not derive a gap or savings figure here: assessed value and market
        // value are not necessarily on the same basis until the jurisdiction's
        // assessment ratio/equalization rules are applied.
      }
    }

    if (report.report_pdf_storage_path) {
      const { data: signedData } = await supabase.storage
        .from('reports')
        .createSignedUrl(report.report_pdf_storage_path, 86400);

      if (signedData?.signedUrl) {
        response.pdfUrl = signedData.signedUrl;
      }
    }

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    apiLogger.error({ err: message }, 'Status check error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
