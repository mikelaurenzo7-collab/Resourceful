'use client';

// ─── Admin: Create Partner Page ──────────────────────────────────────────────
// Form to onboard a new white-label API partner. Displays the API key ONCE
// after creation.

import { useActionState } from 'react';
import Link from 'next/link';
import { createPartnerAction, type CreatePartnerState } from './actions';

const initialState: CreatePartnerState = { success: false };

export default function CreatePartnerPage() {
  const [state, formAction, isPending] = useActionState(createPartnerAction, initialState);

  // ── Success: show the API key (one-time display) ────────────────────────
  if (state.success && state.plaintextKey) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-lg">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-lg font-bold text-emerald-900">
                Partner Created
              </h2>
            </div>
            <p className="text-sm text-emerald-800 mb-2">
              <strong>{state.firmName}</strong> has been set up as an API partner.
            </p>
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-2">
                API Key — Copy Now (shown only once)
              </p>
              <code className="block break-all rounded bg-white px-3 py-2 text-sm font-mono text-gray-900 border border-amber-200">
                {state.plaintextKey}
              </code>
            </div>
            <div className="mt-6 flex gap-3">
              <Link
                href="/admin/partners"
                className="inline-flex items-center rounded-lg bg-[#1a2744] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#243356]"
              >
                Back to Partners
              </Link>
              <Link
                href="/admin/partners/create"
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                Create Another
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/admin/partners"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Partners
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Create API Partner</h1>
        <p className="mt-1 text-sm text-gray-500">
          Set up a new white-label partner with API access for programmatic report generation.
        </p>
      </div>

      {state.error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {state.error}
        </div>
      )}

      <form action={formAction} className="mx-auto max-w-lg space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Firm Details
          </h2>

          <div>
            <label htmlFor="firm_name" className="block text-sm font-medium text-gray-700">
              Firm Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="firm_name"
              id="firm_name"
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
              placeholder="Acme Tax Consultants"
            />
          </div>

          <div>
            <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700">
              Contact Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="contact_email"
              id="contact_email"
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
              placeholder="contact@acmetax.com"
            />
          </div>

          <div>
            <label htmlFor="contact_name" className="block text-sm font-medium text-gray-700">
              Contact Name
            </label>
            <input
              type="text"
              name="contact_name"
              id="contact_name"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
              placeholder="Jane Smith"
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Pricing
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="revenue_share_pct" className="block text-sm font-medium text-gray-700">
                Our Revenue Share %
              </label>
              <input
                type="number"
                name="revenue_share_pct"
                id="revenue_share_pct"
                defaultValue={30}
                min={0}
                max={100}
                step={0.01}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
              />
              <p className="mt-1 text-xs text-gray-400">We keep this %, they keep the rest</p>
            </div>

            <div>
              <label htmlFor="per_report_fee_cents" className="block text-sm font-medium text-gray-700">
                Per-Report Fee (cents)
              </label>
              <input
                type="number"
                name="per_report_fee_cents"
                id="per_report_fee_cents"
                defaultValue={2500}
                min={0}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
              />
              <p className="mt-1 text-xs text-gray-400">2500 = $25.00 per report</p>
            </div>
          </div>

          <div>
            <label htmlFor="monthly_report_limit" className="block text-sm font-medium text-gray-700">
              Monthly Report Limit
            </label>
            <input
              type="number"
              name="monthly_report_limit"
              id="monthly_report_limit"
              min={1}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
              placeholder="Leave empty for unlimited"
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            White-Label Branding
          </h2>

          <div>
            <label htmlFor="white_label_name" className="block text-sm font-medium text-gray-700">
              Brand Name on Reports
            </label>
            <input
              type="text"
              name="white_label_name"
              id="white_label_name"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:ring-1 focus:ring-[#1a2744]"
              placeholder="Their brand name (shown on PDFs)"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin/partners"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-[#1a2744] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#243356] disabled:opacity-50"
          >
            {isPending ? 'Creating...' : 'Create Partner & Generate API Key'}
          </button>
        </div>
      </form>
    </div>
  );
}
