import { GoogleGenAI } from '@google/genai';
import { AI_MODELS } from '@/config/ai';
import { apiLogger } from '@/lib/logger';
import { withRetry, isRetryableError } from '@/lib/utils/retry';

/**
 * Gemini AI Service for Multimodal Processing
 * Handles complex document OCR (Tax Bills) and Spatial/Vision Reasoning (Deferred Maintenance)
 */

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set. Multimodal features will not work.');
    }
    _client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return _client;
}

export interface ExtractedTaxBill {
  parcelId: string | null;
  assessedValue: number | null;
  marketValue: number | null;
  taxYear: string | null;
  jurisdiction: string | null;
  confidence: number; // 0-100
}

export interface DeferredMaintenanceAnalysis {
  severity: 'none' | 'minor' | 'moderate' | 'severe';
  appraiserDescription: string;
  estimatedCostToCure: number | null;
  primaryDefectType: string | null;
  justification: string;
}

/**
 * Extract structured text from an incredibly dense and unstandardized 
 * county property tax bill or assessment notice.
 * 
 * @param mimeType e.g., 'application/pdf' or 'image/jpeg'
 * @param base64Data Raw file payload
 */
export async function parseTaxBill(mimeType: string, base64Data: string): Promise<ExtractedTaxBill | null> {
  const prompt = `
    You are an expert real estate paralegal and property tax data extractor.
    Analyze the attached tax bill or assessment notice.
    Extract the following information exactly.
    Respond ONLY with a JSON object in the following format:
    {
      "parcelId": "string (the APN, PIN, or Property ID)",
      "assessedValue": number (the final assessed value, remove commas),
      "marketValue": number (if shown, the fair market or appraised value, remove commas),
      "taxYear": "string (e.g. '2024')",
      "jurisdiction": "string (County or Township name)",
      "confidence": number (0-100 based on document clarity and confidence)
    }
    If a field is completely unreadable or missing, explicitly return null for that field. Do NOT guess.
  `;

  try {
    const response = await withRetry(
      () => getClient().models.generateContent({
        model: AI_MODELS.DOCUMENT,
        contents: [
          prompt,
          { inlineData: { data: base64Data, mimeType } }
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1, // Near-deterministic extraction
        }
      }),
      { maxAttempts: 3, baseDelayMs: 1500, retryOn: isRetryableError }
    );

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text) as ExtractedTaxBill;
    return data;
  } catch (error) {
    apiLogger.error({ err: error instanceof Error ? error.message : error }, 'Gemini Tax Bill OCR failed');
    return null;
  }
}

/**
 * Visually reason about user-provided photos to extract professional
 * "Condition & Defect" ledgers for the valuation pipeline.
 * 
 * @param photos Array of base64 images
 * @param userCaption The homeowner's raw/unprofessional description of the problem
 */
export async function analyzeDeferredMaintenance(
  base64Images: { data: string; mimeType: string }[],
  userCaption: string,
  propertyType: string = 'residential'
): Promise<DeferredMaintenanceAnalysis | null> {
  const personas: Record<string, string> = {
    residential: 'residential real estate appraiser and residential assessor',
    commercial: 'commercial property appraiser and MAI-certified analyst',
    industrial: 'industrial facility appraiser specializing in clear heights and logistics',
    land: 'vacant land appraiser and zoning specialist',
    agricultural: 'agricultural appraiser specializing in soil productivity and farm acreage'
  };
  const activePersona = personas[propertyType.toLowerCase()] || personas.residential;

  const prompt = `
    You are a ${activePersona} serving as a Board of Review hearing officer.
    Focus exclusively on defects and depreciation factors relevant to a ${propertyType.toUpperCase()} property type.
    Analyze the provided photos of a property. The homeowner noted: "${userCaption.replace(/"/g, "'").replace(/\n/g, ' ')}".

    A property tax appeal requires concrete, professional evidence. We need to translate the visual data 
    into formal "deferred maintenance" language. 
    
    1. Identify the true severity.
    2. Write a professional 'appraiserDescription' to be printed directly into a legal valuation report.
       (e.g., "Subject property exhibits severe exterior deferred maintenance, characterized by significant concrete spalling on the western foundation...").
    3. Generate a logical 'estimatedCostToCure' if applicable to correct the defect, based on typical contractor pricing for this type of repair.
    4. Categorize the 'primaryDefectType' (e.g., Foundation, Roof, Water Intrusion, Cosmetic Updating).

    Return ONLY a JSON object:
    {
      "severity": "none" | "minor" | "moderate" | "severe",
      "appraiserDescription": "string",
      "estimatedCostToCure": number | null,
      "primaryDefectType": "string | null",
      "justification": "why you arrived at this classification from the pixels"
    }
  `;

  try {
    const contents: (string | Record<string, unknown>)[] = [prompt];
    for (const img of base64Images) {
      contents.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
    }

    const response = await withRetry(
      () => getClient().models.generateContent({
        model: AI_MODELS.VISION,
        contents,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.4, // Slight creative interpretation for the narrative portion
        }
      }),
      { maxAttempts: 3, baseDelayMs: 2000, retryOn: isRetryableError }
    );

    const text = response.text;
    if (!text) return null;

    return JSON.parse(text) as DeferredMaintenanceAnalysis;
  } catch (error) {
    apiLogger.error({ err: error instanceof Error ? error.message : error }, 'Gemini Deferred Maintenance analysis failed');
    return null;
  }
}
