import { randomUUID } from 'node:crypto';

const [captureId] = process.argv.slice(2);
const baseUrl = 'https://api-m.sandbox.paypal.com';
const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
const clientSecret = process.env.PAYPAL_SANDBOX_CLIENT_SECRET;

if (!captureId) {
  throw new Error('Usage: node scripts/paypal-refund-sandbox-capture.mjs <capture-id>');
}

if (!clientId || !clientSecret) {
  throw new Error('Set PAYPAL_SANDBOX_CLIENT_ID and PAYPAL_SANDBOX_CLIENT_SECRET.');
}

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`${response.status} ${body.name ?? 'PAYPAL_ERROR'}`);
    error.status = response.status;
    error.name = body.name ?? 'PAYPAL_ERROR';
    error.debugId = body.debug_id ?? null;
    throw error;
  }
  return body;
}

try {
  const accessTokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15_000),
  });
  const accessToken = await readJson(accessTokenResponse);
  const refundResponse = await fetch(
    `${baseUrl}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken.access_token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `finsig-refund-${captureId}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        amount: { currency_code: 'USD', value: '1.00' },
        note_to_payer: 'FinSig sandbox reporting test',
      }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  const refund = await readJson(refundResponse);

  console.log(
    JSON.stringify(
      {
        result: 'ok',
        captureId,
        refundId: refund.id,
        refundStatus: refund.status,
        amount: refund.amount,
        next: 'Wait for Transaction Search propagation, then run pnpm paypal:probe first-party.',
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        result: 'error',
        status: error.status ?? null,
        name: error.name ?? 'REFUND_CAPTURE_ERROR',
        debugId: error.debugId ?? null,
        message: error.status ? undefined : error.message,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
