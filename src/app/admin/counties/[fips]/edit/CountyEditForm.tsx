'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CountyRule } from '@/types/database';
import { saveCounty } from './actions';

interface CountyEditFormProps {
  county: CountyRule | null;
  isNew: boolean;
}

export default function CountyEditForm({ county, isNew }: CountyEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await saveCounty(county?.county_fips ?? null, form);
        router.push('/admin/counties');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <legend className="px-2 text-sm font-semibold text-gray-900">Basic Information</legend>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div>
            <label htmlFor="county_fips" className="block text-sm font-medium text-gray-700">
              FIPS Code <span className="text-red-500">*</span>
            </label>
            <input
              id="county_fips"
              name="county_fips"
              type="text"
              required
              defaultValue={county?.county_fips ?? ''}
              placeholder="17031"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div>
            <label htmlFor="county_name" className="block text-sm font-medium text-gray-700">
              County Name <span className="text-red-500">*</span>
            </label>
            <input
              id="county_name"
              name="county_name"
              type="text"
              required
              defaultValue={county?.county_name ?? ''}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div>
            <label htmlFor="state_name" className="block text-sm font-medium text-gray-700">
              State Name <span className="text-red-500">*</span>
            </label>
            <input
              id="state_name"
              name="state_name"
              type="text"
              required
              defaultValue={county?.state_name ?? ''}
              placeholder="Illinois"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div>
            <label htmlFor="state_abbreviation" className="block text-sm font-medium text-gray-700">
              State Abbreviation <span className="text-red-500">*</span>
            </label>
            <input
              id="state_abbreviation"
              name="state_abbreviation"
              type="text"
              required
              maxLength={2}
              defaultValue={county?.state_abbreviation ?? ''}
              placeholder="IL"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <input
            id="is_active"
            name="is_active"
            type="checkbox"
            defaultChecked={county?.is_active ?? false}
            className="h-4 w-4 rounded border-gray-300 text-[#1a2744] focus:ring-[#1a2744]"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active</label>
        </div>
      </fieldset>

      {/* Assessment Rules */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <legend className="px-2 text-sm font-semibold text-gray-900">Assessment Rules</legend>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div>
            <label htmlFor="assessment_methodology" className="block text-sm font-medium text-gray-700">
              Methodology
            </label>
            <select
              id="assessment_methodology"
              name="assessment_methodology"
              defaultValue={county?.assessment_methodology ?? ''}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            >
              <option value="">-- Select --</option>
              <option value="full_value">Full Value</option>
              <option value="fractional">Fractional</option>
            </select>
          </div>
          <div>
            <label htmlFor="assessment_methodology_notes" className="block text-sm font-medium text-gray-700">
              Methodology Notes
            </label>
            <input
              id="assessment_methodology_notes"
              name="assessment_methodology_notes"
              type="text"
              defaultValue={county?.assessment_methodology_notes ?? ''}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6 mt-4">
          <div>
            <label htmlFor="assessment_ratio_residential" className="block text-sm font-medium text-gray-700">
              Residential Ratio
            </label>
            <input
              id="assessment_ratio_residential"
              name="assessment_ratio_residential"
              type="number"
              step="0.001"
              min="0"
              max="1"
              defaultValue={county?.assessment_ratio_residential ?? ''}
              placeholder="0.333"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div>
            <label htmlFor="assessment_ratio_commercial" className="block text-sm font-medium text-gray-700">
              Commercial Ratio
            </label>
            <input
              id="assessment_ratio_commercial"
              name="assessment_ratio_commercial"
              type="number"
              step="0.001"
              min="0"
              max="1"
              defaultValue={county?.assessment_ratio_commercial ?? ''}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div>
            <label htmlFor="assessment_ratio_industrial" className="block text-sm font-medium text-gray-700">
              Industrial Ratio
            </label>
            <input
              id="assessment_ratio_industrial"
              name="assessment_ratio_industrial"
              type="number"
              step="0.001"
              min="0"
              max="1"
              defaultValue={county?.assessment_ratio_industrial ?? ''}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
        </div>
      </fieldset>

      {/* Appeal Information */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <legend className="px-2 text-sm font-semibold text-gray-900">Appeal Information</legend>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div>
            <label htmlFor="appeal_board_name" className="block text-sm font-medium text-gray-700">
              Appeal Board Name
            </label>
            <input
              id="appeal_board_name"
              name="appeal_board_name"
              type="text"
              defaultValue={county?.appeal_board_name ?? ''}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div>
            <label htmlFor="appeal_board_phone" className="block text-sm font-medium text-gray-700">
              Appeal Board Phone
            </label>
            <input
              id="appeal_board_phone"
              name="appeal_board_phone"
              type="tel"
              defaultValue={county?.appeal_board_phone ?? ''}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="appeal_board_address" className="block text-sm font-medium text-gray-700">
              Appeal Board Address
            </label>
            <input
              id="appeal_board_address"
              name="appeal_board_address"
              type="text"
              defaultValue={county?.appeal_board_address ?? ''}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div>
            <label htmlFor="appeal_deadline_rule" className="block text-sm font-medium text-gray-700">
              Appeal Deadline Rule
            </label>
            <input
              id="appeal_deadline_rule"
              name="appeal_deadline_rule"
              type="text"
              defaultValue={county?.appeal_deadline_rule ?? ''}
              placeholder="30 days after mailing of assessment notice"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div>
            <label htmlFor="tax_year_appeal_window" className="block text-sm font-medium text-gray-700">
              Tax Year Appeal Window
            </label>
            <input
              id="tax_year_appeal_window"
              name="tax_year_appeal_window"
              type="text"
              defaultValue={county?.tax_year_appeal_window ?? ''}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
          <div>
            <label htmlFor="hearing_format" className="block text-sm font-medium text-gray-700">
              Hearing Format
            </label>
            <select
              id="hearing_format"
              name="hearing_format"
              defaultValue={county?.hearing_format ?? ''}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            >
              <option value="">-- Select --</option>
              <option value="in_person">In Person</option>
              <option value="virtual">Virtual</option>
              <option value="both">Both</option>
              <option value="written_only">Written Only</option>
            </select>
          </div>
          <div>
            <label htmlFor="filing_fee_cents" className="block text-sm font-medium text-gray-700">
              Filing Fee (cents)
            </label>
            <input
              id="filing_fee_cents"
              name="filing_fee_cents"
              type="number"
              min="0"
              defaultValue={county?.filing_fee_cents ?? 0}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-6">
          <div className="flex items-center gap-2">
            <input id="hearing_typically_required" name="hearing_typically_required" type="checkbox" defaultChecked={county?.hearing_typically_required ?? false} className="h-4 w-4 rounded border-gray-300 text-[#1a2744] focus:ring-[#1a2744]" />
            <label htmlFor="hearing_typically_required" className="text-sm text-gray-700">Hearing typically required</label>
          </div>
          <div className="flex items-center gap-2">
            <input id="accepts_online_filing" name="accepts_online_filing" type="checkbox" defaultChecked={county?.accepts_online_filing ?? false} className="h-4 w-4 rounded border-gray-300 text-[#1a2744] focus:ring-[#1a2744]" />
            <label htmlFor="accepts_online_filing" className="text-sm text-gray-700">Accepts online filing</label>
          </div>
          <div className="flex items-center gap-2">
            <input id="accepts_email_filing" name="accepts_email_filing" type="checkbox" defaultChecked={county?.accepts_email_filing ?? false} className="h-4 w-4 rounded border-gray-300 text-[#1a2744] focus:ring-[#1a2744]" />
            <label htmlFor="accepts_email_filing" className="text-sm text-gray-700">Accepts email filing</label>
          </div>
          <div className="flex items-center gap-2">
            <input id="requires_mail_filing" name="requires_mail_filing" type="checkbox" defaultChecked={county?.requires_mail_filing ?? false} className="h-4 w-4 rounded border-gray-300 text-[#1a2744] focus:ring-[#1a2744]" />
            <label htmlFor="requires_mail_filing" className="text-sm text-gray-700">Requires mail filing</label>
          </div>
        </div>
      </fieldset>

      {/* Assessment Schedule & Deadlines */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <legend className="px-2 text-sm font-semibold text-gray-900">Assessment Schedule & Deadlines</legend>
        <p className="text-xs text-gray-500 mt-1 mb-4">Precise deadline data powers the filing guide&apos;s urgency messaging and countdown timers.</p>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div>
            <label htmlFor="assessment_cycle" className="block text-sm font-medium text-gray-700">Assessment Cycle</label>
            <select id="assessment_cycle" name="assessment_cycle" defaultValue={county?.assessment_cycle ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]">
              <option value="">-- Select --</option>
              <option value="Annual">Annual</option>
              <option value="Biennial">Biennial (every 2 years)</option>
              <option value="Triennial">Triennial (every 3 years)</option>
              <option value="Quadrennial">Quadrennial (every 4 years)</option>
              <option value="Sexennial">Sexennial (every 6 years)</option>
            </select>
          </div>
          <div>
            <label htmlFor="current_tax_year" className="block text-sm font-medium text-gray-700">Current Tax Year</label>
            <input id="current_tax_year" name="current_tax_year" type="number" min="2020" max="2030" defaultValue={county?.current_tax_year ?? new Date().getFullYear()} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="next_appeal_deadline" className="block text-sm font-medium text-gray-700">
              Next Appeal Deadline <span className="text-amber-600 text-xs">(critical)</span>
            </label>
            <input id="next_appeal_deadline" name="next_appeal_deadline" type="date" defaultValue={county?.next_appeal_deadline ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
            <p className="text-xs text-gray-400 mt-1">Exact date shown prominently in filing guide</p>
          </div>
          <div>
            <label htmlFor="appeal_window_days" className="block text-sm font-medium text-gray-700">Appeal Window (days from notice)</label>
            <input id="appeal_window_days" name="appeal_window_days" type="number" min="0" defaultValue={county?.appeal_window_days ?? ''} placeholder="30" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="assessment_notices_mailed" className="block text-sm font-medium text-gray-700">Assessment Notices Mailed</label>
            <input id="assessment_notices_mailed" name="assessment_notices_mailed" type="text" defaultValue={county?.assessment_notices_mailed ?? ''} placeholder="February 1 annually" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="typical_resolution_weeks_min" className="block text-sm font-medium text-gray-700">Resolution Timeline (weeks)</label>
            <div className="flex gap-2 mt-1">
              <input id="typical_resolution_weeks_min" name="typical_resolution_weeks_min" type="number" min="0" defaultValue={county?.typical_resolution_weeks_min ?? ''} placeholder="Min" className="w-1/2 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
              <input id="typical_resolution_weeks_max" name="typical_resolution_weeks_max" type="number" min="0" defaultValue={county?.typical_resolution_weeks_max ?? ''} placeholder="Max" className="w-1/2 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="required_documents" className="block text-sm font-medium text-gray-700">Required Documents (comma separated)</label>
          <input id="required_documents" name="required_documents" type="text" defaultValue={county?.required_documents?.join(', ') ?? ''} placeholder="Appeal form, evidence of value, photos, comparable sales, tax bill" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
        </div>
      </fieldset>

      {/* Informal Review & Hearing Details */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <legend className="px-2 text-sm font-semibold text-gray-900">Informal Review & Hearing Details</legend>
        <p className="text-xs text-gray-500 mt-1 mb-4">Informal review is the #1 tip for homeowners — most appeals resolve here without a formal hearing.</p>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div className="col-span-2 flex items-center gap-2">
            <input id="informal_review_available" name="informal_review_available" type="checkbox" defaultChecked={county?.informal_review_available ?? false} className="h-4 w-4 rounded border-gray-300 text-[#1a2744] focus:ring-[#1a2744]" />
            <label htmlFor="informal_review_available" className="text-sm font-medium text-gray-700">Informal review available before formal hearing</label>
          </div>
          <div className="col-span-2">
            <label htmlFor="informal_review_notes" className="block text-sm font-medium text-gray-700">Informal Review Instructions</label>
            <textarea id="informal_review_notes" name="informal_review_notes" rows={2} defaultValue={county?.informal_review_notes ?? ''} placeholder='e.g., "Call assessor office at (312) 443-7550 and request informal review. Bring evidence packet."' className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="hearing_duration_minutes" className="block text-sm font-medium text-gray-700">Hearing Duration (minutes)</label>
            <input id="hearing_duration_minutes" name="hearing_duration_minutes" type="number" min="0" defaultValue={county?.hearing_duration_minutes ?? ''} placeholder="15" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div className="flex items-center gap-2 mt-6">
            <input id="virtual_hearing_available" name="virtual_hearing_available" type="checkbox" defaultChecked={county?.virtual_hearing_available ?? false} className="h-4 w-4 rounded border-gray-300 text-[#1a2744] focus:ring-[#1a2744]" />
            <label htmlFor="virtual_hearing_available" className="text-sm text-gray-700">Virtual hearing available</label>
          </div>
          <div>
            <label htmlFor="virtual_hearing_platform" className="block text-sm font-medium text-gray-700">Virtual Platform</label>
            <input id="virtual_hearing_platform" name="virtual_hearing_platform" type="text" defaultValue={county?.virtual_hearing_platform ?? ''} placeholder="Zoom, WebEx, Microsoft Teams" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="hearing_scheduling_notes" className="block text-sm font-medium text-gray-700">Hearing Scheduling Notes</label>
            <input id="hearing_scheduling_notes" name="hearing_scheduling_notes" type="text" defaultValue={county?.hearing_scheduling_notes ?? ''} placeholder='e.g., "Scheduled 2-4 weeks after filing. Notification by mail."' className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
        </div>
      </fieldset>

      {/* Data Freshness */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <legend className="px-2 text-sm font-semibold text-gray-900">Data Freshness</legend>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div>
            <label htmlFor="last_verified_date" className="block text-sm font-medium text-gray-700">Last Verified Date</label>
            <input id="last_verified_date" name="last_verified_date" type="date" defaultValue={county?.last_verified_date ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="verified_by" className="block text-sm font-medium text-gray-700">Verified By</label>
            <input id="verified_by" name="verified_by" type="text" defaultValue={county?.verified_by ?? ''} placeholder="Your name" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
        </div>
      </fieldset>

      {/* Filing Resources */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <legend className="px-2 text-sm font-semibold text-gray-900">Filing Resources</legend>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div>
            <label htmlFor="portal_url" className="block text-sm font-medium text-gray-700">
              Portal URL
            </label>
            <input id="portal_url" name="portal_url" type="url" defaultValue={county?.portal_url ?? ''} placeholder="https://..." className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="filing_email" className="block text-sm font-medium text-gray-700">
              Filing Email
            </label>
            <input id="filing_email" name="filing_email" type="email" defaultValue={county?.filing_email ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="appeal_form_name" className="block text-sm font-medium text-gray-700">
              Appeal Form Name
            </label>
            <input id="appeal_form_name" name="appeal_form_name" type="text" defaultValue={county?.appeal_form_name ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="form_download_url" className="block text-sm font-medium text-gray-700">
              Form Download URL
            </label>
            <input id="form_download_url" name="form_download_url" type="url" defaultValue={county?.form_download_url ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="evidence_requirements" className="block text-sm font-medium text-gray-700">
            Evidence Requirements (comma separated)
          </label>
          <input id="evidence_requirements" name="evidence_requirements" type="text" defaultValue={county?.evidence_requirements?.join(', ') ?? ''} placeholder="Recent appraisal, comparable sales, photos" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
        </div>
      </fieldset>

      {/* Representation Rules */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <legend className="px-2 text-sm font-semibold text-gray-900">Representation Rules</legend>
        <p className="text-xs text-gray-500 mt-1 mb-4">Configure whether non-attorney representatives can file appeals on behalf of property owners in this county.</p>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div className="col-span-2 flex items-center gap-2">
            <input id="authorized_rep_allowed" name="authorized_rep_allowed" type="checkbox" defaultChecked={county?.authorized_rep_allowed ?? false} className="h-4 w-4 rounded border-gray-300 text-[#1a2744] focus:ring-[#1a2744]" />
            <label htmlFor="authorized_rep_allowed" className="text-sm font-medium text-gray-700">Authorized representatives allowed (non-attorneys can file on behalf of property owners)</label>
          </div>
          <div>
            <label htmlFor="authorized_rep_types" className="block text-sm font-medium text-gray-700">
              Authorized Rep Types (comma separated)
            </label>
            <input id="authorized_rep_types" name="authorized_rep_types" type="text" defaultValue={county?.authorized_rep_types?.join(', ') ?? ''} placeholder="tax_consultant, appraiser, cpa, any_individual" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
            <p className="text-xs text-gray-400 mt-1">Who qualifies as an authorized representative</p>
          </div>
          <div>
            <label htmlFor="authorized_rep_form_url" className="block text-sm font-medium text-gray-700">
              POA / Agent Authorization Form URL
            </label>
            <input id="authorized_rep_form_url" name="authorized_rep_form_url" type="url" defaultValue={county?.authorized_rep_form_url ?? ''} placeholder="https://..." className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div className="col-span-2">
            <label htmlFor="rep_restrictions_notes" className="block text-sm font-medium text-gray-700">
              Representation Restrictions
            </label>
            <textarea id="rep_restrictions_notes" name="rep_restrictions_notes" rows={2} defaultValue={county?.rep_restrictions_notes ?? ''} placeholder="e.g., Entities (LLCs, corporations) must use attorneys. Individuals may use any authorized representative." className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
        </div>
      </fieldset>

      {/* Further Appeal / Escalation */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <legend className="px-2 text-sm font-semibold text-gray-900">Further Appeal / Escalation</legend>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div>
            <label htmlFor="further_appeal_body" className="block text-sm font-medium text-gray-700">Further Appeal Body</label>
            <input id="further_appeal_body" name="further_appeal_body" type="text" defaultValue={county?.further_appeal_body ?? ''} placeholder="e.g., State Property Tax Appeal Board" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="further_appeal_url" className="block text-sm font-medium text-gray-700">Further Appeal URL</label>
            <input id="further_appeal_url" name="further_appeal_url" type="url" defaultValue={county?.further_appeal_url ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="further_appeal_deadline_rule" className="block text-sm font-medium text-gray-700">Further Appeal Deadline</label>
            <input id="further_appeal_deadline_rule" name="further_appeal_deadline_rule" type="text" defaultValue={county?.further_appeal_deadline_rule ?? ''} placeholder="e.g., 30 days after board decision" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="further_appeal_fee_cents" className="block text-sm font-medium text-gray-700">Further Appeal Fee (cents)</label>
            <input id="further_appeal_fee_cents" name="further_appeal_fee_cents" type="number" min="0" defaultValue={county?.further_appeal_fee_cents ?? 0} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
        </div>
      </fieldset>

      {/* State Appeal / API / Notes */}
      <fieldset className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <legend className="px-2 text-sm font-semibold text-gray-900">Additional Settings</legend>
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div>
            <label htmlFor="state_appeal_board_name" className="block text-sm font-medium text-gray-700">State Appeal Board</label>
            <input id="state_appeal_board_name" name="state_appeal_board_name" type="text" defaultValue={county?.state_appeal_board_name ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="state_appeal_board_url" className="block text-sm font-medium text-gray-700">State Appeal Board URL</label>
            <input id="state_appeal_board_url" name="state_appeal_board_url" type="url" defaultValue={county?.state_appeal_board_url ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="pro_se_tips" className="block text-sm font-medium text-gray-700">Pro Se Tips</label>
            <textarea id="pro_se_tips" name="pro_se_tips" rows={3} defaultValue={county?.pro_se_tips ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Internal Notes</label>
            <textarea id="notes" name="notes" rows={3} defaultValue={county?.notes ?? ''} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]" />
          </div>
        </div>
      </fieldset>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={() => router.push('/admin/counties')}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[#1a2744] px-6 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#243356] disabled:opacity-50"
        >
          {isPending ? 'Saving...' : isNew ? 'Create County' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
