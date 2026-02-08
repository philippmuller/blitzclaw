#!/usr/bin/env npx tsx
/**
 * Test Creem API configuration
 * Verifies API key and product IDs are valid
 */

import 'dotenv/config';

const CREEM_API_KEY = process.env.CREEM_API_KEY;
const CREEM_API_URL = process.env.CREEM_API_URL || 
  (CREEM_API_KEY?.includes('test') 
    ? "https://test-api.creem.io/v1" 
    : "https://api.creem.io/v1");
const CREEM_SUBSCRIPTION_PRODUCT_ID = process.env.CREEM_SUBSCRIPTION_PRODUCT_ID;
const CREEM_TOPUP_PRODUCT_ID = process.env.CREEM_TOPUP_PRODUCT_ID;

async function testCreem() {
  console.log('🧪 Creem Configuration Test');
  console.log('='.repeat(50));
  
  console.log('\n📋 Configuration:');
  console.log(`  API URL: ${CREEM_API_URL}`);
  console.log(`  API Key: ${CREEM_API_KEY ? CREEM_API_KEY.substring(0, 15) + '...' : '❌ NOT SET'}`);
  console.log(`  Subscription Product: ${CREEM_SUBSCRIPTION_PRODUCT_ID || '❌ NOT SET'}`);
  console.log(`  Topup Product: ${CREEM_TOPUP_PRODUCT_ID || '❌ NOT SET'}`);
  
  if (!CREEM_API_KEY) {
    console.log('\n❌ CREEM_API_KEY not set. Cannot test.');
    process.exit(1);
  }
  
  const isTestMode = CREEM_API_URL?.includes('test-api');
  console.log(`  Mode: ${isTestMode ? '🧪 TEST' : '🚀 PRODUCTION'}`);
  
  if (isTestMode && CREEM_SUBSCRIPTION_PRODUCT_ID) {
    console.log('\n⚠️  WARNING: Using TEST API but product IDs might be from PRODUCTION.');
    console.log('   Products must be created in the same environment as the API key.');
  }
  
  // Test subscription product
  if (CREEM_SUBSCRIPTION_PRODUCT_ID) {
    console.log('\n🎫 Testing Subscription Product...');
    try {
      const response = await fetch(`${CREEM_API_URL}/products/${CREEM_SUBSCRIPTION_PRODUCT_ID}`, {
        headers: { 'x-api-key': CREEM_API_KEY },
      });
      
      if (response.ok) {
        const product = await response.json();
        console.log(`  ✅ Found: ${product.name} - ${product.price} ${product.currency}`);
      } else {
        const error = await response.text();
        console.log(`  ❌ Product not found: ${response.status} - ${error}`);
        console.log('  💡 Did you create this product in the TEST dashboard?');
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error}`);
    }
  }
  
  // Test topup product
  if (CREEM_TOPUP_PRODUCT_ID) {
    console.log('\n💰 Testing Topup Product...');
    try {
      const response = await fetch(`${CREEM_API_URL}/products/${CREEM_TOPUP_PRODUCT_ID}`, {
        headers: { 'x-api-key': CREEM_API_KEY },
      });
      
      if (response.ok) {
        const product = await response.json();
        console.log(`  ✅ Found: ${product.name} - ${product.price} ${product.currency}`);
      } else {
        const error = await response.text();
        console.log(`  ❌ Product not found: ${response.status} - ${error}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
}

testCreem().catch(console.error);
