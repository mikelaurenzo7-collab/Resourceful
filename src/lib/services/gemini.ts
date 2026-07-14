// ─── Legacy Vision Contract ───────────────────────────────────────────────────
// Historical filename retained for stable imports. Gemini is no longer used by
// Resourceful; GPT-5.6 Sol handles document and multi-image analysis.

export type {
  DeferredMaintenanceAnalysis,
  ExtractedTaxBill,
} from '@/lib/services/openai-appraiser';

export {
  analyzeDeferredMaintenance,
  parseTaxBill,
} from '@/lib/services/openai-appraiser';
