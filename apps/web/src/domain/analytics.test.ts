import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAnalyticsBridge, buildAnalyticsRecords, buildAnalyticsSummary } from './analytics';

const cents = (value: number) => Math.round(value * 100);

test('analytics projection reconciles projected rows to exact period totals', () => {
  const records = buildAnalyticsRecords();
  const net = (month: string) =>
    records
      .filter((record) => record.month === month)
      .reduce((sum, record) => sum + cents(record.net_usd), 0);
  assert.equal(net('2026-09'), 882_821);
  assert.equal(net('2026-10'), 530_085);
  assert.deepEqual(buildAnalyticsSummary('2026-10'), {
    previous_net_usd: 8_828.21,
    current_net_usd: 5_300.85,
    delta_usd: -3_527.36,
    delta_percent: -40,
  });
});

test('analytics bridge reconciles to the net change', () => {
  const bridge = buildAnalyticsBridge('2026-10');
  assert.equal(
    bridge.reduce((sum, item) => sum + cents(item.value_usd), 0),
    -352_736,
  );
});

test('each bridge factor adds up from the amounts and fees of its own records', () => {
  const byId = new Map(buildAnalyticsRecords().map((record) => [record.record_id, record]));
  for (const period of ['2026-10', '2026-09', '2026-05']) {
    for (const item of buildAnalyticsBridge(period)) {
      const sign = (month: string) => (month === period ? 1 : -1);
      const total = item.record_ids.reduce((sum, id) => {
        const record = byId.get(id);
        assert.ok(record, `${id} is in the analytics ledger`);
        const value = item.id === 'fee_delta' ? record.fees_usd : record.amount_usd;
        return sum + sign(record.month) * cents(value);
      }, 0);
      assert.equal(total, cents(item.value_usd), `${period} ${item.id}`);
    }
  }
});
