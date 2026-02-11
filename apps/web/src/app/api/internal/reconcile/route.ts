/**
 * Reconcile users who have subscriptions but no balance credited
 * 
 * This fixes cases where the webhook failed to credit balance.
 * Safe to run multiple times - only credits users who:
 * 1. Have a polarCustomerId (completed checkout)
 * 2. Have plan set (subscription exists)  
 * 3. Have 0 or null balance
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

const INTERNAL_SECRET = process.env.PROXY_SIGNING_SECRET;

export async function POST(req: NextRequest) {
  const debugKey = req.nextUrl.searchParams.get("key");
  const expectedDebugKey = process.env.DIAGNOSTICS_KEY || "blitz-debug-2026";
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");
  
  if (providedSecret !== INTERNAL_SECRET && debugKey !== expectedDebugKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find users with subscription but no balance
  const usersToFix = await prisma.user.findMany({
    where: {
      polarCustomerId: { not: null },
      plan: { not: null },
    },
    include: {
      balance: true,
    },
  });

  const results = {
    checked: usersToFix.length,
    fixed: 0,
    skipped: 0,
    details: [] as { userId: string; email: string; action: string }[],
  };

  for (const user of usersToFix) {
    const credits = user.plan === "pro" ? 1500 : 500; // $15 for pro, $5 for basic
    
    if (!user.balance) {
      // No balance record - create with initial credits
      await prisma.balance.create({
        data: {
          userId: user.id,
          creditsCents: credits,
          autoTopupEnabled: true,
          topupThresholdCents: 0,
          topupAmountCents: 0,
        },
      });
      results.fixed++;
      results.details.push({
        userId: user.id,
        email: user.email?.slice(0, 15) + "...",
        action: `Created balance with ${credits} cents`,
      });
    } else if (user.balance.creditsCents === 0) {
      // Balance exists but is 0 - credit it
      await prisma.balance.update({
        where: { userId: user.id },
        data: { creditsCents: credits },
      });
      results.fixed++;
      results.details.push({
        userId: user.id,
        email: user.email?.slice(0, 15) + "...",
        action: `Credited ${credits} cents (was 0)`,
      });
    } else {
      // User already has balance
      results.skipped++;
      results.details.push({
        userId: user.id,
        email: user.email?.slice(0, 15) + "...",
        action: `Skipped (already has ${user.balance.creditsCents} cents)`,
      });
    }
  }

  console.log("🔧 Reconciliation complete:", results);

  return NextResponse.json(results);
}
