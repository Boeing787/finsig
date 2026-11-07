import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [captureId, refundId] = process.argv.slice(2);
if (!captureId || !refundId) {
  throw new Error('Usage: pnpm paypal:verify-reporting <capture-id> <refund-id>');
}

const now = new Date();
const env = {
  ...process.env,
  PAYPAL_PROBE_START_DATE: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
  PAYPAL_PROBE_END_DATE: now.toISOString(),
};

function digest(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function probe() {
  return JSON.parse(
    execFileSync(process.execPath, ['scripts/paypal-reporting-probe.mjs', 'first-party'], {
      env,
      encoding: 'utf8',
      timeout: 30_000,
    }),
  );
}

function recordKey(record) {
  return JSON.stringify([
    record.transactionFingerprint,
    record.eventCode,
    record.initiatedAt,
    record.amount?.currency_code,
    record.amount?.value,
  ]);
}

const first = probe();
const second = probe();
const firstKeys = first.samples.map(recordKey).sort();
const secondKeys = second.samples.map(recordKey).sort();
const sameRefresh = first.lastRefreshed === second.lastRefreshed;
const stablePage =
  sameRefresh &&
  first.totalPages === 1 &&
  second.totalPages === 1 &&
  first.totalItems <= 10 &&
  second.totalItems <= 10 &&
  JSON.stringify(firstKeys) === JSON.stringify(secondKeys) &&
  new Set(firstKeys).size === firstKeys.length;

const expected = {
  capture:
    first.samples.find((record) => record.transactionFingerprint === digest(captureId)) ?? null,
  refund:
    first.samples.find((record) => record.transactionFingerprint === digest(refundId)) ?? null,
};

const result = {
  result: stablePage && expected.capture && expected.refund ? 'go' : 'pending',
  queriedAt: second.queriedAt,
  lastRefreshed: second.lastRefreshed,
  totalItems: second.totalItems,
  repeatReadStable: stablePage,
  capture: expected.capture,
  refund: expected.refund,
  reason: !sameRefresh
    ? 'Reporting refreshed between reads; repeat the check.'
    : !stablePage
      ? 'Page changed or has more records than this compact probe can compare.'
      : !expected.capture || !expected.refund
        ? 'Expected records have not appeared in Transaction Search yet.'
        : null,
};

console.log(JSON.stringify(result, null, 2));
if (result.result !== 'go') process.exitCode = 2;
