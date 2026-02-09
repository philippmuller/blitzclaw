/**
 * Token pricing with markup for BlitzClaw
 * 
 * We apply a ~50% markup on actual API costs to cover infrastructure and margin.
 */

export interface ModelPricing {
  model: string;
  inputPer1M: number;   // Cost per 1M input tokens in cents
  outputPer1M: number;  // Cost per 1M output tokens in cents
}

// Base API costs (what we pay) - updated Feb 2026
const BASE_COSTS: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  // Latest Anthropic models (Feb 2026)
  "claude-opus-4-6": { inputPer1M: 500, outputPer1M: 2500 },       // $5/$25
  "claude-sonnet-4-5": { inputPer1M: 300, outputPer1M: 1500 },     // $3/$15
  "claude-haiku-4-5": { inputPer1M: 100, outputPer1M: 500 },       // $1/$5
  
  // Legacy model IDs (keep for backwards compat)
  "claude-opus-4-20250514": { inputPer1M: 500, outputPer1M: 2500 },
  "claude-sonnet-4-20250514": { inputPer1M: 300, outputPer1M: 1500 },
  "claude-3-5-haiku-20241022": { inputPer1M: 80, outputPer1M: 400 },
};

// Our markup (100%)
const MARKUP_MULTIPLIER = 2.0;

/**
 * Get our pricing (with markup) for a model
 */
export function getModelPricing(model: string): ModelPricing | null {
  // Normalize model name
  const normalizedModel = normalizeModelName(model);
  
  const baseCost = BASE_COSTS[normalizedModel];
  if (!baseCost) {
    return null;
  }
  
  return {
    model: normalizedModel,
    inputPer1M: Math.ceil(baseCost.inputPer1M * MARKUP_MULTIPLIER),
    outputPer1M: Math.ceil(baseCost.outputPer1M * MARKUP_MULTIPLIER),
  };
}

/**
 * Normalize model name to match our pricing table
 */
function normalizeModelName(model: string): string {
  // Remove "anthropic/" prefix if present
  if (model.startsWith("anthropic/")) {
    model = model.slice(10);
  }
  return model.toLowerCase();
}

/**
 * Calculate cost for a request in cents
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): { costCents: number; pricing: ModelPricing } | null {
  const pricing = getModelPricing(model);
  if (!pricing) {
    return null;
  }
  
  // Calculate cost: (tokens / 1_000_000) * pricePerMillion
  // Using integer math to avoid floating point issues
  const inputCost = Math.ceil((inputTokens * pricing.inputPer1M) / 1_000_000);
  const outputCost = Math.ceil((outputTokens * pricing.outputPer1M) / 1_000_000);
  
  return {
    costCents: inputCost + outputCost,
    pricing,
  };
}

/**
 * Get all supported models with their pricing
 */
export function getSupportedModels(): ModelPricing[] {
  const uniqueModels = new Set<string>();
  const result: ModelPricing[] = [];
  
  for (const model of Object.keys(BASE_COSTS)) {
    // Skip aliases
    if (model.includes("-202")) {
      const pricing = getModelPricing(model);
      if (pricing && !uniqueModels.has(pricing.model)) {
        uniqueModels.add(pricing.model);
        result.push(pricing);
      }
    }
  }
  
  return result;
}

/**
 * Minimum balance required to make API calls (in cents)
 */
export const MINIMUM_BALANCE_CENTS = 1000; // $10

/**
 * Maximum daily spend per account (in cents)
 * Safety limit to prevent runaway costs
 */
export const DAILY_LIMIT_CENTS = 20000; // $200/day

/**
 * Default model for new instances
 */
export const DEFAULT_MODEL = "claude-opus-4-6";
