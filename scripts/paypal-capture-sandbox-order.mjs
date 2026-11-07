import { randomUUID } from 'node:crypto';

const [orderId] = process.argv.slice(2);
const baseUrl = 'https://api-m.sandbox.paypal.com';
const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
const clientSecret = process.env.PAYPAL_SANDBOX_CLIENT_SECRET;

if (!orderId) throw new Error('Usage: node scripts/paypal-capture-sandbox-order.mjs <order-id>');
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
  const captureResponse = await fetch(
    `${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken.access_token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': randomUUID(),
        Prefer: 'return=representation',
      },
      body: '{}',
      signal: AbortSignal.timeout(20_000),
    },
  );
  const order = await readJson(captureResponse);
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];

  console.log(
    JSON.stringify(
      {
        result: 'ok',
        orderId: order.id,
        orderStatus: order.status,
        captureId: capture?.id ?? null,
        captureStatus: capture?.status ?? null,
        amount: capture?.amount ?? null,
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
        name: error.name ?? 'CAPTURE_ORDER_ERROR',
        debugId: error.debugId ?? null,
        message: error.status ? undefined : error.message,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
