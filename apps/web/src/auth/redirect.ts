import { NextResponse, type NextRequest } from 'next/server';

function assertLocal(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Redirect path must be local.');
  }
}

/**
 * Same-origin redirect from a route handler, with a relative Location header.
 *
 * Behind Render's proxy the app listens on 0.0.0.0:$PORT, so `request.url` names the internal
 * address. A relative Location is resolved by the browser against the public URL it requested.
 * Do not use this in `proxy.ts`; use `proxyRedirect` there.
 */
export function redirectTo(path: string, status: 303 | 307 = 303): NextResponse {
  assertLocal(path);
  return new NextResponse(null, {
    status,
    headers: { Location: path, 'Cache-Control': 'no-store' },
  });
}

/**
 * Redirect returned from `proxy.ts`.
 *
 * Next's proxy adapter parses the Location header with `new URL(location)` and no base, so a
 * relative path throws "Invalid URL" and the request fails with HTTP 500. The target is built on
 * the public origin instead; Next turns it back into a relative path when the hosts match.
 */
export function proxyRedirect(
  request: NextRequest,
  path: string,
  status: 307 | 308 = 307,
): NextResponse {
  assertLocal(path);
  return NextResponse.redirect(new URL(path, publicOrigin(request)), {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** Public origin for absolute URLs, such as the PayPal return URL or a proxy redirect. */
export function publicOrigin(request: NextRequest): string {
  const configured = process.env.APP_BASE_URL?.replace(/\/$/u, '');
  if (configured) return configured;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const protocol =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    request.nextUrl.protocol.replace(':', '');
  if (host && /^[a-z0-9.-]+(:\d+)?$/iu.test(host)) return `${protocol}://${host}`;
  return request.nextUrl.origin;
}
