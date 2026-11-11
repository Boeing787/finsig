import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cashPlan } from './cashplan';
import { initialWorkspaceState, type WorkspaceState } from './workspace';

const withExpectations = (
  expectations: Partial<WorkspaceState['expectations']>,
): WorkspaceState => ({
  ...initialWorkspaceState,
  expectations: { ...initialWorkspaceState.expectations, ...expectations },
});

const byId = (state: WorkspaceState = initialWorkspaceState) =>
  new Map(cashPlan(state).events.map((event) => [event.id, event]));

test('subscriptions are forecast from three or more monthly payments, never from one', () => {
  const events = byId();
  const vectorly = events.get('pattern:expense:Vectorly Pro');
  assert.equal(vectorly?.date, '2026-12-01');
  assert.equal(vectorly?.amountMinor, 2_400n);
  assert.equal(vectorly?.counted, true);
  assert.equal(events.get('pattern:expense:Taskline Teams')?.date, '2026-12-10');
  const plan = cashPlan(initialWorkspaceState);
  assert.deepEqual(
    plan.notForecast.map((item) => item.sourceRecordIds),
    [['pp-2026-01-exp-typecase'], ['pp-2026-05-exp-shapeshift']],
  );
});

test('repeating income and overdue invoices count only after the person confirms them', () => {
  const pinecone = 'pattern:sale:pinecone';
  const lumen = 'invoice:INV-2026-041';
  const before = cashPlan(initialWorkspaceState);
  const events = byId();
  assert.equal(events.get(pinecone)?.status, 'needs_confirmation');
  assert.equal(events.get(pinecone)?.counted, false);
  assert.equal(events.get(lumen)?.status, 'overdue');
  assert.equal(events.get(lumen)?.counted, false);
  assert.equal(before.awaitingMinor, 65_000n + 320_000n);

  const after = cashPlan(withExpectations({ confirmed: [pinecone, lumen] }));
  assert.equal(after.inMinor, before.inMinor + 65_000n + 320_000n);
  assert.equal(after.awaitingMinor, 0n);
});

test('a client already invoiced in the window is not forecast again from its pattern', () => {
  const events = byId();
  // Northstar's December retainer is invoiced, so its monthly pattern must not add a second one.
  assert.ok(events.has('invoice:INV-2026-046'));
  assert.equal(events.has('pattern:sale:northstar'), false);
  assert.equal(events.has('pattern:sale:kestrel'), false);
  assert.equal(events.has('pattern:sale:atlas'), false);
});

test('totals are exact flows, and a difference rather than a balance', () => {
  const plan = cashPlan(initialWorkspaceState);
  // Atlas pending 1,900 + invoices 1,350 + 2,100 + 2,400.
  assert.equal(plan.inMinor, 775_000n);
  // Framewise renewal 240 (entered by the person) + subscriptions 24 + 12 + 16.
  assert.equal(plan.outMinor, 29_200n);
  const fees = plan.events
    .filter((event) => event.counted && event.direction === 'in')
    .reduce((total, event) => total + event.feeMinor, 0n);
  assert.equal(plan.feesMinor, fees);
  assert.equal(plan.differenceMinor, plan.inMinor + plan.feesMinor - plan.outMinor);
  assert.equal(plan.horizonEnd, '2026-12-10');
});

test('large upcoming expenses raise one in-app alert each, small subscriptions none', () => {
  const plan = cashPlan(initialWorkspaceState);
  assert.deepEqual(
    plan.alerts.map((alert) => [alert.eventId, alert.daysAway]),
    [['user-framewise-annual', 15]],
  );
  const added = cashPlan(
    withExpectations({
      added: [
        ...initialWorkspaceState.expectations.added,
        {
          id: 'user-laptop',
          direction: 'out',
          label: 'Laptop repair',
          amountMinor: 18_000n,
          date: '2026-11-20',
        },
      ],
    }),
  );
  assert.equal(added.alerts.length, 2);
  assert.equal(added.outMinor, 29_200n + 18_000n);
});

test('removing an event takes it out of the plan and its alert with it', () => {
  const cancelled = cashPlan(
    withExpectations({ dismissed: ['pattern:expense:Vectorly Pro'], added: [] }),
  );
  assert.equal(cancelled.outMinor, 1_200n + 1_600n);
  assert.equal(cancelled.alerts.length, 0);
});
