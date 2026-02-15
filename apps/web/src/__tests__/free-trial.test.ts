/**
 * Free Trial Onboarding Tests
 * 
 * Tests the new free trial flow:
 * 1. Clerk webhook gives $5 free credits on signup
 * 2. Polar webhook adds credits on top of existing balance
 * 3. Onboarding flow is Telegram → Persona → Launch (no billing step)
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---- 1. Clerk webhook: user.created gives 500 credits ----

describe("Clerk webhook - free trial credits", () => {
  it("should set creditsCents to 500 in user.created handler", () => {
    const webhookSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/api/webhooks/clerk/route.ts"),
      "utf-8"
    );
    // The create call should have creditsCents: 500
    expect(webhookSource).toContain("creditsCents: 500");
    expect(webhookSource).not.toContain("creditsCents: 0");
  });
});

// ---- 2. Polar webhook: subscription adds credits on top ----

describe("Polar webhook - subscription credits", () => {
  it("should increment credits (not set) for subscription", () => {
    const polarSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/api/webhooks/polar/route.ts"),
      "utf-8"
    );
    // Should use increment to add on top of existing balance
    expect(polarSource).toContain("increment: creditsCents");
  });

  it("should give 500 cents for basic and 1500 for pro", () => {
    const polarSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/api/webhooks/polar/route.ts"),
      "utf-8"
    );
    // Check credit amounts
    expect(polarSource).toContain('plan === "pro" ? 1500 : 500');
  });
});

// ---- 3. Onboarding flow: no billing step ----

describe("Onboarding flow - free trial", () => {
  const onboardingSource = fs.readFileSync(
    path.resolve(__dirname, "../../src/app/onboarding/page.tsx"),
    "utf-8"
  );

  it("should not have billing as a step type", () => {
    // The Step type should not include "billing"
    expect(onboardingSource).not.toMatch(/type Step\s*=.*"billing"/);
  });

  it("should start on telegram step", () => {
    expect(onboardingSource).toContain('step: "telegram"');
    // Should NOT default to billing
    expect(onboardingSource).not.toContain('step: "billing"');
  });

  it("should have 3 progress steps (telegram, persona, launching)", () => {
    // Should have exactly these 3 steps in the progress bar
    expect(onboardingSource).toContain('{ key: "telegram", label: "Telegram" }');
    expect(onboardingSource).toContain('{ key: "persona", label: "Persona" }');
    expect(onboardingSource).toContain('{ key: "launching", label: "Launch" }');
    // Should NOT have billing step
    expect(onboardingSource).not.toContain('{ key: "billing"');
  });

  it("should not have handleSubscribe function", () => {
    expect(onboardingSource).not.toContain("handleSubscribe");
  });

  it("should show free credits message", () => {
    expect(onboardingSource).toContain("$5 in free credits");
  });
});

// ---- 4. Dashboard paywall when balance is 0 ----

describe("Dashboard - paywall for empty balance", () => {
  const dashboardSource = fs.readFileSync(
    path.resolve(__dirname, "../../src/app/(dashboard)/dashboard/page.tsx"),
    "utf-8"
  );

  it("should show paywall when credits are 0 and has instances", () => {
    expect(dashboardSource).toContain("creditsCents <= 0");
    expect(dashboardSource).toContain("Your credits have run out");
    expect(dashboardSource).toContain("Add Credits");
  });

  it("should redirect to onboarding only when no instances (not based on balance)", () => {
    // Should redirect based on instances, not balance
    expect(dashboardSource).toContain("totalInstances === 0");
    expect(dashboardSource).not.toContain("creditsCents === 0 && totalInstances === 0");
  });
});

// ---- 5. Landing pages - free trial CTAs ----

describe("Landing pages - free trial messaging", () => {
  it("should have 'Get Started Free' CTA on English page", () => {
    const enSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/page.tsx"),
      "utf-8"
    );
    expect(enSource).toContain("Get Started Free");
    expect(enSource).toContain("$5 in credits, no card required");
  });

  it("should have 'Kostenlos starten' CTA on German page", () => {
    const deSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/de/page.tsx"),
      "utf-8"
    );
    expect(deSource).toContain("Kostenlos starten");
    expect(deSource).toContain("$5 Startguthaben, keine Karte nötig");
  });
});

// ---- 6. Instance provisioning - works without subscription ----

describe("Instance provisioning - free trial compatible", () => {
  it("should not require subscription for provisioning", () => {
    const provSource = fs.readFileSync(
      path.resolve(__dirname, "../../src/lib/provisioning.ts"),
      "utf-8"
    );
    // Should NOT check for subscription before creating instance
    expect(provSource).not.toContain("hasSubscription");
    expect(provSource).not.toContain("polarSubscriptionId");
  });

  it("should check balance >= 100 cents ($1) for non-BYOK users", () => {
    const instanceRoute = fs.readFileSync(
      path.resolve(__dirname, "../../src/app/api/instances/route.ts"),
      "utf-8"
    );
    // Free trial users get 500 cents, minimum is 100 — should pass
    expect(instanceRoute).toContain("MINIMUM_BALANCE_CENTS = 100");
  });
});
