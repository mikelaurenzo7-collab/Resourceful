// ─── Adaptive Research Agent ─────────────────────────────────────────────────
// Uses Claude with a web_search tool (backed by Serper) to research
// county-specific appeal strategies tailored to each report's situation.
//
// Unlike the static county enrichment (which runs once per county), this
// researches EACH REPORT's specific context: property type, desired outcome,
// county, and current year. The research output feeds into Stage 5 narrative
// generation as additional context.
//
// Architecture: Claude decides what to search → Serper returns results →
// Claude reads results → decides if more research needed → produces output.

import Anthropic from '@anthropic-ai/sdk';
import { AI_MODELS, AI_THINKING_BUDGETS } from '@/config/ai';
import { withRetry, isRetryableError } from '@/lib/utils/retry';
import { apiLogger } from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── AI Client ──────────────────────────────────────────────────────────────

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 120_000,
    });
  }
  return _client;
}

// ─── Serper Search Tool ─────────────────────────────────────────────────────

async function executeWebSearch(query: string): Promise<{ results: Array<{ title: string; link: string; snippet: string }>; error?: string }> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    return { results: [], error: 'SERPER_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 5 }),
    });

    if (!response.ok) {
      return { results: [], error: `Serper returned ${response.status}` };
    }

    const data = await response.json() as {
      organic?: Array<{ title: string; link: string; snippet: string }>;
    };

    return {
      results: (data.organic ?? []).map(r => ({
        title: r.title ?? '',
        link: r.link ?? '',
        snippet: r.snippet ?? '',
      })),
    };
  } catch (err) {
    return { results: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchPageContent(url: string): Promise<string> {
  const { fetchPageText } = await import('@/lib/utils/page-fetch');
  return (await fetchPageText(url, 12_000, 12_000)) ?? '';
}

// ─── Tool Definitions ───────────────────────────────────────────────────────

const SEARCH_TOOL: Anthropic.Tool = {
  name: 'web_search',
  description: 'Search the web for current information. Returns titles, URLs, and snippets for the top 5 results. Use this to research county-specific appeal procedures, deadlines, market trends, and recent changes.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query. Be specific — include county name, state, year, and topic.',
      },
    },
    required: ['query'],
  },
};

const READ_PAGE_TOOL: Anthropic.Tool = {
  name: 'read_page',
  description: 'Fetch and read the full text of a specific web page. Use this to get detailed information from a URL found in search results — county portal pages, news articles, official appeal guides.',
  input_schema: {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string',
        description: 'The full URL to fetch and read.',
      },
    },
    required: ['url'],
  },
};

// ─── Appraisal-Specific Reasoning Tools ──────────────────────────────────────
// These tools give Claude structured scaffolding for appraiser-grade analysis:
// explicitly computing numbers and explicitly rating evidence quality before
// committing to a final recommendation. This prevents implicit/intuitive leaps
// and forces documented reasoning chains — exactly what wins at a Board of Review.

const CALCULATE_TOOL: Anthropic.Tool = {
  name: 'calculate',
  description: 'Perform a numerical calculation and record the result with a label. Use this whenever you need to compute: assessment ratios, percentage differences between assessed and market value, savings potential, days-on-market averages, price-per-sqft comparisons, or any other numeric reasoning step.',
  input_schema: {
    type: 'object' as const,
    properties: {
      label: {
        type: 'string',
        description: 'What this calculation represents (e.g., "implied assessment ratio", "overassessment %", "median price per sqft").',
      },
      expression: {
        type: 'string',
        description: 'The mathematical expression as a string (e.g., "320000 / 485000 * 100").',
      },
      result: {
        type: 'number',
        description: 'The computed numeric result.',
      },
      interpretation: {
        type: 'string',
        description: 'What this result means for the appeal or valuation case.',
      },
    },
    required: ['label', 'expression', 'result', 'interpretation'],
  },
};

