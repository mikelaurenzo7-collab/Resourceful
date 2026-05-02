// ─── Admin: Partner Management ───────────────────────────────────────────────
// Lists all API partners with usage stats and management links.

import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiPartner } from '@/lib/services/partner-api-service';

export const dynamic = 'force-dynamic';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function PartnersPage() {
  const supabase = createAdminClient();

  const { data: rawPartners, error } = await supabase
    .from('api_partners' as never)
    .select('*')
    .order('created_at', { ascending: false });

  const partners = (rawPartners ?? []) as unknown as ApiPartner[];

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          Error loading partners: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">API Partners</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage white-label partners and API access for property tax firms.
          </p>
        </div>
        <Link
          href="/admin/partners/create"
          className="inline-flex items-center rounded-lg bg-amber-400/15 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-400/20"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Partner
        </Link>
      </div>

      {partners.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <table className="min-w-full divide-y divide-white/[0.06]">
            <thead className="bg-white/[0.03]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Firm
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Contact
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  API Key
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  This Month
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total Reports
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Revenue
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Per Report
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {partners.map((partner) => (
                <tr key={partner.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-100">
                      {partner.firm_name}
                    </div>
                    {partner.white_label_name && (
                      <div className="text-xs text-gray-400">
                        Brand: {partner.white_label_name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-100">{partner.contact_name ?? '--'}</div>
                    <div className="text-xs text-gray-500">{partner.contact_email}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {partner.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-white/[0.06] px-2 py-1 text-xs font-mono text-gray-300">
                      {partner.api_key_prefix}****
                    </code>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-300">
                    {partner.reports_this_month}
                    {partner.monthly_report_limit !== null && (
                      <span className="text-gray-400"> / {partner.monthly_report_limit}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-gray-100">
                    {partner.total_reports_generated}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-100">
                    {formatCurrency(partner.total_revenue_cents)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-300">
                    {formatCurrency(partner.per_report_fee_cents)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(partner.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
          <p className="mt-4 text-sm text-gray-500">No API partners yet.</p>
          <Link
            href="/admin/partners/create"
            className="mt-4 inline-flex items-center rounded-lg bg-amber-400/15 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-400/20"
          >
            Create Your First Partner
          </Link>
        </div>
      )}
    </div>
  );
}
