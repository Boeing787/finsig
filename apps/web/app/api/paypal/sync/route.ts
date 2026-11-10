import { NextRequest, NextResponse } from 'next/server';
import { readSessionToken, SESSION_COOKIE } from '../../../../src/auth/session';
import { liveSandboxSync } from '../../../../src/paypal/live-sync';

export const runtime = 'nodejs';

/** Live, read-only Transaction Search for the configured sandbox merchant. */
export async function GET(request: NextRequest) {
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const result = await liveSandboxSync();
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
