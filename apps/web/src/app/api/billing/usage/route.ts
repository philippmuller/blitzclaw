import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

export async function GET(request: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  // Default to current month
  const now = new Date();
  const from = fromParam 
    ? new Date(fromParam) 
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toParam 
    ? new Date(toParam) 
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      instances: {
        include: {
          usageLogs: {
            where: {
              timestamp: {
                gte: from,
                lte: to,
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Aggregate usage by model
  const usageByModel: Record<string, { tokensIn: number; tokensOut: number; costCents: number }> = {};
  let totalCostCents = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  for (const instance of user.instances) {
    for (const log of instance.usageLogs) {
      if (!usageByModel[log.model]) {
        usageByModel[log.model] = { tokensIn: 0, tokensOut: 0, costCents: 0 };
      }
      usageByModel[log.model].tokensIn += log.tokensIn;
      usageByModel[log.model].tokensOut += log.tokensOut;
      usageByModel[log.model].costCents += log.costCents;
      
      totalCostCents += log.costCents;
      totalTokensIn += log.tokensIn;
      totalTokensOut += log.tokensOut;
    }
  }

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    totalCostCents,
    totalCostDollars: (totalCostCents / 100).toFixed(2),
    totalTokensIn,
    totalTokensOut,
    byModel: Object.entries(usageByModel).map(([model, data]) => ({
      model,
      ...data,
      costDollars: (data.costCents / 100).toFixed(2),
    })),
    instances: user.instances.map(instance => ({
      id: instance.id,
      channelType: instance.channelType,
      status: instance.status,
      usageCount: instance.usageLogs.length,
      costCents: instance.usageLogs.reduce((sum, log) => sum + log.costCents, 0),
    })),
  });
}
