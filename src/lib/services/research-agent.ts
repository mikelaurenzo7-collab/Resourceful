// ─── Evidence-First Research Agent ───────────────────────────────────────────
// Resourceful uses OpenAI for research synthesis and judgment. Serper retrieves
// current public web results; Resourceful then selects, reads, labels, and sends
// bounded source excerpts to OpenAI for an evidence-grounded synthesis.

import OpenAI from 'openai';
import { AI_MODELS, AI_REASONING, type ReasoningEffort } from '@/config/ai';
import { apiLogger } from '@/lib/logger';
import { withRetry, isRetryableError } from '@/lib/utils/retry';

export interface ResearchContext {
  countyName: string;
  stateName: string;
  propertyType: string;
  serviceType: string;
  desiredOutcome?: string | null;
  assessedValue?: number | null;
  concludedValue?: number | null;
  propertyIssues?: string[];
}

export interface ResearchResult {
  strategyInsights: string;
  deadlineInfo: string | null;
  boardIntelligence: string | null;
  recentChanges: string | null;
  searchesPerformed: number;
  sources: string[];
}

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface EvidenceSource extends SearchResult {
  pageText: string;
}

const MAX_SEARCHES = 5;
const MAX_SOURCES = 10;
const MAX_PAGES_TO_READ = 6;
const MAX_PAGE_CHARS = 6_000;

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set.');
    }

    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 120_000,
    });
  }

  return openaiClient;
}

function reasoning(effort: ReasoningEffort) {
  return { effort } as unknown as { effort: 'none' | 'low' | 'medium' | 'high' };
}

async function executeWebSearch(
  query: string
): Promise<{ results: SearchResult[]; error?: string }> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    return { results: [], error: 'SERPER_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 6 }),
    });

    if (!response.ok) {
      return { results: [], error: `Serper returned ${response.status}` };
    }

    const data = await response.json() as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    };

    return {
      results: (data.organic ?? [])
        .filter(result => Boolean(result.link))
        .map(result => ({
          title: result.title?.trim() || 'Untitled source',
          link: result.link!.trim(),
          snippet: result.snippet?.trim() || '',
        })),
    };
  } catch (error) {
    return {
      results: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const { fetchPageText } = await import('@/lib/utils/page-fetch');
    return ((await fetchPageText(url, 12_000, 12_000)) ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_PAGE_CHARS);
  } catch {
    return '';
  }
}

function buildSearchQueries(context: ResearchContext, currentYear: number): string[] {
  const location = `${context.countyName} County ${context.stateName}`;
  const property = context.propertyType.replace(/_/g, ' ');

  if (context.serviceType === 'pre_purchase') {
    return [
      `${location} ${property} housing market ${currentYear} median sale price days on market`,
      `${location} ${property} recent comparable sales price per square foot ${currentYear}`,
      `${location} property reassessment after sale assessment ratio property taxes official`,
      `${location} flood environmental insurance development risk property buyers ${currentYear}`,
      `${location} planning development infrastructure projects ${currentYear} official`,
    ];
  }

  if (context.serviceType === 'pre_listing') {
    return [
      `${location} ${property} housing market ${currentYear} days on market list to sale ratio`,
      `${location} ${property} active listings recent sales price per square foot ${currentYear}`,
      `${location} seller market inventory buyer demand seasonal trends ${currentYear}`,
      `${location} property assessment ratio taxes buyer exposure official`,
      `${location} development planning market changes ${currentYear} official`,
    ];
  }

  return [
    `${location} property tax appeal filing deadline ${currentYear} official`,
    `${location} board of review property tax appeal rules evidence comparable sales official`,
    `${location} ${property} assessment appeal hearing procedures ${currentYear}`,
    `${location} reassessment changes property tax appeal ${currentYear}`,
    `${location} ${property} recent sales market trend assessment appeal evidence ${currentYear}`,
  ];
}

