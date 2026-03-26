import type { ComparableSale, PropertyData, Measurement, IncomeAnalysis, Photo, Report } from '@/types/database';

interface QualityFlagsProps {
  report: Report;
  comps: ComparableSale[];
  propertyData: PropertyData | null;
  measurements: Measurement[];
  incomeAnalysis: IncomeAnalysis | null;
  photos: Photo[];
}

interface Flag {
  severity: 'warning' | 'error' | 'info';
  message: string;
}

function computeFlags({
  comps,
  propertyData,
  measurements,
  incomeAnalysis,
  photos,
}: QualityFlagsProps): Flag[] {
  const flags: Flag[] = [];

  // 1. Comps with net adjustment > 25%
  for (const comp of comps) {
    if (Math.abs(comp.net_adjustment_pct ?? 0) > 25) {
      flags.push({
        severity: 'warning',
        message: `Comp at ${comp.address ?? 'unknown'} has net adjustment of ${(comp.net_adjustment_pct ?? 0).toFixed(1)}% (>${'\u00A0'}25% threshold)`,
      });
    }
    if (comp.is_weak_comparable) {
      flags.push({
        severity: 'info',
        message: `Comp at ${comp.address ?? 'unknown'} is flagged as a weak comparable`,
      });
    }
  }

  // 2. Measurement discrepancy vs ATTOM GBA
  for (const m of measurements) {
    if (m.discrepancy_flagged && m.discrepancy_pct != null) {
      const tla = m.total_living_area_sqft?.toLocaleString() ?? '?';
      const attom = m.attom_gba_sqft?.toLocaleString() ?? '?';
      flags.push({
        severity: 'warning',
        message: `GBA discrepancy: measured ${tla} sf vs ATTOM ${attom} sf (${m.discrepancy_pct.toFixed(1)}% diff)`,
      });
    }
  }

  // 3. Data collection notes
  if (propertyData?.data_collection_notes) {
    flags.push({
      severity: 'info',
      message: `Data collection note: ${propertyData.data_collection_notes}`,
    });
  }

  // 4. Photo defects at significant severity not reflected in adjustments
  for (const photo of photos) {
    if (photo.ai_analysis?.defects && photo.ai_analysis.defects.length > 0) {
      const significantDefects = photo.ai_analysis.defects.filter(
        (defect) => defect.severity === 'significant'
      );
      if (significantDefects.length > 0) {
        const photoLabel = photo.photo_type?.replace(/_/g, ' ') ?? 'unknown';
        flags.push({
          severity: 'warning',
          message: `Significant photo defect detected in ${photoLabel}: ${significantDefects.map(d => d.description).join(', ')}`,
        });
      }
    }
  }

  // 5. Cap rate outside normal range (3-12%)
  if (incomeAnalysis?.concluded_cap_rate != null) {
    if (incomeAnalysis.concluded_cap_rate < 0.03 || incomeAnalysis.concluded_cap_rate > 0.12) {
      const pct = (incomeAnalysis.concluded_cap_rate * 100).toFixed(2);
      flags.push({
        severity: 'warning',
        message: `Cap rate ${pct}% is outside normal range (3%\u201312%)`,
      });
    }
  }

  // 6. Fewer than 3 comparables (thin market)
  if (comps.length < 3) {
    flags.push({
      severity: 'error',
      message: `Only ${comps.length} comparable sale${comps.length === 1 ? '' : 's'} found \u2014 thin market warning`,
    });
  }

  // 7. Assessment ratio outside normal range
  if (propertyData?.assessment_ratio != null) {
    if (propertyData.assessment_ratio < 0.5 || propertyData.assessment_ratio > 1.5) {
      flags.push({
        severity: 'warning',
        message: `Assessment ratio ${(propertyData.assessment_ratio * 100).toFixed(1)}% is outside normal range (50%\u2013150%)`,
      });
    }
  }

  return flags;
}

const severityStyles: Record<Flag['severity'], { bg: string; icon: string; border: string }> = {
  error: { bg: 'bg-red-50', icon: '\u26A0', border: 'border-l-4 border-[#b71c1c]' },
  warning: { bg: 'bg-amber-50', icon: '\u26A0', border: 'border-l-4 border-amber-500' },
  info: { bg: 'bg-blue-50', icon: '\u2139', border: 'border-l-4 border-blue-400' },
};

export default function QualityFlags(props: QualityFlagsProps) {
  const flags = computeFlags(props);

  if (flags.length === 0) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
        No quality issues detected.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {flags.map((flag, i) => {
        const style = severityStyles[flag.severity];
        return (
          <div
            key={i}
            className={`${style.bg} ${style.border} rounded-r-lg px-4 py-3 text-sm`}
          >
            <span className="mr-2">{style.icon}</span>
            {flag.message}
          </div>
        );
      })}
    </div>
  );
}
