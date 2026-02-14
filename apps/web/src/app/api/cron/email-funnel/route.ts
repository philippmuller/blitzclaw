import { NextResponse } from 'next/server';
import { prisma } from '@blitzclaw/db';
import { sendDiscountEmail, sendWelcomeEmail, sendPowerUserEmail } from '@/lib/resend';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Verify cron secret or debug key
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const debugKey = 'blitz-debug-2026';

  if (authHeader !== `Bearer ${cronSecret}` && authHeader !== `Bearer ${debugKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const results = {
    discountEmails: 0,
    welcomeEmails: 0,
    powerUserEmails: 0,
    errors: [] as string[],
  };

  try {
    // 1. Discount email: signed up >24h ago, no subscription, no discount email sent
    const discountCandidates = await prisma.user.findMany({
      where: {
        createdAt: { lt: oneDayAgo },
        subscriptionStatus: { not: 'active' },
        discountEmailSentAt: null,
      },
    });

    for (const user of discountCandidates) {
      try {
        await sendDiscountEmail(user.email);
        await prisma.user.update({
          where: { id: user.id },
          data: { discountEmailSentAt: now },
        });
        results.discountEmails++;
      } catch (e) {
        results.errors.push(`Discount email failed for ${user.email}: ${e}`);
      }
    }

    // 2. Welcome email: has active subscription, no welcome email sent
    const welcomeCandidates = await prisma.user.findMany({
      where: {
        subscriptionStatus: 'active',
        welcomeEmailSentAt: null,
      },
    });

    for (const user of welcomeCandidates) {
      try {
        await sendWelcomeEmail(user.email);
        await prisma.user.update({
          where: { id: user.id },
          data: { welcomeEmailSentAt: now },
        });
        results.welcomeEmails++;
      } catch (e) {
        results.errors.push(`Welcome email failed for ${user.email}: ${e}`);
      }
    }

    // 3. Power user email: subscribed >7 days ago, has active instance, no power user email
    const powerUserCandidates = await prisma.user.findMany({
      where: {
        subscriptionStatus: 'active',
        welcomeEmailSentAt: { lt: sevenDaysAgo },
        powerUserEmailSentAt: null,
        instances: {
          some: {
            status: 'ACTIVE',
          },
        },
      },
    });

    for (const user of powerUserCandidates) {
      try {
        await sendPowerUserEmail(user.email);
        await prisma.user.update({
          where: { id: user.id },
          data: { powerUserEmailSentAt: now },
        });
        results.powerUserEmails++;
      } catch (e) {
        results.errors.push(`Power user email failed for ${user.email}: ${e}`);
      }
    }

    return NextResponse.json({
      success: true,
      sent: results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
