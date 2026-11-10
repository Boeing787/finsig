import { NextResponse } from 'next/server';
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../../../../src/auth/session';
import { WORKSPACE_OWNER } from '../../../../src/domain/workspace';

export const runtime = 'nodejs';

/** One-click judge path: a signed demo session for the fictional sample workspace. */
export async function POST() {
  const token = await createSessionToken({
    mode: 'demo',
    name: WORKSPACE_OWNER.name,
    email: 'alex.morgan@example.com',
    payerId: null,
  });
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
