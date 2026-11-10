import { NextResponse, type NextRequest } from 'next/server';
import { proxyRedirect } from './src/auth/redirect';
import { readSessionToken, SESSION_COOKIE } from './src/auth/session';

/** Optimistic route guard: the app layout verifies the session again on the server. */
export async function proxy(request: NextRequest) {
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  return proxyRedirect(request, `/login?next=${encodeURIComponent(request.nextUrl.pathname)}`);
}

export const config = {
  matcher: ['/app', '/app/:path*', '/connect'],
};
