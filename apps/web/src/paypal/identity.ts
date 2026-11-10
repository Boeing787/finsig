import { z } from 'zod';

/**
 * Log in with PayPal (OpenID Connect, sandbox).
 *
 * Enable "Log in with PayPal" for the sandbox REST app, add the return URL
 * `${APP_BASE_URL}/api/auth/paypal/callback`, then set PAYPAL_LOGIN_ENABLED=true.
 */

const SANDBOX_WEB = 'https://www.sandbox.paypal.com';
const SANDBOX_API = 'https://api-m.sandbox.paypal.com';
export const PAYPAL_LOGIN_SCOPES = ['openid', 'profile', 'email'] as const;

function credentials() {
  const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SANDBOX_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function paypalLoginEnabled(): boolean {
  return Boolean(credentials()) && process.env.PAYPAL_LOGIN_ENABLED === 'true';
}

export function paypalSyncEnabled(): boolean {
  return Boolean(credentials());
}

export function callbackUrl(requestOrigin: string): string {
  const base = (process.env.APP_BASE_URL ?? requestOrigin).replace(/\/$/u, '');
  return `${base}/api/auth/paypal/callback`;
}

export function authorizeUrl(state: string, redirectUri: string): string {
  const creds = credentials();
  if (!creds) throw new Error('PayPal sandbox credentials are not configured.');
  const url = new URL('/connect/', SANDBOX_WEB);
  url.searchParams.set('flowEntry', 'static');
  url.searchParams.set('client_id', creds.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', PAYPAL_LOGIN_SCOPES.join(' '));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

const tokenSchema = z.object({ access_token: z.string().min(1), token_type: z.string() });

export async function exchangeAuthorizationCode(code: string): Promise<string> {
  const creds = credentials();
  if (!creds) throw new Error('PayPal sandbox credentials are not configured.');
  const response = await fetch(`${SANDBOX_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${creds.clientId}:${creds.clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code }).toString(),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`PayPal token exchange failed with HTTP ${response.status}.`);
  return tokenSchema.parse(await response.json()).access_token;
}

const userInfoSchema = z.object({
  user_id: z.string().optional(),
  sub: z.string().optional(),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  email: z.string().optional(),
  emails: z.array(z.object({ value: z.string(), primary: z.boolean().optional() })).optional(),
  payer_id: z.string().optional(),
});

export interface PayPalIdentity {
  name: string;
  email: string | null;
  payerId: string | null;
}

export async function fetchPayPalIdentity(accessToken: string): Promise<PayPalIdentity> {
  const response = await fetch(`${SANDBOX_API}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`PayPal userinfo failed with HTTP ${response.status}.`);
  const info = userInfoSchema.parse(await response.json());
  const name =
    info.name ?? [info.given_name, info.family_name].filter(Boolean).join(' ') ?? 'PayPal user';
  const email =
    info.email ?? info.emails?.find((item) => item.primary)?.value ?? info.emails?.[0]?.value;
  return {
    name: name.trim().slice(0, 120) || 'PayPal user',
    email: email?.slice(0, 254) ?? null,
    payerId: info.payer_id?.slice(0, 64) ?? null,
  };
}
