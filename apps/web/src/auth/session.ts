import { z } from 'zod';

/**
 * Stateless, HMAC-signed session cookie.
 *
 * FinSig never stores a PayPal password or PayPal access token. After PayPal OpenID Connect
 * returns the freelancer's identity, only the display name, email and payer ID are kept in this
 * signed, httpOnly cookie for eight hours.
 */

export const SESSION_COOKIE = 'finsig_session';
export const OAUTH_STATE_COOKIE = 'finsig_oauth_state';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const sessionSchema = z.object({
  v: z.literal(1),
  mode: z.enum(['demo', 'paypal']),
  name: z.string().min(1).max(120),
  email: z.string().max(254).nullable(),
  payerId: z.string().max(64).nullable(),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type Session = z.infer<typeof sessionSchema>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * SESSION_SECRET is preferred. Without it, the key is derived from an existing server-only secret
 * so the proxy and route handlers agree across processes; the label keeps it domain-separated.
 */
function secretMaterial(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  const derivedFrom =
    process.env.PAYPAL_SANDBOX_CLIENT_SECRET ?? process.env.ANTHROPIC_API_KEY ?? 'finsig-local-dev';
  return `finsig-session-v1:${derivedFrom}`;
}

let cachedKey: { material: string; key: Promise<CryptoKey> } | null = null;

function signingKey(): Promise<CryptoKey> {
  const material = secretMaterial();
  if (cachedKey?.material !== material) {
    cachedKey = {
      material,
      key: crypto.subtle.importKey(
        'raw',
        encoder.encode(material),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
      ),
    };
  }
  return cachedKey.key;
}

export async function createSessionToken(
  input: Pick<Session, 'mode' | 'name' | 'email' | 'payerId'>,
  now = Date.now(),
): Promise<string> {
  const iat = Math.floor(now / 1000);
  const session: Session = { v: 1, ...input, iat, exp: iat + SESSION_TTL_SECONDS };
  const payload = toBase64Url(encoder.encode(JSON.stringify(sessionSchema.parse(session))));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function readSessionToken(
  token: string | undefined,
  now = Date.now(),
): Promise<Session | null> {
  if (!token || token.length > 4_096) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await signingKey(),
      fromBase64Url(signature),
      encoder.encode(payload),
    );
    if (!valid) return null;
    const session = sessionSchema.parse(JSON.parse(decoder.decode(fromBase64Url(payload))));
    if (session.exp * 1000 <= now) return null;
    return session;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return null;
  return `${local.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(6, local.length - 2)))}@${domain}`;
}
