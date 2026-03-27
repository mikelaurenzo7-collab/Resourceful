import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Report } from '@/types/database';
import { recordOutcome } from './actions';

function formatCents(cents: number | null): string {
  if (cents == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const outcomeOptions = [
  { value: '', label: 'Select an outcome...' },
  { value: 'won_full', label: 'Won (Full Reduction)' },
  { value: 'won_partial', label: 'Won (Partial Reduction)' },
  { value: 'settled_informal', label: 'Settled (Informal Review)' },
  { value: 'lost', label: 'Lost' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'pending_hearing', label: 'Pending Hearing' },
];

export default async function RecordOutcomePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: rawReport, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', params.id)
    .single();

  const report = rawReport as unknown as Report | null;

  if (error || !report) {
    return (
      <div className="p-8">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          Report not found.
        </div>
      </div>
    );
  }

  // If outcome already recorded, redirect to history
  if (report.outcome_reported_at) {
    redirect('/admin/outcomes?tab=history');
  }

  const boundRecordOutcome = recordOutcome.bind(null, report.id);

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/admin/outcomes"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Outcomes
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Record Appeal Outcome</h1>
        <p className="mt-1 text-sm text-gray-500">
          Record the result of the property tax appeal for this report.
        </p>
      </div>

      {/* Property Details */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Property Details
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-gray-500">Address</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {report.property_address}
            </dd>
            <dd className="text-xs text-gray-500">
              {[report.city, report.state].filter(Boolean).join(', ')}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">County</dt>
            <dd className="mt-1 text-sm text-gray-900">{report.county ?? '--'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Client</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {report.client_name ?? report.client_email}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Amount Paid</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {formatCents(report.amount_paid_cents)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Delivered</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDate(report.delivered_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Property Type</dt>
            <dd className="mt-1 text-sm capitalize text-gray-900">
              {report.property_type ?? '--'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Outcome Form */}
      <form action={boundRecordOutcome}>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Appeal Outcome
          </h2>

          <div className="space-y-6">
            {/* Outcome Select */}
            <div>
              <label
                htmlFor="appeal_outcome"
                className="block text-sm font-medium text-gray-700"
              >
                Outcome <span className="text-red-500">*</span>
              </label>
              <select
                id="appeal_outcome"
                name="appeal_outcome"
                required
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
              >
                {outcomeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Savings Amount */}
            <div>
              <label
                htmlFor="actual_savings_dollars"
                className="block text-sm font-medium text-gray-700"
              >
                Actual Savings (USD)
              </label>
              <p className="mt-0.5 text-xs text-gray-500">
                Enter the dollar amount the client saved on their tax bill. Leave blank if
                no savings or unknown.
              </p>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-gray-400 text-sm">$</span>
                </div>
                <input
                  type="number"
                  id="actual_savings_dollars"
                  name="actual_savings_dollars"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-7 pr-3 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="outcome_notes"
                className="block text-sm font-medium text-gray-700"
              >
                Notes
              </label>
              <p className="mt-0.5 text-xs text-gray-500">
                Optional notes about the outcome (hearing details, settlement terms, etc.)
              </p>
              <textarea
                id="outcome_notes"
                name="outcome_notes"
                rows={4}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex items-center gap-3 border-t border-gray-100 pt-6">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-[#1a2744] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#243356]"
            >
              Save Outcome
            </button>
            <Link
              href="/admin/outcomes"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
