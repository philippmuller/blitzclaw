/**
 * Polar Webhook Handler
 * 
 * Handles subscription lifecycle events from Polar:
 * - subscription.created - New subscription
 * - subscription.updated - Plan changes, renewals
 * - subscription.canceled - Cancellation
 * - order.created - One-time purchases (top-ups)
 */

import { Webhooks } from "@polar-sh/nextjs";
import { prisma } from "@blitzclaw/db";

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onPayload: async (payload) => {
    console.log("📨 Polar webhook received:", payload.type);
  },

  onSubscriptionCreated: async (data) => {
    console.log("🎉 New subscription:", data.id);

    const subscription = data;
    const customer = subscription.customer;
    const product = subscription.product;

    // Determine plan from product name
    const isPro = product.name.toLowerCase().includes("pro");
    const plan = isPro ? "pro" : "basic";

    // Get or create user
    // We use Polar's customer ID to link accounts
    // The external_customer_id (if set during checkout) would be in metadata
    const externalId = customer.externalId || customer.id;

    try {
      await prisma.user.upsert({
        where: { polarCustomerId: customer.id },
        update: {
          polarSubscriptionId: subscription.id,
          subscriptionStatus: "active",
          plan,
          email: customer.email,
          billingMode: "managed", // Using Polar for billing
        },
        create: {
          polarCustomerId: customer.id,
          polarSubscriptionId: subscription.id,
          clerkId: externalId, // May need to link to Clerk later
          email: customer.email,
          subscriptionStatus: "active",
          plan,
          billingMode: "managed",
        },
      });

      console.log(`✅ User created/updated for subscription ${subscription.id}`);
    } catch (error) {
      console.error("Failed to create/update user:", error);
    }
  },

  onSubscriptionUpdated: async (data) => {
    console.log("🔄 Subscription updated:", data.id);

    const subscription = data;

    try {
      await prisma.user.updateMany({
        where: { polarSubscriptionId: subscription.id },
        data: {
          subscriptionStatus: subscription.status,
        },
      });
    } catch (error) {
      console.error("Failed to update subscription:", error);
    }
  },

  onSubscriptionCanceled: async (data) => {
    console.log("❌ Subscription canceled:", data.id);

    const subscription = data;

    try {
      // Mark subscription as canceled but don't delete user
      await prisma.user.updateMany({
        where: { polarSubscriptionId: subscription.id },
        data: {
          subscriptionStatus: "canceled",
        },
      });

      // Pause instances for this user
      const user = await prisma.user.findFirst({
        where: { polarSubscriptionId: subscription.id },
      });

      if (user) {
        await prisma.instance.updateMany({
          where: { userId: user.id },
          data: { status: "PAUSED" },
        });
        console.log(`⏸️ Paused instances for user ${user.id}`);
      }
    } catch (error) {
      console.error("Failed to handle cancellation:", error);
    }
  },

  onOrderCreated: async (data) => {
    console.log("📦 Order created:", data.id);
    // Handle one-time purchases (top-ups) if we add them later
  },

  onSubscriptionActive: async (data) => {
    console.log("✅ Subscription active:", data.id);

    try {
      await prisma.user.updateMany({
        where: { polarSubscriptionId: data.id },
        data: {
          subscriptionStatus: "active",
        },
      });

      // Reactivate paused instances
      const user = await prisma.user.findFirst({
        where: { polarSubscriptionId: data.id },
      });

      if (user) {
        await prisma.instance.updateMany({
          where: { userId: user.id, status: "PAUSED" },
          data: { status: "ACTIVE" },
        });
      }
    } catch (error) {
      console.error("Failed to activate subscription:", error);
    }
  },
});
