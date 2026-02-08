#!/usr/bin/env npx tsx
/**
 * CLI test for auth redirect configuration
 * Verifies that sign-up and sign-in pages have correct redirect props
 * and no deprecated Clerk props are being used.
 */

const BASE_URL = process.env.BLITZCLAW_URL || 'https://www.blitzclaw.com';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

async function testPage(path: string, expectedRedirect: string): Promise<void> {
  const url = `${BASE_URL}${path}`;
  console.log(`\n🔍 Testing ${url}...`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      results.push({
        name: `${path} loads`,
        passed: false,
        details: `HTTP ${response.status}`
      });
      return;
    }
    
    results.push({
      name: `${path} loads`,
      passed: true,
      details: `HTTP ${response.status}`
    });
    
    const html = await response.text();
    
    // Check for forceRedirectUrl prop with correct value
    // Note: JSON in script tags may be escaped (\" instead of ")
    const forceRedirectMatch = html.match(/forceRedirectUrl\\?":\\?"([^"\\]+)/);
    if (forceRedirectMatch) {
      const actualRedirect = forceRedirectMatch[1];
      const passed = actualRedirect === expectedRedirect;
      results.push({
        name: `${path} forceRedirectUrl`,
        passed,
        details: passed 
          ? `✓ "${actualRedirect}"`
          : `Expected "${expectedRedirect}", got "${actualRedirect}"`
      });
    } else {
      results.push({
        name: `${path} forceRedirectUrl`,
        passed: false,
        details: 'forceRedirectUrl prop not found in page'
      });
    }
    
    // Check for deprecated afterSignInUrl/afterSignUpUrl with values
    // Match both escaped and unescaped JSON
    const deprecatedUrlMatch = html.match(/after(?:SignIn|SignUp)Url\\?":\\?"([^"\\]*)/g);
    const hasDeprecatedWithValues = deprecatedUrlMatch?.some(m => {
      // Check if the value part (after the colon) is non-empty
      const valueMatch = m.match(/:\\?"([^"\\]*)/);
      return valueMatch && valueMatch[1] !== '';
    });
    
    results.push({
      name: `${path} no deprecated props`,
      passed: !hasDeprecatedWithValues,
      details: hasDeprecatedWithValues 
        ? `Found deprecated props with values: ${deprecatedUrlMatch?.join(', ')}`
        : 'No deprecated afterSignInUrl/afterSignUpUrl with values'
    });
    
    // Check ClerkProvider for deprecated env vars being passed
    const clerkProviderMatch = html.match(/afterSignInUrl\\?":\\?"([^"\\]*)\\?",\\?"afterSignUpUrl\\?":\\?"([^"\\]*)/);
    if (clerkProviderMatch) {
      const [, signIn, signUp] = clerkProviderMatch;
      const envVarsEmpty = signIn === '' && signUp === '';
      results.push({
        name: `${path} ClerkProvider env vars`,
        passed: envVarsEmpty,
        details: envVarsEmpty
          ? 'afterSignInUrl and afterSignUpUrl are empty (good)'
          : `Values found: afterSignInUrl="${signIn}", afterSignUpUrl="${signUp}"`
      });
    }
    
  } catch (error) {
    results.push({
      name: `${path} loads`,
      passed: false,
      details: `Error: ${error}`
    });
  }
}

async function main() {
  console.log('🧪 BlitzClaw Auth Redirect Test');
  console.log(`📍 Testing: ${BASE_URL}`);
  console.log('='.repeat(50));
  
  // Test sign-up page
  await testPage('/sign-up', '/onboarding');
  
  // Test sign-in page
  await testPage('/sign-in', '/dashboard');
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Results:\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    if (result.passed) passed++;
    else failed++;
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`Total: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
  
  console.log('\n✅ All auth redirect tests passed!');
}

main().catch(console.error);