function sourcePriority(source: SearchResult, context: ResearchContext): number {
  const haystack = `${source.title} ${source.link} ${source.snippet}`.toLowerCase();
  let score = 0;

  if (/\.gov(?:\/|$)/.test(source.link.toLowerCase())) score += 8;
  if (/assessor|board of review|appeal|county|treasurer|clerk/.test(haystack)) score += 4;
  if (haystack.includes(context.countyName.toLowerCase())) score += 3;
  if (haystack.includes(context.stateName.toLowerCase())) score += 2;
  if (/realtor|redfin|zillow|crexi|loopnet|cbre|jll|cushman/.test(haystack)) score += 1;

  return score;
}

function deduplicateSources(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const unique: SearchResult[] = [];

  for (const result of results) {
    try {
      const parsed = new URL(result.link);
      parsed.hash = '';
      const normalized = parsed.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      unique.push({ ...result, link: normalized });
    } catch {
      continue;
    }
  }

  return unique;
}

function buildResearchSystemPrompt(context: ResearchContext, currentYear: number): string {
  const serviceRole = context.serviceType === 'pre_purchase'
    ? 'buyer-side property research analyst'
    : context.serviceType === 'pre_listing'
      ? 'seller-side property research analyst'
      : 'property-tax appeal research analyst';

  return `You are Resourceful's ${serviceRole}. Analyze only the supplied source evidence for a ${context.propertyType.replace(/_/g, ' ')} property in ${context.countyName} County, ${context.stateName}.

Rules:
- Do not rely on model memory for dates, deadlines, procedures, market figures, or jurisdiction rules.
- Every material factual claim must cite one or more supplied source labels such as [SOURCE 1].
- Prefer official government sources for deadlines, filing rules, and authority procedures.
- Distinguish confirmed facts from implications and open questions.
- Never guarantee eligibility, a value conclusion, tax savings, filing acceptance, or a favorable outcome.
- Do not describe Resourceful's standard analysis as a certified appraisal, legal advice, or representation.
- Treat ${currentYear} information as current only when the cited source supports that date.
- When evidence conflicts or is incomplete, say so plainly.

Return exactly these sections:
STRATEGY_INSIGHTS: Evidence-backed implications and recommended next steps.
DEADLINE_INFO: Confirmed time-sensitive information, or "Not confirmed from supplied sources."
BOARD_INTELLIGENCE: Confirmed authority procedures and evidence preferences, or "Not confirmed from supplied sources."
RECENT_CHANGES: Confirmed current-year changes or market shifts, or "Not confirmed from supplied sources."`;
}

