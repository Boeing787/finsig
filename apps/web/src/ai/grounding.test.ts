import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recordById } from '../domain/workspace';
import { groundedMetrics, validateAnswer, validateClassification } from './grounding';

test('classification rejects wrong record and unsupported evidence', () => {
  const record = recordById.get('pp-2026-10-atlas')!;
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

test('answers reject invented amounts, unknown metrics and unrelated records', () => {
  const metrics = groundedMetrics('2026-10');
  const claim = (text: string, metricIds: string[], recordIds: string[]) => ({
    unsupported: false,
    claims: [{ text, metric_ids: metricIds, record_ids: recordIds }],
  });
  assert.throws(() =>
    validateAnswer(claim('Net fell by $999.', ['net_delta'], ['pp-2026-10-northstar']), metrics),
  );
  assert.throws(() =>
    validateAnswer(claim('Income fell by forty percent.', ['made_up'], []), metrics),
  );
  assert.throws(() =>
    validateAnswer(
      claim('The refund reduced net income.', ['refund_delta'], ['pp-2026-09-lumen']),
      metrics,
    ),
  );
  assert.throws(() => validateAnswer({ unsupported: false, claims: [] }, metrics));
  assert.deepEqual(
    validateAnswer(
      claim(
        'The missing Lumen Health milestone was the biggest driver.',
        ['client_delta:lumen'],
        ['pp-2026-09-lumen'],
      ),
      metrics,
    ).claims[0]?.metric_ids,
    ['client_delta:lumen'],
  );
  assert.equal(validateAnswer({ unsupported: true, claims: [] }, metrics).unsupported, true);
});

test('metric catalogue values are rendered by code', () => {
  const metrics = new Map(groundedMetrics('2026-10').map((metric) => [metric.id, metric]));
  assert.equal(metrics.get('net:2026-10')?.value, '$5,300.85');
  assert.equal(metrics.get('net_delta')?.value, '-$3,527.36');
  assert.equal(metrics.get('client_delta:lumen')?.value, '-$2,500.00');
});
