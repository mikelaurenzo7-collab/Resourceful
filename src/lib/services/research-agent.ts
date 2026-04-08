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
import { AI_MODELS } from '@/config/ai';

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
  description: 'Search the web for current information. Returns titles, URLs, and snippets for the top 5 results. Use this to research county-specific appeal procedures, deadlines, strategies, and recent changes.',
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
  description: 'Fetch and read the text content of a web page. Use this to get detailed information from a specific URL found in search results.',
  input_schema: {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch and read.',
      },
    },
    required: ['url'],
  },
};

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
    console.log('[research-agent] SERPER_API_KEY not set, skipping research');
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
  let searchCount = 0;
  const MAX_SEARCHES = 5;

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
      const response = await getClient().messages.create({
        model: AI_MODELS.FAST,
        max_tokens: 2000,
        system: systemPrompt,
        tools: [SEARCH_TOOL, READ_PAGE_TOOL],
        messages,
      });

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
          const input = toolUse.input as Record<string, string>;

          if (toolUse.name === 'web_search' && searchCount < MAX_SEARCHES) {
            searchCount++;
            console.log(`[research-agent] Search ${searchCount}/${MAX_SEARCHES}: "${input.query}"`);
            const searchResult = await executeWebSearch(input.query);

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
            console.log(`[research-agent] Reading: ${input.url}`);
            const pageText = await fetchPageContent(input.url);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: pageText || 'Could not fetch page content.',
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

        // Parse structured sections from the response
        const result = parseResearchOutput(finalText);
        result.searchesPerformed = searchCount;
        result.sources = Array.from(new Set(sources)).slice(0, 10);

        console.log(
          `[research-agent] Research complete for ${context.countyName}, ${context.stateName}: ` +
          `${searchCount} searches, ${result.sources.length} sources`
        );

        return result;
      }
    }

    // If we exhausted searches without a final response, ask for summary
    messages.push({
      role: 'user',
      content: 'Search limit reached. Please provide your final structured analysis with STRATEGY_INSIGHTS, DEADLINE_INFO, BOARD_INTELLIGENCE, and RECENT_CHANGES sections based on everything you found.',
    });

    const finalResponse = await getClient().messages.create({
      model: AI_MODELS.FAST,
      max_tokens: 2000,
      system: systemPrompt,
      messages,
    });

    const finalText = finalResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    const result = parseResearchOutput(finalText);
    result.searchesPerformed = searchCount;
    result.sources = Array.from(new Set(sources)).slice(0, 10);
    return result;

  } catch (err) {
    console.error(`[research-agent] Research failed: ${err instanceof Error ? err.message : err}`);
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

// ─── Output Parser ──────────────────────────────────────────────────────────

function parseResearchOutput(text: string): ResearchResult {
  const extractSection = (label: string): string | null => {
    const regex = new RegExp(`${label}[:\\s]*([\\s\\S]*?)(?=(?:STRATEGY_INSIGHTS|DEADLINE_INFO|BOARD_INTELLIGENCE|RECENT_CHANGES|$))`, 'i');
    const match = text.match(regex);
    const value = match?.[1]?.trim();
    return value && value.length > 10 ? value : null;
  };

  return {
    strategyInsights: extractSection('STRATEGY_INSIGHTS') ?? text.slice(0, 2000),
    deadlineInfo: extractSection('DEADLINE_INFO'),
    boardIntelligence: extractSection('BOARD_INTELLIGENCE'),
    recentChanges: extractSection('RECENT_CHANGES'),
    searchesPerformed: 0,
    sources: [],
  };
}
