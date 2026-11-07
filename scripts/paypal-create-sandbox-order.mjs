import { randomUUID } from 'node:crypto';

const baseUrl = 'https://api-m.sandbox.paypal.com';
const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
const clientSecret = process.env.PAYPAL_SANDBOX_CLIENT_SECRET;

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
  const orderReference = `finsig-reporting-${Date.now()}`;
  const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken.access_token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': randomUUID(),
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: orderReference,
          description: 'FinSig reporting sandbox test',
          amount: {
            currency_code: 'USD',
            value: '5.00',
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'FinSig Sandbox',
            landing_page: 'LOGIN',
            return_url: 'http://localhost:3000/paypal/sandbox-return',
            cancel_url: 'http://localhost:3000/paypal/sandbox-cancel',
          },
        },
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const order = await readJson(orderResponse);
  const approveUrl = order.links?.find((link) => link.rel === 'payer-action')?.href;
  if (!approveUrl) throw new Error('PayPal returned no buyer approval URL.');

  console.log(
    JSON.stringify(
      {
        result: 'ok',
        orderId: order.id,
        orderReference,
        status: order.status,
        approveUrl,
        next: 'Open approveUrl, sign in with a sandbox personal buyer, and approve the $5.00 test payment.',
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
        name: error.name ?? 'ORDER_SEED_ERROR',
        debugId: error.debugId ?? null,
        message: error.status ? undefined : error.message,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
