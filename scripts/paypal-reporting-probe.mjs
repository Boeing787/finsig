import { createHash } from 'node:crypto';

const baseUrl = 'https://api-m.sandbox.paypal.com';
const mode = process.argv[2] ?? 'first-party';
const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
const clientSecret = process.env.PAYPAL_SANDBOX_CLIENT_SECRET;

if (!['first-party', 'delegated'].includes(mode)) {
  throw new Error('Usage: node scripts/paypal-reporting-probe.mjs [first-party|delegated]');
}
if (!clientId || !clientSecret) {
  throw new Error('Set PAYPAL_SANDBOX_CLIENT_ID and PAYPAL_SANDBOX_CLIENT_SECRET.');
}
if (
  mode === 'delegated' &&
  (!process.env.PAYPAL_CONSENTED_MERCHANT_ID ||
    process.env.PAYPAL_PARTNER_CONSENT_CONFIRMED !== 'true' ||
    !process.env.PAYPAL_PARTNER_ATTRIBUTION_ID)
) {
  throw new Error(
    'Delegated mode requires consented merchant ID, confirmed consent, and partner attribution ID.',
  );
}

const end = new Date();
const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
const startDate = process.env.PAYPAL_PROBE_START_DATE || start.toISOString();
const endDate = process.env.PAYPAL_PROBE_END_DATE || end.toISOString();

for (const [name, value] of [
  ['start', startDate],
  ['end', endDate],
]) {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ${name} date.`);
}
if (Date.parse(startDate) >= Date.parse(endDate))
  throw new Error('Start date must precede end date.');
if (Date.parse(endDate) - Date.parse(startDate) > 31 * 24 * 60 * 60 * 1000) {
  throw new Error('The reporting interval must not exceed 31 days.');
}

function digest(value) {
  return value ? createHash('sha256').update(value).digest('hex').slice(0, 12) : null;
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
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
  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15_000),
  });
  const token = await readJson(tokenResponse);
  const scopes = new Set((token.scope ?? '').split(' '));
  if (!scopes.has('https://uri.paypal.com/services/reporting/search/read')) {
    const error = new Error(
      'OAuth token has no Transaction Search scope. Enable the app feature and retry after the old token expires.',
    );
    error.name = 'MISSING_REPORTING_SCOPE';
    throw error;
  }
  const url = new URL('/v1/reporting/transactions', baseUrl);
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('fields', 'all');
  url.searchParams.set('balance_affecting_records_only', 'N');
  url.searchParams.set('page_size', '50');
  url.searchParams.set('page', '1');

  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    'PayPal-Enforce-ISO8601-Format': 'true',
  };
  if (mode === 'delegated') {
    headers['PayPal-Auth-Assertion'] = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      iss: clientId,
      payer_id: process.env.PAYPAL_CONSENTED_MERCHANT_ID,
    })}.`;
    headers['PayPal-Partner-Attribution-Id'] = process.env.PAYPAL_PARTNER_ATTRIBUTION_ID;
  }

  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  const data = await readJson(response);
  const transactions = Array.isArray(data.transaction_details) ? data.transaction_details : [];
  const summary = {
    result: 'ok',
    mode,
    queriedAt: new Date().toISOString(),
    window: { startDate, endDate },
    accountFingerprint: digest(data.account_number ?? process.env.PAYPAL_CONSENTED_MERCHANT_ID),
    scopeGranted: scopes.has('https://uri.paypal.com/services/reporting/search/read'),
    totalItems: data.total_items ?? transactions.length,
    totalPages: data.total_pages ?? null,
    page: data.page ?? 1,
    lastRefreshed: data.last_refreshed_datetime ?? null,
    samples: transactions
      .slice(0, 10)
      .map(({ transaction_info: info = {}, payer_info: payer = {} }) => ({
        transactionFingerprint: digest(info.transaction_id),
        eventCode: info.transaction_event_code ?? null,
        status: info.transaction_status ?? null,
        amount: info.transaction_amount ?? null,
        fee: info.fee_amount ?? null,
        initiatedAt: info.transaction_initiation_date ?? null,
        hasCounterparty: Boolean(payer.account_id || payer.email_address),
      })),
  };
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(
    JSON.stringify(
      {
        result: 'error',
        mode,
        status: error.status ?? null,
        name: error.name ?? 'PROBE_ERROR',
        debugId: error.debugId ?? null,
        message: error.status ? undefined : error.message,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
