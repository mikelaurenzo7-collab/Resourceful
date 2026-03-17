import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ReportStatusBadge from '@/components/admin/ReportStatusBadge';
import PhotoReviewForm from './PhotoReviewForm';
import type { Report, Photo } from '@/types/database';

export default async function PhotoReviewPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const reportId = params.id;

  const [{ data: rawReport }, { data: rawPhotos }] = await Promise.all([
    supabase.from('reports').select('*').eq('id', reportId).single(),
    supabase
      .from('photos')
      .select('*')
      .eq('report_id', reportId)
      .order('sort_order', { ascending: true }),
  ]);

  const report = rawReport as unknown as Report | null;
  const photos = (rawPhotos as unknown as Photo[]) ?? [];

  if (!report) notFound();
  if (photos.length === 0) notFound();

  // Generate signed URLs for each photo
  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      let signedUrl: string | null = null;
      if (photo.storage_path) {
        const { data } = await supabase.storage
          .from('photos')
          .createSignedUrl(photo.storage_path, 3600);
        signedUrl = data?.signedUrl ?? null;
      }
      return { ...photo, signedUrl };
    })
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">Photo Review</h1>
              <ReportStatusBadge status={report.status} />
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {report.property_address}, {report.city}, {report.state}
              {report.county && <span className="text-gray-400"> ({report.county})</span>}
            </p>
          </div>
          <a
            href={`/admin/reports/${reportId}/review`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Report Review
          </a>
        </div>
      </div>

      {/* Instructions */}
      <div className="mx-6 mt-6">
        <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-4">
          <h3 className="text-sm font-bold text-orange-900">
            Review Each Photo — Your Annotations Drive the Valuation
          </h3>
          <p className="mt-1 text-xs text-orange-700">
            For each photo, rate the condition, document any defects with their severity, and write
            what the county assessor is missing. Your defect severity ratings directly adjust the
            comparable sale prices — the worse the defect, the larger the price reduction. The AI
            uses your expert observations to build the strongest possible appeal case.
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-orange-800">
            <span><strong>Minor</strong> = -0.5% to -1.5%</span>
            <span><strong>Moderate</strong> = -1% to -3%</span>
            <span><strong>Significant</strong> = -2% to -5%</span>
            <span>Max total cap: -25%</span>
          </div>
        </div>
      </div>

      {/* Photo Review Form */}
      <PhotoReviewForm
        reportId={reportId}
        photos={photosWithUrls}
        reportStatus={report.status}
      />
    </div>
  );
}