const SCORE_EVIDENCE_TOOL: Anthropic.Tool = {
  name: 'score_evidence',
  description: 'Rate the quality and persuasiveness of a specific piece of evidence for use in a property tax appeal or valuation argument. Use this to explicitly evaluate: comparable sales, market trend data, assessment ratio mismatches, deferred maintenance findings, or procedural arguments before deciding how prominently to feature them.',
  input_schema: {
    type: 'object' as const,
    properties: {
      evidence_type: {
        type: 'string',
        description: 'Category: "comparable_sale", "market_trend", "assessment_ratio", "deferred_maintenance", "procedural", "equity_uniformity", or "other".',
      },
      description: {
        type: 'string',
        description: 'Brief description of this specific piece of evidence.',
      },
      strength_score: {
        type: 'number',
        description: 'Score 1-10: how strong and persuasive is this evidence? (10 = board members will find it compelling; 1 = legally weak or easily rebutted).',
      },
      strengths: {
        type: 'string',
        description: 'What makes this evidence strong.',
      },
      weaknesses: {
        type: 'string',
        description: 'Potential objections the assessor could raise.',
      },
      recommended_use: {
        type: 'string',
        description: 'How to best use this evidence in the appeal (lead argument, supporting argument, or skip).',
      },
    },
    required: ['evidence_type', 'description', 'strength_score', 'strengths', 'weaknesses', 'recommended_use'],
  },
};

// All tools available to the research agent loop
const ALL_RESEARCH_TOOLS: Anthropic.Tool[] = [SEARCH_TOOL, READ_PAGE_TOOL, CALCULATE_TOOL, SCORE_EVIDENCE_TOOL];

// ─── Research Prompt Builders ────────────────────────────────────────────────

