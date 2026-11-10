import { redirectTo } from '../../../../src/auth/redirect';
import { SESSION_COOKIE, sessionCookieOptions } from '../../../../src/auth/session';

export const runtime = 'nodejs';

export async function POST() {
  const response = redirectTo('/login?signedOut=1');
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
  return response;
}
