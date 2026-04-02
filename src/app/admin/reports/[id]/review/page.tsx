import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import QualityFlags from '@/components/admin/QualityFlags';
import ApprovalAuditTrail from '@/components/admin/ApprovalAuditTrail';
import ReportStatusBadge from '@/components/admin/ReportStatusBadge';
import ReviewControls from './ReviewControls';
import type { Report, PropertyData, ComparableSale, Measurement, IncomeAnalysis, Photo, ReportNarrative, ApprovalEvent } from '@/types/database';

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function computePipelineDuration(started: string | null, completed: string | null): string {
  if (!started || !completed) return '--';
  const ms = new Date(completed).getTime() - new Date(started).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining}m`;
}

export default async function ReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const reportId = params.id;

  // Fetch all data in parallel
  const [
    { data: rawReport },
    { data: rawPropertyData },
    { data: rawComps },
    { data: rawMeasurements },
    { data: rawIncomeAnalysis },
    { data: rawPhotos },
    { data: rawNarratives },
    { data: rawEvents },
  ] = await Promise.all([
    supabase.from('reports').select('*').eq('id', reportId).single(),
    supabase.from('property_data').select('*').eq('report_id', reportId).single(),
    supabase.from('comparable_sales').select('*').eq('report_id', reportId).order('distance_miles' as any),
    supabase.from('measurements').select('*').eq('report_id', reportId),
    supabase.from('income_analysis').select('*').eq('report_id', reportId).single(),
    supabase.from('photos').select('*').eq('report_id', reportId).order('sort_order' as any),
    supabase.from('report_narratives').select('*').eq('report_id', reportId).order('generated_at' as any),
    supabase.from('approval_events').select('*').eq('report_id', reportId).order('created_at', { ascending: false }),
  ]);

  // Cast from Supabase generic types
  const report = rawReport as unknown as Report | null;
  const propertyData = rawPropertyData as unknown as PropertyData | null;
  const comps = (rawComps as unknown as ComparableSale[]) ?? [];
  const measurements = (rawMeasurements as unknown as Measurement[]) ?? [];
  const incomeAnalysis = rawIncomeAnalysis as unknown as IncomeAnalysis | null;
  const photos = (rawPhotos as unknown as Photo[]) ?? [];
  const narratives = (rawNarratives as unknown as ReportNarrative[]) ?? [];
  const events = (rawEvents as unknown as ApprovalEvent[]) ?? [];

  if (!report) notFound();

  // Compute concluded value from income analysis or comps
  const concludedValue = incomeAnalysis?.concluded_value_income_approach ?? null;
  const assessedValue = propertyData?.assessed_value ?? null;

  const conditionRatingMap: Record<string, number> = { excellent: 9, good: 7, average: 5, fair: 3, poor: 1 };
  const photosWithRating = photos.filter(p => p.ai_analysis?.condition_rating);
  const overallCondition = photosWithRating.length
    ? (photosWithRating.reduce((sum, p) => sum + (conditionRatingMap[p.ai_analysis!.condition_rating] ?? 5), 0) / photosWithRating.length).toFixed(1)
    : '--';

  return (
    <div className="flex h-full">
      {/* LEFT PANEL - PDF Preview */}
      <div className="w-1/2 border-r border-gray-200 bg-gray-100 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">PDF Preview</h2>
          <ReportStatusBadge status={report.status} />
        </div>
        {report.report_pdf_storage_path ? (
          <embed
            src={report.report_pdf_storage_path}
            type="application/pdf"
            className="h-[calc(100vh-8rem)] w-full rounded-lg border border-gray-300 shadow-sm"
          />
        ) : (
          <div className="flex h-[calc(100vh-8rem)] items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">PDF not yet generated</p>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL - Review Controls */}
      <div className="w-1/2 overflow-y-auto">
        <div className="p-6 space-y-8">
          {/* Human-in-the-Loop Indicator */}
          {!report.photos_skipped ? (
            <section>
              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 rounded-full bg-emerald-100 p-2">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-emerald-900">
                      HUMAN-IN-THE-LOOP — Client Submitted Photos
                    </h3>
                    <p className="mt-0.5 text-xs text-emerald-700">
                      This client provided their own property photos. The report includes AI-analyzed photo evidence
                      that influenced the condition adjustment. <strong>Review photo-based defects carefully.</strong>
                    </p>
                    {propertyData?.photo_count != null && propertyData.photo_count > 0 && (
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-emerald-800">
                        <span><strong>{propertyData.photo_count}</strong> photos analyzed</span>
                        {propertyData.photo_defect_count > 0 && (
                          <span><strong>{propertyData.photo_defect_count}</strong> defects found</span>
                        )}
                        {propertyData.photo_defect_count_significant > 0 && (
                          <span className="font-bold text-amber-700">{propertyData.photo_defect_count_significant} significant</span>
                        )}
                        {propertyData.photo_impact_dollars != null && propertyData.photo_impact_dollars > 0 && (
                          <span>Photo impact: <strong>{formatCurrency(propertyData.photo_impact_dollars)}</strong> ({propertyData.photo_impact_pct?.toFixed(1)}%)</span>
                        )}
                        {propertyData.photo_condition_adjustment_pct != null && (
                          <span>Condition adj: <strong>{propertyData.photo_condition_adjustment_pct}%</strong></span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 rounded-full bg-gray-100 p-2">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-600">No Photos — Market Data Only</h3>
                    <p className="text-xs text-gray-500">Client did not submit photos. Valuation based entirely on comparable sales and market data.</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Report Overview */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Report Overview</h2>
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Property Address</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {report.property_address}
                  </p>
                  <p className="text-sm text-gray-600">
                    {[report.city, report.state].filter(Boolean).join(', ')}
                    {report.county && <span className="text-gray-400"> ({report.county})</span>}
                  </p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Property Type</p>
                      <p className="mt-1 text-sm font-medium text-gray-900 capitalize">{report.property_type ?? '--'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Service Type</p>
                      <p className="mt-1 text-sm font-medium text-gray-900 capitalize">{report.service_type?.replace(/_/g, ' ') ?? '--'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 grid grid-cols-4 divide-x divide-gray-100">
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Concluded Value</p>
                  <p className="mt-1 text-lg font-bold text-[#1a2744]">{formatCurrency(concludedValue)}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Assessed Value</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(assessedValue)}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Assessment Ratio</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {propertyData?.assessment_ratio != null ? `${(propertyData.assessment_ratio * 100).toFixed(1)}%` : '--'}
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Comps Used</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{comps.length}</p>
                </div>
              </div>

              <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Condition Rating</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{overallCondition}/10</p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Pipeline Duration</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {computePipelineDuration(report.pipeline_started_at, report.pipeline_completed_at)}
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Completed</p>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(report.pipeline_completed_at)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Pipeline Error Details (for failed/processing reports) */}
          {report.pipeline_error_log && (
            <section>
              <h2 className="text-lg font-bold text-red-700 mb-4">Pipeline Error</h2>
              <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 space-y-3">
                {(Array.isArray(report.pipeline_error_log) ? report.pipeline_error_log : [report.pipeline_error_log]).map((rawErr: unknown, i: number) => {
                  const err = rawErr as Record<string, string | undefined>;
                  return (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-red-800 bg-red-200 px-2 py-0.5 rounded">
                          {err.stage ?? 'unknown'}
                        </span>
                        {err.timestamp && (
                          <span className="text-xs text-red-600">{formatDate(err.timestamp)}</span>
                        )}
                      </div>
                      <p className="text-sm text-red-800 font-medium">{err.error ?? 'Unknown error'}</p>
                      {err.stack && err.stack !== err.error && (
                        <details className="mt-1">
                          <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">Stack trace</summary>
                          <pre className="mt-1 text-xs text-red-700 bg-red-100 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">{err.stack}</pre>
                        </details>
                      )}
                    </div>
                  );
                })}
                <p className="text-xs text-red-600 mt-2">
                  Last completed stage: <strong>{report.pipeline_last_completed_stage ?? 'none'}</strong>
                </p>
              </div>
            </section>
          )}

          {/* Quality Flags */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quality Flags</h2>
            <QualityFlags
              report={report}
              comps={comps}
              propertyData={propertyData}
              measurements={measurements}
              incomeAnalysis={incomeAnalysis}
              photos={photos}
            />
          </section>

          {/* Section Review + Decision Buttons + Rerun Pipeline (client component) */}
          <ReviewControls
            reportId={reportId}
            narratives={narratives}
            reportStatus={report.status}
          />

          {/* Approval Audit Trail */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Approval Audit Trail</h2>
            <ApprovalAuditTrail events={events} />
          </section>
        </div>
      </div>
    </div>
  );
}