function buildResearchSystemPrompt(context: ResearchContext, currentYear: number): string {
  const toolsBlock = `You have access to two tools:
- web_search: Search the web for current information
- read_page: Read a specific web page for detailed information`;

  const outputBlock = `After researching, provide your findings as a structured response with these sections:
- STRATEGY_INSIGHTS: The most effective approach for this specific case
- DEADLINE_INFO: Any time-sensitive information (deadlines, market timing, listing freshness)
- BOARD_INTELLIGENCE: How the local assessment authority operates and what they respond to
- RECENT_CHANGES: Any ${currentYear} changes, procedural updates, or market shifts

Be concise but specific. Cite sources where possible. If you can't find information on a topic, say so rather than guessing.`;

  if (context.serviceType === 'pre_purchase') {
    return `You are a buyer-side real estate market analyst helping a buyer evaluate a ${context.propertyType} property in ${context.countyName} County, ${context.stateName}. Your job is to uncover every market data point and risk factor that affects this property's true value and negotiation position.

${toolsBlock}

Research these topics (in order of priority):
1. Current ${currentYear} market conditions in ${context.countyName} County for ${context.propertyType} properties — price trends, days on market, list-to-sale ratios, inventory levels
2. Recent comparable sales and price per square foot trends in ${context.countyName} County
3. Neighborhood-specific factors: development plans, school ratings, crime trends, walkability, flood or environmental risk, anything that impacts long-term value
4. Tax exposure post-purchase: how ${context.countyName} County assesses ${context.propertyType} properties, typical assessment ratio, and how quickly values are reassessed after a sale
5. Any red flags: areas of declining value, high insurance costs, infrastructure issues, or local economic headwinds
${context.desiredOutcome ? `\nClient's goal: ${context.desiredOutcome}` : ''}

${outputBlock}`;
  }

  if (context.serviceType === 'pre_listing') {
    return `You are a seller-side real estate market analyst helping a seller price and position a ${context.propertyType} property in ${context.countyName} County, ${context.stateName}. Your job is to surface every market data point that informs a winning pricing strategy.

${toolsBlock}

Research these topics (in order of priority):
1. Current ${currentYear} market conditions in ${context.countyName} County for ${context.propertyType} properties — days on market, list-to-sale ratios, buyer demand, seasonal trends
2. Active comparable listings and recent sold comparables — what are similar properties listed and selling for?
3. Pricing strategies that are working in this market right now — is this a buyer's or seller's market? Are prices rising, stable, or softening?
4. Buyer preferences and must-haves for ${context.propertyType} properties in this area — what features command premiums?
5. Assessment vs. market value in ${context.countyName} County — how does the county's assessed value typically compare to actual sale prices? This helps buyers understand their tax exposure.
${context.desiredOutcome ? `\nClient's goal: ${context.desiredOutcome}` : ''}

${outputBlock}`;
  }

  // Default: tax_appeal
  return `You are a property tax appeal research specialist. Your job is to research the most current and effective appeal strategies for a ${context.propertyType} property in ${context.countyName} County, ${context.stateName}.

${toolsBlock}

Property context:
- County: ${context.countyName} County, ${context.stateName}
- Property type: ${context.propertyType}
${context.desiredOutcome ? `- Client's desired outcome: ${context.desiredOutcome}` : ''}
${context.assessedValue ? `- Current assessed value: $${context.assessedValue.toLocaleString()}` : ''}
${context.propertyIssues?.length ? `- Known property issues: ${context.propertyIssues.join(', ')}` : ''}

Research these topics (in order of priority):
1. Current ${currentYear} filing deadlines and any recent procedural changes to the appeal process in ${context.countyName} County
2. What arguments and evidence ${context.countyName} County's appeal board finds most persuasive for ${context.propertyType} properties
3. Recent rule changes, new requirements, or procedural updates for ${currentYear}
4. Tips and tactics from successful appellants in ${context.countyName} County — what wins and what backfires
5. Recent local market trends, news, or county-wide reassessment controversies that would support an appeal (e.g., media coverage of overassessment patterns, declining market indicators)

${outputBlock}`;
}

function buildResearchInitialMessage(context: ResearchContext, currentYear: number): string {
  if (context.serviceType === 'pre_purchase') {
    return `Research current market conditions and risk factors for a ${context.propertyType} property purchase in ${context.countyName} County, ${context.stateName} for ${currentYear}. Use web_search and read_page tools to find current, specific market intelligence.`;
  }
  if (context.serviceType === 'pre_listing') {
    return `Research current market conditions and pricing strategy for listing a ${context.propertyType} property in ${context.countyName} County, ${context.stateName} in ${currentYear}. Use web_search and read_page tools to find current comparable listings, recent sales, and market momentum.`;
  }
  return `Research the best appeal strategy for a ${context.propertyType} property tax appeal in ${context.countyName} County, ${context.stateName} for ${currentYear}. Use web_search and read_page tools to find current filing deadlines, board tactics, and local market evidence.`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Research county-specific appeal strategies for a specific report.
 * Claude decides what to search based on the property context.
 * Returns structured research that feeds into narrative generation.
 *
 * Max 5 search calls to keep costs reasonable (~$0.10-0.20 per report).
 */
export async function researchAppealStrategy(
  context: ResearchContext
): Promise<ResearchResult> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    apiLogger.info('[research-agent] SERPER_API_KEY not set, skipping research');
    return {
      strategyInsights: '',
      deadlineInfo: null,
      boardIntelligence: null,
      recentChanges: null,
      searchesPerformed: 0,
      sources: [],
    };
  }

  const currentYear = new Date().getFullYear();
  const sources: string[] = [];
  const calculationLog: Array<{ label: string; result: number; interpretation: string }> = [];
  const evidenceScores: Array<{ evidence_type: string; description: string; strength_score: number; recommended_use: string }> = [];
  let searchCount = 0;
  const MAX_SEARCHES = 8; // Increased from 5 — deeper research produces stronger cases

  const systemPrompt = buildResearchSystemPrompt(context, currentYear);

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: buildResearchInitialMessage(context, currentYear),
    },
  ];

  try {
    // Tool-use loop: Claude searches, reads pages, then produces final output
    // eslint-disable-next-line no-constant-condition
    while (searchCount < MAX_SEARCHES) {
      const response = await withRetry(
        () => getClient().messages.create({
          model: AI_MODELS.RESEARCH,
          max_tokens: 2000,
          system: systemPrompt,
          tools: ALL_RESEARCH_TOOLS,
          messages,
        }),
        { maxAttempts: 3, baseDelayMs: 2000, retryOn: isRetryableError }
      );

      // Check if Claude wants to use tools
      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );

        // Add assistant message with all content
        messages.push({ role: 'assistant', content: response.content });

        // Process each tool call
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          const input = toolUse.input as Record<string, string | number>;

          if (toolUse.name === 'web_search' && searchCount < MAX_SEARCHES) {
            searchCount++;
            apiLogger.info({ searchCount, MAX_SEARCHES, query: input.query }, '[research-agent] Search /: ""');
            const searchResult = await executeWebSearch(input.query as string);

            if (searchResult.error) {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: `Search failed: ${searchResult.error}`,
              });
            } else {
              const formatted = searchResult.results
                .map((r, i) => `${i + 1}. [${r.title}](${r.link})\n   ${r.snippet}`)
                .join('\n\n');
              sources.push(...searchResult.results.map(r => r.link));
              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: formatted || 'No results found.',
              });
            }
          } else if (toolUse.name === 'read_page') {
            apiLogger.info({ url: input.url }, '[research-agent] Reading');
            const pageText = await fetchPageContent(input.url as string);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: pageText || 'Could not fetch page content.',
            });
          } else if (toolUse.name === 'calculate') {
            // Record the calculation for logging/context and confirm the result
            const calcInput = toolUse.input as { label: string; expression: string; result: number; interpretation: string };
            calculationLog.push({ label: calcInput.label, result: calcInput.result, interpretation: calcInput.interpretation });
            apiLogger.info({ label: calcInput.label, result: calcInput.result }, '[research-agent] Calculation recorded');
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: `Calculation recorded: ${calcInput.label} = ${calcInput.result}. ${calcInput.interpretation}`,
            });
          } else if (toolUse.name === 'score_evidence') {
            // Record evidence score for synthesis context
            const scoreInput = toolUse.input as { evidence_type: string; description: string; strength_score: number; strengths: string; weaknesses: string; recommended_use: string };
            evidenceScores.push({ evidence_type: scoreInput.evidence_type, description: scoreInput.description, strength_score: scoreInput.strength_score, recommended_use: scoreInput.recommended_use });
            apiLogger.info({ type: scoreInput.evidence_type, score: scoreInput.strength_score }, '[research-agent] Evidence scored');
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: `Evidence scored ${scoreInput.strength_score}/10. Strengths: ${scoreInput.strengths}. Weaknesses: ${scoreInput.weaknesses}. Recommendation: ${scoreInput.recommended_use}`,
            });
          } else {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: searchCount >= MAX_SEARCHES
                ? 'Search limit reached. Please provide your final analysis with the information gathered so far.'
                : 'Unknown tool.',
            });
          }
        }

        messages.push({ role: 'user', content: toolResults });
      } else {
        // Claude produced final text output — extract it
        const textBlocks = response.content.filter(
          (b): b is Anthropic.TextBlock => b.type === 'text'
        );
        const finalText = textBlocks.map(b => b.text).join('\n');

        // Run a thinking-enabled synthesis pass with the PRIMARY model.
        // The fast RESEARCH model (Haiku) gathered evidence efficiently.
        // Now PRIMARY + extended thinking synthesizes all findings into the
        // most strategically sound output — exactly the pattern from Anthropic's
        // "plan and execute" cookbook: one model to search, a smarter model to reason.
        const synthesized = await synthesizeWithThinking(finalText, context, calculationLog, evidenceScores, sources);
        synthesized.searchesPerformed = searchCount;
        synthesized.sources = Array.from(new Set(sources)).slice(0, 10);

        apiLogger.info(
          { county: context.countyName, state: context.stateName, searchCount, sourceCount: synthesized.sources.length },
          '[research-agent] Research complete'
        );

        return synthesized;
      }
    }

    // If we exhausted searches without a final response, ask for summary
    messages.push({
      role: 'user',
      content: 'Search limit reached. Please provide your final structured analysis with STRATEGY_INSIGHTS, DEADLINE_INFO, BOARD_INTELLIGENCE, and RECENT_CHANGES sections based on everything you found.',
    });

    const finalResponse = await withRetry(
      () => getClient().messages.create({
        model: AI_MODELS.RESEARCH,
        max_tokens: 2000,
        system: systemPrompt,
        messages,
      }),
      { maxAttempts: 3, baseDelayMs: 2000, retryOn: isRetryableError }
    );

    const finalText = finalResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    const result = await synthesizeWithThinking(finalText, context, calculationLog, evidenceScores, sources);
    result.searchesPerformed = searchCount;
    result.sources = Array.from(new Set(sources)).slice(0, 10);
    return result;

  } catch (err) {
    apiLogger.error({ err: err instanceof Error ? err.message : err }, '[research-agent] Research failed');
    return {
      strategyInsights: '',
      deadlineInfo: null,
      boardIntelligence: null,
      recentChanges: null,
      searchesPerformed: searchCount,
      sources: [],
    };
  }
}

// ─── Thinking-Enabled Synthesis ──────────────────────────────────────────────
//
// After the fast RESEARCH model (Haiku) has gathered evidence via web_search,
// read_page, calculate, and score_evidence tool calls, this function runs a
// final synthesis pass with the PRIMARY model + extended thinking.
//
// Pattern: "plan and execute" from Anthropic cookbook.
//   - RESEARCH model: fast, cheap, tool-calling loop to gather raw intelligence
//   - PRIMARY model + thinking: slow, expensive, deep reasoning to synthesize
//     the best possible strategic output from everything gathered
//
// Extended thinking enables Claude to weigh evidence quality scores, cross-
// reference calculations, and reason about board psychology before writing
// the final STRATEGY_INSIGHTS, DEADLINE_INFO, BOARD_INTELLIGENCE output.

let _primaryClient: Anthropic | null = null;
function getPrimaryClient(): Anthropic {
  if (!_primaryClient) {
    _primaryClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 180_000 });
  }
  return _primaryClient;
}

async function synthesizeWithThinking(
  rawResearchText: string,
  context: ResearchContext,
  calculations: Array<{ label: string; result: number; interpretation: string }>,
  evidenceScores: Array<{ evidence_type: string; description: string; strength_score: number; recommended_use: string }>,
  sources: string[]
): Promise<ResearchResult> {
  const AI_MODEL_PRIMARY_VAL = process.env.AI_MODEL_PRIMARY;
  if (!AI_MODEL_PRIMARY_VAL || !process.env.ANTHROPIC_API_KEY) {
    // Graceful fallback: parse the raw text without thinking
    return parseResearchOutput(rawResearchText);
  }

  const budgetTokens = AI_THINKING_BUDGETS_FOR_SYNTHESIS;

  const calculationsBlock = calculations.length > 0
    ? `\n\nCALCULATIONS PERFORMED:\n${calculations.map(c => `- ${c.label}: ${c.result} — ${c.interpretation}`).join('\n')}`
    : '';

  const evidenceBlock = evidenceScores.length > 0
    ? `\n\nEVIDENCE QUALITY SCORES:\n${evidenceScores.map(e => `- [${e.evidence_type}] Score ${e.strength_score}/10: "${e.description}" → ${e.recommended_use}`).join('\n')}`
    : '';

  const synthesisPrompt = `You are the senior partner on a property tax appeal case for a ${context.propertyType} property in ${context.countyName} County, ${context.stateName}. You have just reviewed all the research your associate gathered.

RAW RESEARCH GATHERED:
${rawResearchText}${calculationsBlock}${evidenceBlock}

Your task: Synthesize ALL of the above into the highest-quality strategic output possible. Think carefully about:
1. Which evidence is strongest and should lead the appeal argument
2. What deadlines are truly binding vs. advisory
3. What the Board of Review specifically responds to in this jurisdiction
4. Any ${new Date().getFullYear()} changes that create new leverage or risks
5. The single most powerful argument given this specific case context

Output your synthesis in these EXACT labeled sections:

STRATEGY_INSIGHTS: [Your recommended appeal strategy, ordered from most to least impactful argument. Be specific and actionable. Reference actual data points, calculation results, and evidence scores where relevant.]

DEADLINE_INFO: [Precise deadline information with dates where known. Note any 2026 changes.]

BOARD_INTELLIGENCE: [How this specific county's board operates, what they find persuasive, and any personality/procedural notes that affect hearing strategy.]

RECENT_CHANGES: [Any ${new Date().getFullYear()} procedural, legislative, or market changes that affect this appeal.]`;

  try {
    const thinkingParams: Anthropic.MessageCreateParamsNonStreaming = {
      model: AI_MODEL_PRIMARY_VAL,
      max_tokens: budgetTokens + 3000,
      thinking: { type: 'enabled', budget_tokens: budgetTokens },
      messages: [{ role: 'user', content: synthesisPrompt }],
    };

    let response: Anthropic.Message;
    try {
      response = await withRetry(
        () => getPrimaryClient().messages.create(thinkingParams),
        { maxAttempts: 2, baseDelayMs: 3000, retryOn: isRetryableError }
      );
    } catch (thinkingErr) {
      const msg = thinkingErr instanceof Error ? thinkingErr.message : String(thinkingErr);
      if (msg.toLowerCase().includes('thinking') || msg.toLowerCase().includes('not supported')) {
        // Fall back to standard call without thinking
        response = await withRetry(
          () => getPrimaryClient().messages.create({
            model: AI_MODEL_PRIMARY_VAL,
            max_tokens: 3000,
            messages: [{ role: 'user', content: synthesisPrompt }],
          }),
          { maxAttempts: 3, baseDelayMs: 2000, retryOn: isRetryableError }
        );
      } else {
        throw thinkingErr;
      }
    }

    const synthesizedText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    apiLogger.info(
      { thinkingBlocks: response.content.filter(b => b.type === 'thinking').length },
      '[research-agent] Thinking-enabled synthesis complete'
    );

    return parseResearchOutput(synthesizedText);
  } catch (err) {
    apiLogger.warn(
      { err: err instanceof Error ? err.message : err },
      '[research-agent] Synthesis with thinking failed — falling back to raw parse'
    );
    return parseResearchOutput(rawResearchText);
  }
}

const AI_THINKING_BUDGETS_FOR_SYNTHESIS = AI_THINKING_BUDGETS.RESEARCH_SYNTHESIS;

// ─── Output Parser ──────────────────────────────────────────────────────────

function parseResearchOutput(text: string): ResearchResult {
  const extractSection = (label: string): string | null => {
    const regex = new RegExp(`${label}[:\\s]*([\\s\\S]*?)(?=(?:STRATEGY_INSIGHTS|DEADLINE_INFO|BOARD_INTELLIGENCE|RECENT_CHANGES|$))`, 'i');
    const match = text.match(regex);
    const value = match?.[1]?.trim();
    return value && value.length > 10 ? value : null;
  };

  // Validate extracted content — detect low-quality or hallucinated output
  const validateSection = (content: string | null, label: string): string | null => {
    if (!content) return null;
    // Flag if the AI just repeated the section label with no substance
    if (content.length < 30) {
      apiLogger.warn({ label, length: content.length }, '[research-agent] section too short ( chars) — discarding');
      return null;
    }
    // Detect boilerplate non-answers
    const boilerplate = /i (?:could not|couldn't|was unable to|did not|didn't) find/i;
    if (boilerplate.test(content) && content.length < 100) {
      apiLogger.warn({ label }, '[research-agent] section is a non-answer — discarding');
      return null;
    }
    // Cap at reasonable length to prevent prompt bloat
    return content.slice(0, 3000);
  };

  const strategyRaw = extractSection('STRATEGY_INSIGHTS') ?? text.slice(0, 2000);
  const deadlineRaw = extractSection('DEADLINE_INFO');
  const boardRaw = extractSection('BOARD_INTELLIGENCE');
  const changesRaw = extractSection('RECENT_CHANGES');

  return {
    strategyInsights: validateSection(strategyRaw, 'STRATEGY_INSIGHTS') ?? strategyRaw.slice(0, 2000),
    deadlineInfo: validateSection(deadlineRaw, 'DEADLINE_INFO'),
    boardIntelligence: validateSection(boardRaw, 'BOARD_INTELLIGENCE'),
    recentChanges: validateSection(changesRaw, 'RECENT_CHANGES'),
    searchesPerformed: 0,
    sources: [],
  };
}
