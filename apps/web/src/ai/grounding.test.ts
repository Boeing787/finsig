import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoRecords } from '../domain/demo';
import { explanationMetrics, validateClassification, validateExplanation } from './grounding';

test('classification rejects wrong record and unsupported evidence', () => {
  const record = demoRecords.find((item) => item.id === 'pp-oct-consulting')!;
  assert.throws(() =>
    validateClassification(
      {
        record_id: 'another-record',
        activity_id: 'consulting',
        evidence_fields: ['transaction_subject'],
        question: '',
      },
      record,
    ),
  );
  assert.throws(() =>
    validateClassification(
      {
        record_id: record.id,
        activity_id: 'consulting',
        evidence_fields: ['unknown_field'],
        question: '',
      },
      record,
    ),
  );
});

test('explanation rejects invented amounts and unrelated source records', () => {
  const metrics = explanationMetrics();
  assert.throws(() =>
    validateExplanation(
      {
        claims: [
          {
            text: 'Revenue fell by $999.',
            metric_ids: ['net_delta'],
            record_ids: ['pp-oct-design'],
          },
        ],
      },
      metrics,
    ),
  );
  assert.throws(() =>
    validateExplanation(
      {
        claims: [
          {
            text: 'The refund reduced net receipts.',
            metric_ids: ['refund_delta'],
            record_ids: ['pp-sep-design'],
          },
        ],
      },
      metrics,
    ),
  );
  assert.deepEqual(
    validateExplanation(
      {
        claims: [
          {
            text: 'The refund reduced net receipts.',
            metric_ids: ['refund_delta'],
            record_ids: ['pp-oct-refund'],
          },
        ],
      },
      metrics,
    ).claims[0]?.metric_ids,
    ['refund_delta'],
  );
});
