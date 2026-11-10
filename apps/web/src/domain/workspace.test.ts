import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activityRows,
  balanceSummary,
  bridgeReconciles,
  clientSummaries,
  effectiveHourlyRate,
  forecast30Days,
  incomeHealth,
  initialWorkspaceState,
  invoiceViews,
  monthlySeries,
  monthTotals,
  netChangeBridge,
  paypalFee,
  PERIODS,
  taxSetAside,
  unassignedSales,
} from './workspace';

test('PayPal standard fee is 3.49% + $0.49, rounded half-up to the cent', () => {
  assert.equal(paypalFee(240_000n), -8_425n);
  assert.equal(paypalFee(65_000n), -2_318n);
  assert.equal(paypalFee(45_000n), -1_620n);
});

test('golden months: September and October net income', () => {
  const september = monthTotals('2026-09');
  const october = monthTotals('2026-10');
  assert.equal(september.grossMinor, 915_000n);
  assert.equal(september.netMinor, 882_821n);
  assert.equal(october.grossMinor, 565_000n);
  assert.equal(october.refundsMinor, -15_000n);
  assert.equal(october.feesMinor, -19_915n);
  assert.equal(october.netMinor, 530_085n);
  assert.equal(october.profitMinor, 524_885n);
});

test('review rows and pending payments never count as income', () => {
  const october = monthTotals('2026-10');
  assert.equal(october.recordIds.includes('pp-2026-10-correction'), false);
  const november = monthTotals('2026-11');
  assert.equal(november.recordIds.includes('pp-2026-11-atlas'), false);
});

test('every month bridge reconciles exactly to the net change', () => {
  for (const period of PERIODS.slice(1)) assert.equal(bridgeReconciles(period), true, period);
  assert.deepEqual(
    netChangeBridge('2026-10').map(({ id, valueMinor }) => [id, valueMinor]),
    [
      ['client_delta:atlas', -10_000n],
      ['client_delta:lumen', -250_000n],
      ['client_delta:kestrel', -90_000n],
      ['refund_delta', -15_000n],
      ['fee_delta', 12_264n],
    ],
  );
});

test('confirming the open receipt assigns its linked refund and changes the hourly rate', () => {
  const before = activityRows('2026-10', initialWorkspaceState);
  assert.equal(before.find((row) => row.id === 'consulting')?.netMinor, 86_810n);
  assert.deepEqual(
    unassignedSales(initialWorkspaceState).map((record) => record.id),
    ['pp-2026-10-atlas', 'pp-2026-11-orbit'],
  );
  const state = {
    ...initialWorkspaceState,
    confirmedActivityIds: { 'pp-2026-10-atlas': 'consulting' as const },
  };
  const consulting = activityRows('2026-10', state).find((row) => row.id === 'consulting');
  assert.equal(consulting?.netMinor, 235_828n);
  assert.equal(consulting?.perHour, '107.19');
  assert.deepEqual(consulting?.recordIds, [
    'pp-2026-10-atlas',
    'pp-2026-10-atlas-refund',
    'pp-2026-10-kestrel',
  ]);
});

test('effective hourly rate uses profit and edited hours', () => {
  assert.equal(effectiveHourlyRate('2026-10', initialWorkspaceState)?.toFixed(2), '69.98');
  const edited = { ...initialWorkspaceState, hours: { '2026-10': { design: '30.00' } } };
  assert.equal(effectiveHourlyRate('2026-10', edited)?.toFixed(2), '88.96');
});

test('balance, forecast, tax and health are deterministic', () => {
  assert.deepEqual(balanceSummary(), {
    availableMinor: 809_042n,
    pendingMinor: 183_320n,
    heldForReviewMinor: 500_000n,
    pendingRecordIds: ['pp-2026-11-atlas'],
  });
  const forecast = forecast30Days('2026-10');
  assert.equal(forecast.runRateMinor, 665_532n);
  assert.equal(forecast.invoicedMinor, 905_000n);
  assert.equal(forecast.overdueMinor, 320_000n);
  assert.equal(taxSetAside('2026-10', initialWorkspaceState), 131_221n);
  assert.deepEqual(
    invoiceViews().map((invoice) => invoice.status),
    ['overdue', 'due-soon', 'scheduled', 'scheduled'],
  );
  const health = incomeHealth('2026-10');
  assert.equal(health.score, 60);
  assert.equal(
    health.components.reduce((sum, component) => sum + component.score, 0),
    health.score,
  );
});

test('client shares cover all twelve-month gross', () => {
  const clients = clientSummaries('2026-10');
  assert.equal(clients[0]?.id, 'northstar');
  const totalGross = monthlySeries().reduce((sum, month) => sum + month.grossMinor, 0n);
  assert.equal(
    clients.reduce((sum, client) => sum + client.grossMinor, 0n),
    totalGross,
  );
});
