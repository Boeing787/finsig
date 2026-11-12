import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PERIODS, recordById, workspaceRecords } from '../domain/workspace';
import {
  buildAnswerRequest,
  groundedMetrics,
  hasUnverifiedQuantity,
  validateAnswer,
  validateClassification,
} from './grounding';

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

test('claim prose cannot state a quantity in words either', () => {
  // Phrases the model produced in a live audit, each an unverified number.
  for (const text of [
    'Northstar accounts for more than two-fifths of your gross.',
    'October reached just under nine-tenths of the target.',
    'The set-aside is a quarter of your profit after expenses.',
    'Gross receipts came from five client transactions.',
    'Your top two clients represent most of your revenue.',
    'Fees were twice as high in September.',
    'Income fell by several thousand dollars.',
    'Income fell by forty percent.',
  ]) {
    assert.equal(hasUnverifiedQuantity(text), true, text);
  }
  // Qualitative comparisons, ranks and time windows stay allowed.
  for (const text of [
    'Kestrel Analytics was the second-largest drag on the change.',
    'Northstar holds the largest share of twelve-month gross.',
    'The three-month average stays above the goal.',
    'Adding one more client in that tier would reduce concentration.',
    'Lumen Health sent no payment this month, the biggest driver of the decline.',
  ]) {
    assert.equal(hasUnverifiedQuantity(text), false, text);
  }
  const metrics = groundedMetrics('2026-10');
  assert.throws(() =>
    validateAnswer(
      {
        unsupported: false,
        claims: [
          {
            text: 'Your top two clients bring in most of your gross.',
            metric_ids: ['client_share:northstar'],
            record_ids: [],
          },
        ],
      },
      metrics,
    ),
  );
});

test('AI context contains only the sample history and says so', () => {
  const sampleIds = new Set(workspaceRecords.map((record) => record.id));
  for (const period of PERIODS) {
    const { metrics, request } = buildAnswerRequest('Why did income change?', period);
    for (const metric of metrics) {
      for (const id of metric.recordIds) assert.ok(sampleIds.has(id), `${metric.id} cites ${id}`);
    }
    const records = (JSON.parse(request.user) as { records: { id: string }[] }).records;
    assert.ok(records.every((record) => sampleIds.has(record.id)));
    const scope = metrics.find((metric) => metric.id === 'data_scope');
    assert.match(
      scope?.value ?? '',
      /sample history only; live PayPal sandbox records are excluded/u,
    );
    assert.match(request.system, /not real, actual or live PayPal income/u);
  }
});

test('cash plan metrics are the plan computed by code, events included', async () => {
  const { cashPlan } = await import('../domain/cashplan');
  const { initialWorkspaceState, money } = await import('../domain/workspace');
  const plan = cashPlan(initialWorkspaceState);
  const metrics = new Map(groundedMetrics('2026-10').map((metric) => [metric.id, metric]));
  assert.equal(metrics.get('plan_in_30d')?.value, money(plan.inMinor));
  assert.equal(metrics.get('plan_out_30d')?.value, money(-plan.outMinor));
  assert.equal(metrics.get('plan_difference_30d')?.value, money(plan.differenceMinor));
  assert.equal(metrics.get('plan_awaiting_30d')?.value, money(plan.awaitingMinor));
  const renewal = metrics.get('plan_event:user-framewise-annual');
  assert.match(renewal?.label ?? '', /Framewise annual plan renewal, 2026-11-25 \(entered by/u);
  assert.equal(renewal?.value, '-$240.00');
  assert.match(
    metrics.get('plan_event:pattern:sale:pinecone')?.label ?? '',
    /waiting for confirmation, not counted/u,
  );
});

test('a failing claim is dropped and never shown, the verified ones still are', () => {
  const metrics = groundedMetrics('2026-10');
  const answer = validateAnswer(
    {
      unsupported: false,
      claims: [
        {
          text: 'The missing Lumen Health milestone was the biggest driver.',
          metric_ids: ['client_delta:lumen'],
          record_ids: ['pp-2026-09-lumen'],
        },
        {
          text: 'Consulting earns the least among the three activity types.',
          metric_ids: ['activity_rate:consulting'],
          record_ids: [],
        },
      ],
    },
    metrics,
  );
  assert.deepEqual(
    answer.claims.map((claim) => claim.metric_ids),
    [['client_delta:lumen']],
  );
  assert.equal(answer.dropped.length, 1);
  assert.match(answer.dropped[0] ?? '', /"three"/u);
});
