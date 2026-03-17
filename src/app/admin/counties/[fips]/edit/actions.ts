'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
// County rules now use plain text for assessment_methodology and hearing_format

function parseOptionalInt(val: FormDataEntryValue | null): number | null {
  if (!val || val === '') return null;
  const n = parseInt(String(val), 10);
  return isNaN(n) ? null : n;
}

function parseOptionalFloat(val: FormDataEntryValue | null): number | null {
  if (!val || val === '') return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function parseOptionalString(val: FormDataEntryValue | null): string | null {
  if (!val || String(val).trim() === '') return null;
  return String(val).trim();
}

function parseStringArray(val: FormDataEntryValue | null): string[] | null {
  if (!val || String(val).trim() === '') return null;
  return String(val)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCheckbox(form: FormData, name: string): boolean {
  return form.has(name);
}

export async function saveCounty(existingFips: string | null, formData: FormData) {
  // Verify the caller is an authenticated admin
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data: adminCheck } = await authClient
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!adminCheck) throw new Error('Not authorized — admin access required');

  const supabase = createAdminClient();

  const countyFips = String(formData.get('county_fips') ?? '').trim();
  const countyName = String(formData.get('county_name') ?? '').trim();
  const stateName = String(formData.get('state_name') ?? '').trim();
  const stateAbbr = String(formData.get('state_abbreviation') ?? '').trim().toUpperCase();

  if (!countyFips || !countyName || !stateName || !stateAbbr) {
    throw new Error('FIPS code, county name, state name, and state abbreviation are required.');
  }

  const record = {
    county_fips: countyFips,
    county_name: countyName,
    state_name: stateName,
    state_abbreviation: stateAbbr,
    is_active: parseCheckbox(formData, 'is_active'),
    assessment_methodology: (parseOptionalString(formData.get('assessment_methodology')) as string) ?? null,
    assessment_methodology_notes: parseOptionalString(formData.get('assessment_methodology_notes')),
    assessment_ratio_residential: parseOptionalFloat(formData.get('assessment_ratio_residential')),
    assessment_ratio_commercial: parseOptionalFloat(formData.get('assessment_ratio_commercial')),
    assessment_ratio_industrial: parseOptionalFloat(formData.get('assessment_ratio_industrial')),
    appeal_board_name: parseOptionalString(formData.get('appeal_board_name')),
    appeal_board_address: parseOptionalString(formData.get('appeal_board_address')),
    appeal_board_phone: parseOptionalString(formData.get('appeal_board_phone')),
    portal_url: parseOptionalString(formData.get('portal_url')),
    filing_email: parseOptionalString(formData.get('filing_email')),
    accepts_online_filing: parseCheckbox(formData, 'accepts_online_filing'),
    accepts_email_filing: parseCheckbox(formData, 'accepts_email_filing'),
    requires_mail_filing: parseCheckbox(formData, 'requires_mail_filing'),
    state_appeal_board_name: parseOptionalString(formData.get('state_appeal_board_name')),
    state_appeal_board_url: parseOptionalString(formData.get('state_appeal_board_url')),
    appeal_deadline_rule: parseOptionalString(formData.get('appeal_deadline_rule')),
    tax_year_appeal_window: parseOptionalString(formData.get('tax_year_appeal_window')),
    hearing_typically_required: parseCheckbox(formData, 'hearing_typically_required'),
    hearing_format: (parseOptionalString(formData.get('hearing_format')) as string) ?? null,
    appeal_form_name: parseOptionalString(formData.get('appeal_form_name')),
    form_download_url: parseOptionalString(formData.get('form_download_url')),
    evidence_requirements: parseStringArray(formData.get('evidence_requirements')),
    filing_fee_cents: parseOptionalInt(formData.get('filing_fee_cents')) ?? 0,
    filing_fee_notes: parseOptionalString(formData.get('filing_fee_notes')),
    pro_se_tips: parseOptionalString(formData.get('pro_se_tips')),
    // Representation rules
    authorized_rep_allowed: parseCheckbox(formData, 'authorized_rep_allowed'),
    authorized_rep_form_url: parseOptionalString(formData.get('authorized_rep_form_url')),
    authorized_rep_types: parseStringArray(formData.get('authorized_rep_types')),
    rep_restrictions_notes: parseOptionalString(formData.get('rep_restrictions_notes')),
    // Further appeal / escalation
    further_appeal_body: parseOptionalString(formData.get('further_appeal_body')),
    further_appeal_url: parseOptionalString(formData.get('further_appeal_url')),
    further_appeal_deadline_rule: parseOptionalString(formData.get('further_appeal_deadline_rule')),
    further_appeal_fee_cents: parseOptionalInt(formData.get('further_appeal_fee_cents')) ?? 0,
    notes: parseOptionalString(formData.get('notes')),
  };

  if (existingFips) {
    const { error } = await supabase
      .from('county_rules')
      .update(record as never)
      .eq('county_fips', existingFips);

    if (error) throw new Error(`Failed to update county: ${error.message}`);
  } else {
    const { error } = await supabase.from('county_rules').insert(record as never);

    if (error) throw new Error(`Failed to create county: ${error.message}`);
  }

  revalidatePath('/admin/counties');
}
