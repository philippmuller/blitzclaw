/**
 * BlitzClaw - Pricing & Token Measurement Tests
 * 
 * Tests:
 * - Token cost calculations
 * - Markup calculations
 * - Balance deduction logic
 * - Edge cases (large requests, small balances)
 * 
 * Run: npx tsx scripts/test-pricing.ts
 */

// Pricing constants (should match apps/web/src/lib/pricing.ts)
const PRICING = {
  'claude-sonnet-4': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3-5-haiku-20241022': { inputPer1M: 0.25, outputPer1M: 1.25 },
  'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },
};

const MARKUP = 1.5; // 50% markup
const MIN_BALANCE_CENTS = 1000; // $10

// Calculate cost in cents
function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) {
    throw new Error(`Unknown model: ${model}`);
  }
  
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M * MARKUP;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M * MARKUP;
  const totalDollars = inputCost + outputCost;
  
  return Math.ceil(totalDollars * 100); // Convert to cents, round up
}

// Test cases
const tests = [
  {
    name: 'Simple Sonnet request',
    model: 'claude-sonnet-4',
    inputTokens: 1000,
    outputTokens: 500,
    expectedCentsApprox: 2, // ~$0.02
  },
  {
    name: 'Large Sonnet request (100k context)',
    model: 'claude-sonnet-4',
    inputTokens: 100_000,
    outputTokens: 4000,
    expectedCentsApprox: 54, // ~$0.54
  },
  {
    name: 'Haiku request (cheap)',
    model: 'claude-3-haiku-20240307',
    inputTokens: 5000,
    outputTokens: 1000,
    expectedCentsApprox: 1, // ~$0.01
  },
  {
    name: 'Max context Sonnet (200k in, 8k out)',
    model: 'claude-sonnet-4',
    inputTokens: 200_000,
    outputTokens: 8000,
    expectedCentsApprox: 108, // ~$1.08
  },
];

console.log('==========================================');
console.log('BlitzClaw Pricing Tests');
console.log('==========================================\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  const cost = calculateCost(test.model, test.inputTokens, test.outputTokens);
  const costDollars = cost / 100;
  
  // Allow 20% variance for "approximate" expectations
  const minExpected = test.expectedCentsApprox * 0.8;
  const maxExpected = test.expectedCentsApprox * 1.2;
  const isPass = cost >= minExpected && cost <= maxExpected;
  
  if (isPass) {
    console.log(`✅ ${test.name}`);
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    console.log(`   Expected: ~${test.expectedCentsApprox}¢, Got: ${cost}¢`);
    failed++;
  }
  console.log(`   ${test.inputTokens.toLocaleString()} in + ${test.outputTokens.toLocaleString()} out = $${costDollars.toFixed(4)}`);
  console.log('');
}

// Test balance enforcement
console.log('------------------------------------------');
console.log('Balance Enforcement Tests');
console.log('------------------------------------------\n');

function canProcessRequest(balanceCents: number, estimatedCostCents: number): boolean {
  return balanceCents >= MIN_BALANCE_CENTS;
}

function processRequest(balanceCents: number, actualCostCents: number): { newBalance: number; paused: boolean } {
  const newBalance = balanceCents - actualCostCents;
  const paused = newBalance < MIN_BALANCE_CENTS;
  return { newBalance, paused };
}

const balanceTests = [
  { balance: 5000, cost: 10, shouldProcess: true, shouldPause: false, name: '$50 balance, small request' },
  { balance: 1010, cost: 10, shouldProcess: true, shouldPause: false, name: '$10.10 balance, small request → stays above min' },
  { balance: 1000, cost: 10, shouldProcess: true, shouldPause: true, name: '$10 balance (exact min), small request → pause after' },
  { balance: 999, cost: 10, shouldProcess: false, shouldPause: true, name: 'Below minimum, reject' },
  { balance: 1050, cost: 100, shouldProcess: true, shouldPause: true, name: '$10.50 balance, $1 request → pause after' },
];

for (const test of balanceTests) {
  const canProcess = canProcessRequest(test.balance, test.cost);
  const result = processRequest(test.balance, test.cost);
  
  const processMatch = canProcess === test.shouldProcess;
  const pauseMatch = result.paused === test.shouldPause;
  
  if (processMatch && pauseMatch) {
    console.log(`✅ ${test.name}`);
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    console.log(`   Process: expected ${test.shouldProcess}, got ${canProcess}`);
    console.log(`   Pause: expected ${test.shouldPause}, got ${result.paused}`);
    failed++;
  }
  console.log(`   Balance: $${(test.balance/100).toFixed(2)} → $${(result.newBalance/100).toFixed(2)}`);
  console.log('');
}

// Summary
console.log('==========================================');
if (failed === 0) {
  console.log(`✅ ALL TESTS PASSED (${passed}/${passed + failed})`);
} else {
  console.log(`❌ SOME TESTS FAILED (${passed}/${passed + failed} passed)`);
  process.exit(1);
}
console.log('==========================================');
