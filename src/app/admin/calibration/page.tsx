import { createClient } from '@/lib/supabase/server';
import CalibrationDashboard from './CalibrationDashboard';
import type { Report } from '@/types/database';

export default async function CalibrationPage() {
  const supabase = await createClient();

  // Fetch delivered reports for bulk import
  const { data: rawReports } = await supabase
    .from('reports')
    .select('id, property_address, city, state, county, property_type, delivered_at')
    .eq('status', 'delivered')
    .order('delivered_at', { ascending: false })
    .limit(200);

  const deliveredReports = (rawReports ?? []) as Pick<
    Report,
    'id' | 'property_address' | 'city' | 'state' | 'county' | 'property_type' | 'delivered_at'
  >[];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Valuation Calibration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Train the system by comparing its valuations against your real appraisals.
          The more data you feed, the more accurate future reports become.
        </p>
      </div>
      <CalibrationDashboard deliveredReports={deliveredReports} />
    </div>
  );
}
