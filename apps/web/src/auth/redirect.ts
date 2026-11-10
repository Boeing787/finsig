import { NextResponse, type NextRequest } from 'next/server';

/**
 * Same-origin redirect with a relative Location header.
 *
 * Behind Render's proxy the app listens on 0.0.0.0:$PORT, so `request.url` names the internal
 * address. A relative Location is resolved by the browser against the public URL it requested.
 */
export function redirectTo(path: string, status: 303 | 307 = 303): NextResponse {
  if (!path.startsWith('/') || path.startsWith('//'))
    throw new Error('Redirect path must be local.');
  return new NextResponse(null, {
    status,
    headers: { Location: path, 'Cache-Control': 'no-store' },
  });
}

/** Public origin for absolute URLs that leave the app, such as the PayPal return URL. */
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
