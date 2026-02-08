#!/usr/bin/env npx tsx
/**
 * Test the subscribe endpoint directly
 * Usage: CLERK_USER_ID=user_xxx npx tsx scripts/test-subscribe.ts
 */

import 'dotenv/config';

const BASE_URL = process.env.BLITZCLAW_URL || 'https://www.blitzclaw.com';

async function testSubscribe() {
  console.log('🧪 Testing Subscribe Endpoint');
  console.log(`📍 URL: ${BASE_URL}/api/billing/subscribe`);
  console.log('');
  
  // First, let's test without auth to see if we get 401
  console.log('1️⃣ Testing without auth (should get 401)...');
  const noAuthResp = await fetch(`${BASE_URL}/api/billing/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autoTopup: true }),
  });
  console.log(`   Status: ${noAuthResp.status}`);
  const noAuthBody = await noAuthResp.text();
  console.log(`   Body: ${noAuthBody}`);
  
  if (noAuthResp.status !== 401) {
    console.log('   ⚠️  Expected 401, got different status');
  } else {
    console.log('   ✅ Got expected 401');
  }
  
  // Test with a fake session to see what error we get
  console.log('\n2️⃣ Testing with fake session cookie...');
  const fakeAuthResp = await fetch(`${BASE_URL}/api/billing/subscribe`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Cookie': '__session=fake_session_token',
    },
    body: JSON.stringify({ autoTopup: true }),
  });
  console.log(`   Status: ${fakeAuthResp.status}`);
  const fakeAuthBody = await fakeAuthResp.text();
  console.log(`   Body: ${fakeAuthBody}`);
  
  // Check if Creem env vars are likely set by testing the pattern of error
  console.log('\n3️⃣ Analyzing error...');
  if (fakeAuthBody.includes('Billing not configured')) {
    console.log('   ❌ CREEM_API_KEY or CREEM_SUBSCRIPTION_PRODUCT_ID not set');
  } else if (fakeAuthBody.includes('Unauthorized')) {
    console.log('   ✅ Auth working (rejected unauthorized)');
  } else if (fakeAuthBody.includes('Failed to create checkout')) {
    console.log('   ❌ Creem API call failed - check API key and product ID');
  } else {
    console.log('   ℹ️  Other error');
  }
}

testSubscribe().catch(console.error);
