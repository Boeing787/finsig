import { NextRequest, NextResponse } from 'next/server';
import { OAUTH_STATE_COOKIE, sessionCookieOptions } from '../../../../../src/auth/session';
import { authorizeUrl, callbackUrl, paypalLoginEnabled } from '../../../../../src/paypal/identity';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!paypalLoginEnabled()) {
    return NextResponse.redirect(new URL('/login?error=paypal_unavailable', request.url), 303);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const response = NextResponse.redirect(
    authorizeUrl(state, callbackUrl(request.nextUrl.origin)),
    303,
  );
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    ...sessionCookieOptions(600),
    path: '/api/auth/paypal',
  });
  return response;
}
