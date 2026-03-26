import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { CountyRule } from '@/types/database';

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function CountyRulesPage() {
  const supabase = await createClient();

  const { data: rawCounties, error } = await supabase
    .from('county_rules')
    .select('*')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .order('state_abbreviation' as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .order('county_name' as any);

  const counties = rawCounties as unknown as CountyRule[] | null;

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          Error loading counties: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">County Rules</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage assessment rules, appeal deadlines, and filing instructions for each county.
          </p>
        </div>
        <Link
          href="/admin/counties/new/edit"
          className="inline-flex items-center rounded-lg bg-[#1a2744] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#243356]"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add County
        </Link>
      </div>

      {counties && counties.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  FIPS
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  County
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  State
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Active
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Methodology
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Hearing Format
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Last Verified
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {counties.map((county) => (
                <tr key={county.county_fips} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">
                    {county.county_fips}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {county.county_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {county.state_abbreviation}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {county.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                    {county.assessment_methodology?.replace(/_/g, ' ') ?? '--'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                    {county.hearing_format?.replace(/_/g, ' ') ?? '--'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(county.last_verified_date)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/admin/counties/${county.county_fips}/edit`}
                      className="inline-flex items-center rounded-lg border border-[#1a2744] px-3 py-1.5 text-xs font-medium text-[#1a2744] transition-colors hover:bg-[#1a2744] hover:text-white"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No county rules configured yet.</p>
          <Link
            href="/admin/counties/new/edit"
            className="mt-4 inline-flex items-center text-sm font-medium text-[#1a2744] hover:underline"
          >
            Add your first county
          </Link>
        </div>
      )}
    </div>
  );
}
