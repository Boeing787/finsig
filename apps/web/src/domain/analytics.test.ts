import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAnalyticsBridge, buildAnalyticsRecords, buildAnalyticsSummary } from './analytics';

test('analytics projection reconciles projected rows to exact period totals', () => {
  const records = buildAnalyticsRecords().filter((record) => record.kind !== 'review');
  const september = records
    .filter((record) => record.month === '2026-09')
    .reduce((sum, record) => sum + record.net_usd, 0);
  const october = records
    .filter((record) => record.month === '2026-10')
    .reduce((sum, record) => sum + record.net_usd, 0);

  assert.equal(september, 4_600);
  assert.equal(october, 3_400);
  assert.deepEqual(buildAnalyticsSummary(), {
    previous_net_usd: 4_600,
    current_net_usd: 3_400,
    delta_usd: -1_200,
    delta_percent: -26.1,
  });
});

test('analytics bridge reconciles to the net change', () => {
  const bridge = buildAnalyticsBridge();
  assert.equal(
    bridge.reduce((sum, item) => sum + item.value_usd, 0),
    -1_200,
  );
  assert.deepEqual(
    bridge.map((item) => item.value_usd),
    [-1_100, -150, 50],
  );
});
