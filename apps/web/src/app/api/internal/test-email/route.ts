import { NextResponse } from 'next/server';
import { sendDiscountEmail, sendWelcomeEmail, sendPowerUserEmail } from '@/lib/resend';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const to = url.searchParams.get('to');
  const template = url.searchParams.get('template') || 'discount';

  if (key !== 'blitz-debug-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!to) {
    return NextResponse.json({ error: 'Missing "to" parameter' }, { status: 400 });
  }

  try {
    let result;
    switch (template) {
      case 'welcome':
        result = await sendWelcomeEmail(to);
        break;
      case 'poweruser':
        result = await sendPowerUserEmail(to);
        break;
      case 'discount':
      default:
        result = await sendDiscountEmail(to);
        break;
    }

    return NextResponse.json({
      success: true,
      template,
      to,
      result,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
