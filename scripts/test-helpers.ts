#!/usr/bin/env npx tsx
/**
 * Test helpers for BlitzClaw E2E tests
 * Provides Clerk authentication utilities for testing protected API routes
 */

import "dotenv/config";
import { createClerkClient } from "@clerk/backend";

// Initialize Clerk client
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Test user configuration
const TEST_USER_EMAIL = "test@blitzclaw.test";
const TEST_USER_EXTERNAL_ID = "blitzclaw_test_user";

// Cache for session token (valid for ~60 seconds)
let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedUserId: string | null = null;
let cachedSessionId: string | null = null;

/**
 * Get or create the test user in Clerk
 */
export async function getOrCreateTestUser(): Promise<string> {
  if (cachedUserId) {
    return cachedUserId;
  }

  // First, try to find existing test user
  const existingUsers = await clerk.users.getUserList({
    emailAddress: [TEST_USER_EMAIL],
    limit: 1,
  });

  if (existingUsers.data.length > 0) {
    cachedUserId = existingUsers.data[0].id;
    console.log(`  📋 Found existing test user: ${cachedUserId}`);
    return cachedUserId;
  }

  // Create new test user
  const user = await clerk.users.createUser({
    emailAddress: [TEST_USER_EMAIL],
    externalId: TEST_USER_EXTERNAL_ID,
    firstName: "Test",
    lastName: "User",
    skipPasswordRequirement: true,
  });

  cachedUserId = user.id;
  console.log(`  ✨ Created new test user: ${cachedUserId}`);
  return cachedUserId;
}

/**
 * Create a session for the test user
 */
async function createTestSession(): Promise<string> {
  const userId = await getOrCreateTestUser();

  // Create a new session
  const session = await clerk.sessions.createSession({
    userId,
  });

  cachedSessionId = session.id;
  console.log(`  🔓 Created session: ${cachedSessionId}`);
  return session.id;
}

/**
 * Get a valid session token for API requests
 * Handles token caching and refresh
 */
export async function getTestUserToken(): Promise<string> {
  // Check if we have a valid cached token (with 10s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 10000) {
    return cachedToken.token;
  }

  // Create session if needed
  if (!cachedSessionId) {
    await createTestSession();
  }

  // Get a fresh token
  try {
    const tokenResponse = await clerk.sessions.getToken(cachedSessionId!, undefined, 60);
    const token = tokenResponse.jwt;

    // Cache the token
    cachedToken = {
      token,
      expiresAt: Date.now() + 60000, // 60 seconds
    };

    console.log(`  🎫 Got session token (expires in 60s)`);
    return token;
  } catch (error: unknown) {
    // Session might have expired, create a new one
    console.log(`  ⚠️  Session expired, creating new one...`);
    cachedSessionId = null;
    await createTestSession();

    const tokenResponse = await clerk.sessions.getToken(cachedSessionId!, undefined, 60);
    const token = tokenResponse.jwt;

    cachedToken = {
      token,
      expiresAt: Date.now() + 60000,
    };

    return token;
  }
}

/**
 * Make an authenticated fetch request
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getTestUserToken();

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Get the test user's Clerk ID (for database operations)
 */
export async function getTestUserClerkId(): Promise<string> {
  return await getOrCreateTestUser();
}

/**
 * Clean up test session (call at end of tests)
 */
export async function cleanupTestSession(): Promise<void> {
  if (cachedSessionId) {
    try {
      await clerk.sessions.revokeSession(cachedSessionId);
      console.log(`  🧹 Revoked test session`);
    } catch {
      // Session might already be expired
    }
  }
  cachedToken = null;
  cachedSessionId = null;
}

/**
 * Delete test user (use sparingly - for full cleanup)
 */
export async function deleteTestUser(): Promise<void> {
  if (cachedUserId) {
    try {
      await clerk.users.deleteUser(cachedUserId);
      console.log(`  🗑️  Deleted test user`);
    } catch {
      // User might not exist
    }
  }
  cachedUserId = null;
  cachedToken = null;
  cachedSessionId = null;
}

// Self-test when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  async function selfTest() {
    console.log("🧪 Testing Clerk authentication helpers\n");

    console.log("1️⃣ Getting/creating test user...");
    const userId = await getOrCreateTestUser();
    console.log(`   User ID: ${userId}\n`);

    console.log("2️⃣ Getting session token...");
    const token = await getTestUserToken();
    console.log(`   Token: ${token.substring(0, 50)}...\n`);

    console.log("3️⃣ Making authenticated request...");
    const BASE_URL = process.env.BLITZCLAW_URL || "http://localhost:3000";
    const response = await authenticatedFetch(`${BASE_URL}/api/auth/me`);
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);
    } else {
      const text = await response.text();
      console.log(`   Error: ${text}\n`);
    }

    console.log("4️⃣ Cleaning up...");
    await cleanupTestSession();

    console.log("\n✅ Self-test complete!");
  }

  selfTest().catch(console.error);
}
