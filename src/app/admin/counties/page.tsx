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
    .order('state_abbreviation' as any)
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
          <h1 className="text-2xl font-bold text-gray-100">County Rules</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage assessment rules, appeal deadlines, and filing instructions for each county.
          </p>
        </div>
        <Link
          href="/admin/counties/new/edit"
          className="inline-flex items-center rounded-lg bg-amber-400/15 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-400/20"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add County
        </Link>
      </div>

      {counties && counties.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <table className="min-w-full divide-y divide-white/[0.06]">
            <thead className="bg-white/[0.03]">
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
            <tbody className="divide-y divide-white/[0.04]">
              {counties.map((county) => (
                <tr key={county.county_fips} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-gray-300">
                    {county.county_fips}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-100">
                    {county.county_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {county.state_abbreviation}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {county.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300 capitalize">
                    {county.assessment_methodology?.replace(/_/g, ' ') ?? '--'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300 capitalize">
                    {county.hearing_format?.replace(/_/g, ' ') ?? '--'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(county.last_verified_date)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/admin/counties/${county.county_fips}/edit`}
                      className="inline-flex items-center rounded-lg border border-amber-400/20 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-400/15 hover:text-white"
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
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <p className="text-sm text-gray-500">No county rules configured yet.</p>
          <Link
            href="/admin/counties/new/edit"
            className="mt-4 inline-flex items-center text-sm font-medium text-amber-300 hover:underline"
          >
            Add your first county
          </Link>
        </div>
      )}
    </div>
  );
}
