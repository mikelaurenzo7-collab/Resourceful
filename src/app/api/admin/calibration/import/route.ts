// ─── Bulk Import Calibration API ─────────────────────────────────────────────
// POST: Import calibration data from existing delivered reports. Admin provides
// the actual appraised value (and optional field-measured sqft). The system's
// concluded value is pulled from the existing report data. Zero API cost.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/repository/admin';
import type { Report, PropertyData, ComparableSale, CalibrationEntryInsert } from '@/types/database';

interface ImportEntry {
  reportId: string;
  actualAppraisedValue: number;
  actualBuildingSqft?: number;
  actualLotSqft?: number;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await applyRateLimit(request, { prefix: 'admin-calibration-import', limit: 10, windowSeconds: 60 });
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { entries } = body as { entries?: ImportEntry[] };

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'entries array is required' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const results: { reportId: string; success: boolean; error?: string }[] = [];

    for (const entry of entries) {
      try {
        if (!entry.reportId || !entry.actualAppraisedValue || entry.actualAppraisedValue <= 0) {
          results.push({ reportId: entry.reportId, success: false, error: 'Invalid reportId or actualAppraisedValue' });
          continue;
        }

        // Fetch report + property_data + comparable_sales
        const [reportRes, pdRes, compsRes] = await Promise.all([
          adminClient.from('reports').select('*').eq('id', entry.reportId).single(),
          adminClient.from('property_data').select('*').eq('report_id', entry.reportId).single(),
          adminClient.from('comparable_sales').select('*').eq('report_id', entry.reportId),
        ]);

        if (reportRes.error || !reportRes.data) {
          results.push({ reportId: entry.reportId, success: false, error: 'Report not found' });
          continue;
        }

        const report = reportRes.data as Report;
        const pd = pdRes.data as PropertyData | null;
        const comps = (compsRes.data ?? []) as ComparableSale[];

        // Calculate the system's concluded value from comps (same logic as stage5)
        let systemConcludedValue = 0;
        let medianAdjustedPsf: number | null = null;

        if (comps.length > 0 && pd?.building_sqft_gross) {
          const adjustedPsfs = comps
            .map(c => c.adjusted_price_per_sqft)
            .filter((v): v is number => v != null && v > 0)
            .sort((a, b) => a - b);

          if (adjustedPsfs.length > 0) {
            const mid = Math.floor(adjustedPsfs.length / 2);
            medianAdjustedPsf = adjustedPsfs.length % 2 === 0
              ? (adjustedPsfs[mid - 1] + adjustedPsfs[mid]) / 2
              : adjustedPsfs[mid];
            systemConcludedValue = Math.round(medianAdjustedPsf * pd.building_sqft_gross / 1000) * 1000;
          } else {
            // Fallback: median sale price
            const prices = comps.map(c => c.sale_price).sort((a, b) => a - b);
            const mid = Math.floor(prices.length / 2);
            systemConcludedValue = prices.length % 2 === 0
              ? Math.round((prices[mid - 1] + prices[mid]) / 2 / 1000) * 1000
              : Math.round(prices[mid] / 1000) * 1000;
          }
        }

        if (systemConcludedValue === 0) {
          results.push({ reportId: entry.reportId, success: false, error: 'Could not derive concluded value from report data' });
          continue;
        }

        // Compute variances
        const varianceDollars = entry.actualAppraisedValue - systemConcludedValue;
        const variancePct = Math.round(
          ((entry.actualAppraisedValue - systemConcludedValue) / entry.actualAppraisedValue) * 10000
        ) / 100;

        let sqftVariancePct: number | null = null;
        const attomSqft = pd?.building_sqft_gross ?? null;
        if (entry.actualBuildingSqft && entry.actualBuildingSqft > 0 && attomSqft && attomSqft > 0) {
          sqftVariancePct = Math.round(
            ((attomSqft - entry.actualBuildingSqft) / entry.actualBuildingSqft) * 10000
          ) / 100;
        }

        // Compute comp adjustment averages
        const avg = (vals: (number | null)[]) => {
          const valid = vals.filter((v): v is number => v != null);
          return valid.length > 0
            ? Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 100) / 100
            : null;
        };

        const calibrationInsert: CalibrationEntryInsert = {
          property_address: report.property_address,
          city: report.city,
          state: report.state,
          county: report.county,
          county_fips: report.county_fips,
          property_type: report.property_type,
          building_sqft: pd?.building_sqft_gross ?? null,
          lot_size_sqft: pd?.lot_size_sqft ?? null,
          year_built: pd?.year_built ?? null,
          system_concluded_value: systemConcludedValue,
          comp_count: comps.length,
          median_adjusted_psf: medianAdjustedPsf,
          actual_appraised_value: entry.actualAppraisedValue,
          variance_dollars: varianceDollars,
          variance_pct: variancePct,
          avg_adj_size: avg(comps.map(c => c.adjustment_pct_size)),
          avg_adj_condition: avg(comps.map(c => c.adjustment_pct_condition)),
          avg_adj_market_trends: avg(comps.map(c => c.adjustment_pct_market_trends)),
          avg_adj_land_ratio: avg(comps.map(c => c.adjustment_pct_land_to_building)),
          avg_net_adjustment: avg(comps.map(c => c.net_adjustment_pct)),
          actual_building_sqft: entry.actualBuildingSqft ?? null,
          actual_lot_sqft: entry.actualLotSqft ?? null,
          attom_building_sqft: attomSqft,
          attom_lot_sqft: pd?.lot_size_sqft ?? null,
          sqft_variance_pct: sqftVariancePct,
          source_report_id: entry.reportId,
          status: 'completed',
          notes: null,
          submitted_by: user.id,
          completed_at: new Date().toISOString(),
        };

        const { error: insertError } = await adminClient
          .from('calibration_entries')
          .insert(calibrationInsert);

        if (insertError) {
          results.push({ reportId: entry.reportId, success: false, error: insertError.message });
        } else {
          results.push({ reportId: entry.reportId, success: true });
        }
      } catch (err) {
        results.push({
          reportId: entry.reportId,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      imported: successCount,
      failed: results.length - successCount,
      results,
    });
  } catch (error) {
    console.error('[calibration/import] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
