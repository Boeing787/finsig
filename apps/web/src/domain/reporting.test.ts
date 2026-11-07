import assert from 'node:assert/strict';
import test from 'node:test';
import { fromMinor, toMinor } from './money';
import { normalizeRecord } from './reporting';

function record(overrides: Record<string, unknown> = {}) {
  return {
    transaction_info: {
      transaction_id: 'SANDBOX-EXAMPLE-1',
      transaction_event_code: 'T0006',
      transaction_initiation_date: '2026-11-07T18:02:58+00:00',
      transaction_status: 'S',
      transaction_amount: { currency_code: 'USD', value: '5.00' },
      fee_amount: { currency_code: 'USD', value: '-0.66' },
      ...overrides,
    },
  };
}

test('exact cents and signed fee survive normalization', () => {
  const sale = normalizeRecord(record());
  assert.equal(sale.kind, 'sale');
  assert.equal(sale.amountMinor, 500n);
  assert.equal(sale.feeMinor, -66n);
  assert.equal(fromMinor(sale.amountMinor + sale.feeMinor!), '4.34');
});

test('refund reduces revenue, while account correction requires review', () => {
  const refund = normalizeRecord(
    record({
      transaction_id: 'SANDBOX-EXAMPLE-2',
      transaction_event_code: 'T1107',
      transaction_amount: { currency_code: 'USD', value: '-1.00' },
      fee_amount: undefined,
      paypal_reference_id: 'SANDBOX-EXAMPLE-1',
    }),
  );
  const correction = normalizeRecord(
    record({
      transaction_id: 'SANDBOX-EXAMPLE-3',
      transaction_event_code: 'T1900',
      transaction_amount: { currency_code: 'USD', value: '5000.00' },
      fee_amount: undefined,
    }),
  );
  assert.equal(refund.kind, 'refund');
  assert.equal(refund.amountMinor, -100n);
  assert.equal(refund.referenceId, 'SANDBOX-EXAMPLE-1');
  assert.equal(correction.kind, 'review');
});

test('source key is stable across status changes', () => {
  const pending = normalizeRecord(record({ transaction_status: 'P' }));
  const completed = normalizeRecord(record({ transaction_status: 'S' }));
  assert.equal(pending.sourceKey, completed.sourceKey);
});

test('rejects fractional cents instead of rounding money silently', () => {
  assert.throws(() => toMinor('1.001', 'USD'), /Invalid USD amount/);
});
