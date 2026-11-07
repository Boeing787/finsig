import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activityRows,
  bridgeReconciles,
  buildBridge,
  forecast30Days,
  initialDemoState,
  periodTotals,
} from './demo';

test('golden demo bridge reconciles September and October exactly', () => {
  assert.equal(periodTotals('2026-09').netMinor, 460_000n);
  assert.equal(periodTotals('2026-10').netMinor, 340_000n);
  assert.deepEqual(
    buildBridge().map(({ id, valueMinor }) => [id, valueMinor]),
    [
      ['gross_delta', -110_000n],
      ['refund_delta', -15_000n],
      ['fee_delta', 5_000n],
    ],
  );
  assert.equal(bridgeReconciles(), true);
});

test('confirmation assigns linked refund and changes per-hour contribution', () => {
  const before = activityRows(initialDemoState);
  assert.equal(before.find((row) => row.id === 'consulting')?.recordIds.length, 0);
  const after = activityRows({
    ...initialDemoState,
    confirmedActivityIds: { 'pp-oct-consulting': 'consulting' },
  });
  const consulting = after.find((row) => row.id === 'consulting');
  assert.equal(consulting?.netMinor, 148_000n);
  assert.equal(consulting?.contributionPerHour, '61.50');
  assert.deepEqual(consulting?.recordIds, ['pp-oct-consulting', 'pp-oct-refund']);
});

test('thirty-day baseline uses code, not the model', () => {
  assert.deepEqual(forecast30Days(), {
    receiptsMinor: 329_032n,
    contributionMinor: 256_452n,
  });
  assert.deepEqual(
    forecast30Days({
      ...initialDemoState,
      work: {
        ...initialDemoState.work,
        design: { ...initialDemoState.work.design, directCostMinor: 60_000n },
      },
    }),
    { receiptsMinor: 329_032n, contributionMinor: 246_774n },
  );
});
