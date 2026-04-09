// ─── County Auto-Enrichment Service ──────────────────────────────────────────
// When a report comes in for a county with sparse data, this service
// automatically researches the county's appeal process using web search + AI
// and updates the county_rules row with real intelligence.
//
// This means every county becomes "elite" after the first report in that county.
// The enriched data persists — subsequent reports get it instantly.
//
// Triggered by Stage 1 when it detects a county with missing critical fields.

import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS } from '@/config/ai';
import { withRetry, isRetryableError } from '@/lib/utils/retry';
import type { CountyRule } from '@/types/database';
import { apiLogger } from '@/lib/logger';

// ─── AI Client ───────────────────────────────────────────────────────────────

let _client: Anthropic | null = null;
function getAIClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 90_000,
    });
  }
  return _client;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EnrichmentResult {
  enriched: boolean;
  fieldsUpdated: string[];
  error: string | null;
}

interface ExtractedCountyIntel {
  appeal_board_name: string | null;
  appeal_board_phone: string | null;
  appeal_board_address: string | null;
  portal_url: string | null;
  appeal_deadline_rule: string | null;
  next_appeal_deadline: string | null;
  assessment_cycle: string | null;
  accepts_online_filing: boolean | null;
  hearing_format: string | null;
  hearing_duration_minutes: number | null;
  virtual_hearing_available: boolean | null;
  virtual_hearing_platform: string | null;
  informal_review_available: boolean | null;
  informal_review_notes: string | null;
  filing_fee_cents: number | null;
  appeal_form_name: string | null;
  form_download_url: string | null;
  evidence_requirements: string[] | null;
  required_documents: string[] | null;
  pro_se_tips: string | null;
  further_appeal_body: string | null;
  further_appeal_deadline_rule: string | null;
  state_appeal_board_name: string | null;
  state_appeal_board_url: string | null;
  authorized_rep_allowed: boolean | null;
  board_personality_notes: string | null;
  winning_argument_patterns: string | null;
}

// ─── Enrichment Check ────────────────────────────────────────────────────────

/**
 * Check whether a county needs enrichment.
 * A county needs enrichment if critical fields are missing or generic.
 */
export function needsEnrichment(countyRule: CountyRule): boolean {
  const genericMarkers = [
    'Unknown',
    'needs configuration',
    'Check with county',
  ];

  const isGeneric = (val: string | null | undefined): boolean => {
    if (!val) return true;
    return genericMarkers.some(m => val.toLowerCase().includes(m.toLowerCase()));
  };

  // Missing critical fields = needs enrichment
  if (isGeneric(countyRule.appeal_board_name)) return true;
  if (isGeneric(countyRule.appeal_deadline_rule)) return true;
  if (!countyRule.portal_url && !countyRule.appeal_board_phone) return true;
  if (!countyRule.pro_se_tips) return true;

  // Stale deadline — if next_appeal_deadline is in the past, re-enrich
  if (countyRule.next_appeal_deadline && new Date(countyRule.next_appeal_deadline) < new Date()) return true;

  return false;
}

// ─── Web Search Helpers ──────────────────────────────────────────────────────

async function searchWeb(query: string): Promise<string[]> {
  const urls: string[] = [];
  try {
    const serperKey = process.env.SERPER_API_KEY;
    if (serperKey) {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: 5 }),
      });
      if (response.ok) {
        const data = await response.json() as { organic?: Array<{ link: string; snippet?: string }> };
        urls.push(...(data.organic ?? []).map(r => r.link));
      }
    }
  } catch { /* non-fatal */ }
  return urls;
}

async function fetchPageText(url: string): Promise<string | null> {
  const { fetchPageText: sharedFetch } = await import('@/lib/utils/page-fetch');
  return sharedFetch(url, 12_000, 10_000);
}

// ─── AI Extraction ───────────────────────────────────────────────────────────