function buildEvidencePrompt(
  context: ResearchContext,
  currentYear: number,
  evidence: EvidenceSource[]
): string {
  const propertyContext = [
    `Service: ${context.serviceType}`,
    `Property type: ${context.propertyType}`,
    `Location: ${context.countyName} County, ${context.stateName}`,
    context.assessedValue ? `Current assessed value: $${context.assessedValue.toLocaleString()}` : null,
    context.concludedValue ? `Current internal conclusion: $${context.concludedValue.toLocaleString()}` : null,
    context.desiredOutcome ? `Customer goal: ${context.desiredOutcome}` : null,
    context.propertyIssues?.length ? `Known property issues: ${context.propertyIssues.join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const sourceBlock = evidence.map((source, index) => {
    const label = `SOURCE ${index + 1}`;
    return `[${label}]
Title: ${source.title}
URL: ${source.link}
Search snippet: ${source.snippet || 'None'}
Retrieved page text: ${source.pageText || 'Page text unavailable; rely only on the search snippet.'}`;
  }).join('\n\n');

  return `Prepare a ${currentYear} research synthesis for this case.

PROPERTY CONTEXT
${propertyContext}

SOURCE EVIDENCE
${sourceBlock}`;
}

async function synthesizeResearch(
  context: ResearchContext,
  currentYear: number,
  evidence: EvidenceSource[]
): Promise<string> {
  const response = await withRetry(
    () => getOpenAIClient().responses.create({
      model: AI_MODELS.RESEARCH,
      store: false,
      max_output_tokens: 2_400,
      reasoning: reasoning(AI_REASONING.RESEARCH),
      input: [
        {
          role: 'system',
          content: buildResearchSystemPrompt(context, currentYear),
        },
        {
          role: 'user',
          content: buildEvidencePrompt(context, currentYear, evidence),
        },
      ],
    }),
    { maxAttempts: 3, baseDelayMs: 2_000, retryOn: isRetryableError }
  );

  return response.output_text.trim();
}

export async function researchAppealStrategy(
  context: ResearchContext
): Promise<ResearchResult> {
  if (!process.env.SERPER_API_KEY) {
    apiLogger.info('[research-agent] SERPER_API_KEY not set, skipping current-source research');
    return emptyResearchResult();
  }

  if (!process.env.OPENAI_API_KEY) {
    apiLogger.warn('[research-agent] OPENAI_API_KEY not set, skipping research synthesis');
    return emptyResearchResult();
  }

  const currentYear = new Date().getFullYear();
  const queries = buildSearchQueries(context, currentYear).slice(0, MAX_SEARCHES);
  const collected: SearchResult[] = [];
  let searchesPerformed = 0;

  try {
    for (const query of queries) {
      const search = await executeWebSearch(query);
      searchesPerformed += 1;

      if (search.error) {
        apiLogger.warn({ query, error: search.error }, '[research-agent] Search failed');
        continue;
      }

      collected.push(...search.results);
    }

    const rankedSources = deduplicateSources(collected)
      .sort((a, b) => sourcePriority(b, context) - sourcePriority(a, context))
      .slice(0, MAX_SOURCES);

    if (rankedSources.length === 0) {
      apiLogger.warn(
        { county: context.countyName, state: context.stateName },
        '[research-agent] No usable sources found'
      );
      return { ...emptyResearchResult(), searchesPerformed };
    }

    const evidence: EvidenceSource[] = [];
    for (const source of rankedSources) {
      const pageText = evidence.length < MAX_PAGES_TO_READ
        ? await fetchPageContent(source.link)
        : '';
      evidence.push({ ...source, pageText });
    }

    const finalText = await synthesizeResearch(context, currentYear, evidence);
    const result = parseResearchOutput(finalText);
    result.searchesPerformed = searchesPerformed;
    result.sources = evidence.map(source => source.link);

    apiLogger.info(
      {
        county: context.countyName,
        state: context.stateName,
        model: AI_MODELS.RESEARCH,
        searchesPerformed,
        sourceCount: result.sources.length,
      },
      '[research-agent] OpenAI research synthesis complete'
    );

    return result;
  } catch (error) {
    apiLogger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        county: context.countyName,
        state: context.stateName,
        searchesPerformed,
      },
      '[research-agent] Research failed'
    );

    return { ...emptyResearchResult(), searchesPerformed };
  }
}

function emptyResearchResult(): ResearchResult {
  return {
    strategyInsights: '',
    deadlineInfo: null,
    boardIntelligence: null,
    recentChanges: null,
    searchesPerformed: 0,
    sources: [],
  };
}

function parseResearchOutput(text: string): ResearchResult {
  const extractSection = (label: string): string | null => {
    const regex = new RegExp(
      `${label}[:\\s]*([\\s\\S]*?)(?=(?:STRATEGY_INSIGHTS|DEADLINE_INFO|BOARD_INTELLIGENCE|RECENT_CHANGES|$))`,
      'i'
    );
    const match = text.match(regex);
    const value = match?.[1]?.trim();
    return value && value.length > 10 ? value : null;
  };

  const validateSection = (content: string | null, label: string): string | null => {
    if (!content) return null;
    if (content.length < 30) {
      apiLogger.warn({ label, length: content.length }, '[research-agent] Section too short; discarding');
      return null;
    }

    return content.slice(0, 3_000);
  };

  const strategyRaw = extractSection('STRATEGY_INSIGHTS') ?? text.slice(0, 2_000);
  const deadlineRaw = extractSection('DEADLINE_INFO');
  const boardRaw = extractSection('BOARD_INTELLIGENCE');
  const changesRaw = extractSection('RECENT_CHANGES');

  return {
    strategyInsights: validateSection(strategyRaw, 'STRATEGY_INSIGHTS') ?? strategyRaw.slice(0, 2_000),
    deadlineInfo: validateSection(deadlineRaw, 'DEADLINE_INFO'),
    boardIntelligence: validateSection(boardRaw, 'BOARD_INTELLIGENCE'),
    recentChanges: validateSection(changesRaw, 'RECENT_CHANGES'),
    searchesPerformed: 0,
    sources: [],
  };
}
