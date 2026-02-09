/**
 * Creem webhook route disabled.
 * Paddle billing is now active.
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Creem webhooks are disabled" },
    { status: 410 }
  );
}