async function extractCountyIntelligence(
  countyName: string,
  stateName: string,
  pageTexts: string[]
): Promise<ExtractedCountyIntel | null> {
  if (pageTexts.length === 0) return null;

  const combined = pageTexts.join('\n\n---\n\n').slice(0, 25_000);

  try {
    const response = await withRetry(
      () => getAIClient().messages.create({
      model: AI_MODELS.FAST,
      max_tokens: 3000,
      system: `You are a property tax appeal research specialist. Extract county-specific appeal procedure data from web pages. Return ONLY valid JSON, no markdown. If a field cannot be determined, use null.`,
      messages: [{
        role: 'user',
        content: `Extract property tax appeal procedures for ${countyName} County, ${stateName} from these pages:

${combined}

Return this exact JSON:
{
  "appeal_board_name": "<exact name of the appeal board/review board>",
  "appeal_board_phone": "<phone number>",
  "appeal_board_address": "<physical address>",
  "portal_url": "<online filing or appeal portal URL>",
  "appeal_deadline_rule": "<exact deadline rule with dates if possible>",
  "next_appeal_deadline": "<YYYY-MM-DD if a specific date is mentioned, else null>",
  "assessment_cycle": "<Annual/Biennial/Triennial/etc>",
  "accepts_online_filing": <true/false/null>,
  "hearing_format": "<in_person/virtual/both/written_only>",
  "hearing_duration_minutes": <number or null>,
  "virtual_hearing_available": <true/false/null>,
  "virtual_hearing_platform": "<Zoom/WebEx/etc or null>",
  "informal_review_available": <true/false/null>,
  "informal_review_notes": "<how to request informal review, who to contact>",
  "filing_fee_cents": <number in cents, 0 if free, null if unknown>,
  "appeal_form_name": "<name of the appeal form>",
  "form_download_url": "<URL to download the form>",
  "evidence_requirements": ["<list of what evidence they accept>"],
  "required_documents": ["<list of required docs>"],
  "pro_se_tips": "<specific tips for self-represented appellants in this county — deadlines, what works, what to avoid, quirks>",
  "further_appeal_body": "<name of next-level appeal body>",
  "further_appeal_deadline_rule": "<deadline for further appeal>",
  "state_appeal_board_name": "<state-level appeal board name>",
  "state_appeal_board_url": "<URL>",
  "authorized_rep_allowed": <true/false/null>,
  "board_personality_notes": "<any info about how the board operates, what they respond to, culture>",
  "winning_argument_patterns": "<what types of arguments tend to win in this county>"
}`,
      }],
    }),
      { maxAttempts: 3, baseDelayMs: 2000, retryOn: isRetryableError }
    );

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as ExtractedCountyIntel;
  } catch (err) {
    apiLogger.error({ countyName, stateName, err }, '[county-enrichment] AI extraction failed for ,');
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Auto-research and enrich a county's appeal intelligence.
 * Searches the web for the county's appeal procedures, extracts structured
 * data using AI, and updates the county_rules row.
 *
 * Only updates fields that are currently null/empty — never overwrites
 * manually verified data.
 *
 * Returns which fields were updated (if any).
 */
export async function enrichCounty(
  countyRule: CountyRule,
  supabase: { from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> } } }
): Promise<EnrichmentResult> {
  const { county_name, state_name, county_fips } = countyRule;

  apiLogger.info({ county_name, state_name }, '[county-enrichment] Researching County, ...');

  // Search for county appeal procedures
  const queries = [
    `${county_name} County ${state_name} property tax appeal process deadline`,
    `${county_name} County ${state_name} board of review assessment appeal how to file`,
  ];

  const allUrls = new Set<string>();
  for (const query of queries) {
    const urls = await searchWeb(query);
    urls.forEach(u => allUrls.add(u));
  }

  if (allUrls.size === 0) {
    apiLogger.info({ county_name, state_name }, '[county-enrichment] No web results for ,');
    return { enriched: false, fieldsUpdated: [], error: 'No web results found' };
  }

  // Fetch pages
  const pageTexts: string[] = [];
  for (const url of Array.from(allUrls).slice(0, 4)) {
    const text = await fetchPageText(url);
    if (text && text.length > 200) pageTexts.push(text);
  }

  if (pageTexts.length === 0) {
    return { enriched: false, fieldsUpdated: [], error: 'Could not fetch any pages' };
  }

  // Extract intelligence
  const intel = await extractCountyIntelligence(county_name, state_name, pageTexts);
  if (!intel) {
    return { enriched: false, fieldsUpdated: [], error: 'AI extraction failed' };
  }

  // Build update — only fill empty fields, never overwrite existing data
  const updates: Record<string, unknown> = {};
  const fieldsUpdated: string[] = [];

  const maybeUpdate = (dbField: string, newValue: unknown) => {
    if (newValue === null || newValue === undefined) return;
    const current = (countyRule as Record<string, unknown>)[dbField];
    if (current === null || current === undefined || current === '' ||
        (typeof current === 'string' && current.toLowerCase().includes('unknown'))) {
      updates[dbField] = newValue;
      fieldsUpdated.push(dbField);
    }
  };

  maybeUpdate('appeal_board_name', intel.appeal_board_name);
  maybeUpdate('appeal_board_phone', intel.appeal_board_phone);
  maybeUpdate('appeal_board_address', intel.appeal_board_address);
  maybeUpdate('portal_url', intel.portal_url);
  maybeUpdate('appeal_deadline_rule', intel.appeal_deadline_rule);
  maybeUpdate('next_appeal_deadline', intel.next_appeal_deadline);
  maybeUpdate('assessment_cycle', intel.assessment_cycle);
  maybeUpdate('hearing_format', intel.hearing_format);
  maybeUpdate('hearing_duration_minutes', intel.hearing_duration_minutes);
  maybeUpdate('informal_review_available', intel.informal_review_available);
  maybeUpdate('informal_review_notes', intel.informal_review_notes);
  maybeUpdate('appeal_form_name', intel.appeal_form_name);
  maybeUpdate('form_download_url', intel.form_download_url);
  maybeUpdate('evidence_requirements', intel.evidence_requirements);
  maybeUpdate('required_documents', intel.required_documents);
  maybeUpdate('pro_se_tips', intel.pro_se_tips);
  maybeUpdate('further_appeal_body', intel.further_appeal_body);
  maybeUpdate('further_appeal_deadline_rule', intel.further_appeal_deadline_rule);
  maybeUpdate('state_appeal_board_name', intel.state_appeal_board_name);
  maybeUpdate('state_appeal_board_url', intel.state_appeal_board_url);
  maybeUpdate('board_personality_notes', intel.board_personality_notes);
  maybeUpdate('winning_argument_patterns', intel.winning_argument_patterns);

  // Boolean fields — only update if currently false/null and new value is true
  if (intel.accepts_online_filing && !countyRule.accepts_online_filing) {
    updates.accepts_online_filing = true;
    fieldsUpdated.push('accepts_online_filing');
  }
  if (intel.virtual_hearing_available && !countyRule.virtual_hearing_available) {
    updates.virtual_hearing_available = true;
    updates.virtual_hearing_platform = intel.virtual_hearing_platform;
    fieldsUpdated.push('virtual_hearing_available');
  }
  if (intel.authorized_rep_allowed && !countyRule.authorized_rep_allowed) {
    updates.authorized_rep_allowed = true;
    fieldsUpdated.push('authorized_rep_allowed');
  }
  if (intel.filing_fee_cents != null && !countyRule.filing_fee_cents) {
    updates.filing_fee_cents = intel.filing_fee_cents;
    fieldsUpdated.push('filing_fee_cents');
  }

  if (fieldsUpdated.length === 0) {
    apiLogger.info({ county_name }, '[county-enrichment] No new data to update for');
    return { enriched: false, fieldsUpdated: [], error: null };
  }

  // Stamp enrichment metadata
  updates.last_verified_date = new Date().toISOString().split('T')[0];
  updates.verified_by = 'Auto-enrichment (web search + AI)';

  // Update the county
  const { error } = await supabase
    .from('county_rules')
    .update(updates)
    .eq('county_fips', county_fips);

  if (error) {
    apiLogger.error({ county_fips, message: error.message }, '[county-enrichment] DB update failed for');
    return { enriched: false, fieldsUpdated: [], error: error.message };
  }

  apiLogger.info(
    `[county-enrichment] Enriched ${county_name}, ${state_name}: ${fieldsUpdated.length} fields updated (${fieldsUpdated.join(', ')})`
  );

  return { enriched: true, fieldsUpdated, error: null };
}
