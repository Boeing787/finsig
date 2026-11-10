import { NextRequest } from 'next/server';
import { redirectTo } from '../../../../../src/auth/redirect';
import {
  createSessionToken,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../../../../../src/auth/session';
import { exchangeAuthorizationCode, fetchPayPalIdentity } from '../../../../../src/paypal/identity';

export const runtime = 'nodejs';

function fail(reason: 'paypal_denied' | 'paypal_state' | 'paypal_exchange') {
  const response = redirectTo(`/login?error=${reason}`);
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
  if (params.get('error')) return fail('paypal_denied');
  const code = params.get('code');
  const state = params.get('state');
  const expected = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected || code.length > 2_048) {
    return fail('paypal_state');
  }
  try {
    const accessToken = await exchangeAuthorizationCode(code);
    const identity = await fetchPayPalIdentity(accessToken);
    const token = await createSessionToken({ mode: 'paypal', ...identity });
    const response = redirectTo('/connect');
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    response.cookies.set(OAUTH_STATE_COOKIE, '', {
      ...sessionCookieOptions(0),
      path: '/api/auth/paypal',
    });
    return response;
  } catch {
    return fail('paypal_exchange');
  }
}
