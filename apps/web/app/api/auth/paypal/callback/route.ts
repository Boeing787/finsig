import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../../../../../src/auth/session';
import { exchangeAuthorizationCode, fetchPayPalIdentity } from '../../../../../src/paypal/identity';

export const runtime = 'nodejs';

function fail(request: NextRequest, reason: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${reason}`, request.url), 303);
  response.cookies.set(OAUTH_STATE_COOKIE, '', {
    ...sessionCookieOptions(0),
    path: '/api/auth/paypal',
  });
  return response;
}

/**
 * PayPal redirects here with a one-time code. The code is exchanged server-side, the identity is
 * read once, and the PayPal access token is discarded: it is never stored or sent to the browser.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get('error')) return fail(request, 'paypal_denied');
  const code = params.get('code');
  const state = params.get('state');
  const expected = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected || code.length > 2_048) {
    return fail(request, 'paypal_state');
  }
  try {
    const accessToken = await exchangeAuthorizationCode(code);
    const identity = await fetchPayPalIdentity(accessToken);
    const token = await createSessionToken({ mode: 'paypal', ...identity });
    const response = NextResponse.redirect(new URL('/connect', request.url), 303);
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    response.cookies.set(OAUTH_STATE_COOKIE, '', {
      ...sessionCookieOptions(0),
      path: '/api/auth/paypal',
    });
    return response;
  } catch {
    return fail(request, 'paypal_exchange');
  }
}
