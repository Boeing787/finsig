import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, sessionCookieOptions } from '../../../../src/auth/session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login?signedOut=1', request.url), 303);
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return response;
}
