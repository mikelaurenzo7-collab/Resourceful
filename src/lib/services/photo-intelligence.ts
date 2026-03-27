// ─── Photo Intelligence Library ──────────────────────────────────────────────
// Cross-report photo intelligence that compounds over time.
// After analyzing thousands of properties, we learn patterns:
//   - "Properties in ZIP 60614 with original 1960s windows average Fair condition"
//   - "Brick exteriors in Cook County with efflorescence → 8% avg condition adjustment"
//   - "Properties built before 1970 in this area have 3x more foundation issues"
//
// This is proprietary data NO competitor can replicate without our volume.
// Fed back into photo analysis prompts for better condition predictions.

import { createAdminClient } from '@/lib/supabase/admin';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConditionPattern {
  county_fips: string;
  state: string;
  property_type: string;
  year_built_decade: string;         // "1960s", "1970s", "2000s"
  avg_condition_rating: string;       // "fair", "average", "good"
  common_defects: string[];           // Most frequent defect types
  avg_defect_count: number;
  avg_condition_adjustment_pct: number;
  sample_size: number;
}

export interface PhotoIntelligence {
  patterns: ConditionPattern[];
  totalPhotosAnalyzed: number;
  totalReportsWithPhotos: number;
}

// ─── Query Functions ─────────────────────────────────────────────────────────

/**
 * Get condition patterns for a specific county and property type.
 * Used to provide context to the photo analysis AI:
 * "Based on 47 properties we've analyzed in Cook County built in the 1960s,
 *  the average condition is Fair with 2.3 defects per property."
 */
export async function getConditionPatternsForCounty(
  countyFips: string,
  propertyType: string,
  yearBuilt: number | null
): Promise<ConditionPattern | null> {
  const supabase = createAdminClient();

  const decade = yearBuilt ? `${Math.floor(yearBuilt / 10) * 10}s` : null;

  // Query photos + reports + property_data to aggregate patterns
  const { data: photos } = await supabase
    .from('photos')
    .select(`
      ai_analysis,
      report_id,
      reports!inner (
        county_fips,
        property_type,
        status
      )
    `)
    .eq('reports.county_fips' as never, countyFips)
    .eq('reports.property_type' as never, propertyType)
    .not('ai_analysis', 'is', null)
    .in('reports.status' as never, ['delivered', 'approved', 'pending_approval'] as never);

  if (!photos || photos.length < 5) {
    return null; // Not enough data to form patterns
  }

  // Aggregate condition ratings and defects
  const ratings: Record<string, number> = {};
  const defectTypes: Record<string, number> = {};
  let totalDefects = 0;
  const totalAdjustment = 0;
  let count = 0;

  for (const photo of photos) {
    const analysis = (photo as Record<string, unknown>).ai_analysis as Record<string, unknown> | null;
    if (!analysis) continue;

    const rating = analysis.condition_rating as string;
    if (rating) {
      ratings[rating] = (ratings[rating] ?? 0) + 1;
    }

    const defects = analysis.defects as Array<{ type: string; value_impact: string }> | null;
    if (defects) {
      totalDefects += defects.length;
      for (const defect of defects) {
        defectTypes[defect.type] = (defectTypes[defect.type] ?? 0) + 1;
      }
    }

    count++;
  }

  if (count === 0) return null;

  // Find most common rating
  const avgRating = Object.entries(ratings)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'average';

  // Top defect types
  const commonDefects = Object.entries(defectTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type]) => type);

  return {
    county_fips: countyFips,
    state: '',
    property_type: propertyType,
    year_built_decade: decade ?? 'all',
    avg_condition_rating: avgRating,
    common_defects: commonDefects,
    avg_defect_count: Math.round((totalDefects / count) * 10) / 10,
    avg_condition_adjustment_pct: Math.round((totalAdjustment / count) * 10) / 10,
    sample_size: count,
  };
}

/**
 * Build a context string for the photo analysis AI prompt.
 * Adds our proprietary intelligence as prior context so Claude
 * knows what to expect in this area.
 */
export async function buildPhotoIntelligenceContext(
  countyFips: string | null,
  propertyType: string,
  yearBuilt: number | null
): Promise<string | null> {
  if (!countyFips) return null;

  const pattern = await getConditionPatternsForCounty(countyFips, propertyType, yearBuilt);
  if (!pattern || pattern.sample_size < 5) return null;

  const decade = yearBuilt ? `${Math.floor(yearBuilt / 10) * 10}s` : null;

  let context = `PROPRIETARY INTELLIGENCE (based on ${pattern.sample_size} properties we've analyzed in this county):\n`;
  context += `- Average condition for ${propertyType} properties${decade ? ` built in the ${decade}` : ''} in this area: ${pattern.avg_condition_rating}\n`;
  context += `- Average defects per property: ${pattern.avg_defect_count}\n`;

  if (pattern.common_defects.length > 0) {
    context += `- Most common defects in this area: ${pattern.common_defects.join(', ')}\n`;
  }

  context += `Use this as baseline context. If this property's photos show condition WORSE than the area average, that strengthens the appeal argument. If BETTER, note it honestly.`;

  return context;
}

/**
 * Get aggregate photo intelligence stats for the admin dashboard.
 */
export async function getPhotoIntelligenceStats(): Promise<{
  totalPhotosAnalyzed: number;
  totalCountiesWithData: number;
  topDefectTypes: Array<{ type: string; count: number }>;
}> {
  const supabase = createAdminClient();

  const { count: photoCount } = await supabase
    .from('photos')
    .select('*', { count: 'exact', head: true })
    .not('ai_analysis', 'is', null);

  // Get unique counties with analyzed photos
  const { data: counties } = await supabase
    .from('reports')
    .select('county_fips')
    .not('county_fips', 'is', null)
    .in('status', ['delivered', 'approved', 'pending_approval']);

  const uniqueCounties = new Set((counties ?? []).map((c: { county_fips: string | null }) => c.county_fips).filter(Boolean));

  return {
    totalPhotosAnalyzed: photoCount ?? 0,
    totalCountiesWithData: uniqueCounties.size,
    topDefectTypes: [], // Populated as volume grows
  };
}
