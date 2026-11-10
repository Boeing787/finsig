import { NextRequest, NextResponse } from 'next/server';
import { publicOrigin, redirectTo } from '../../../../../src/auth/redirect';
import { OAUTH_STATE_COOKIE, sessionCookieOptions } from '../../../../../src/auth/session';
import { authorizeUrl, callbackUrl, paypalLoginEnabled } from '../../../../../src/paypal/identity';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!paypalLoginEnabled()) return redirectTo('/login?error=paypal_unavailable');
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const state = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: authorizeUrl(state, callbackUrl(publicOrigin(request))),
      'Cache-Control': 'no-store',
    },
  });
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    ...sessionCookieOptions(600),
    path: '/api/auth/paypal',
  });
  return response;
}
