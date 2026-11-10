'use client';

import { Sparkline } from '@finsig/ui';
import { ArrowRight, Repeat, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import {
  clientSummaries,
  incomeHealth,
  invoiceViews,
  longDate,
  money,
  monthLong,
  percent,
} from '../../domain/workspace';
import { ClientAvatar } from './parts';
import { useWorkspace } from './WorkspaceProvider';

export function Clients() {
  const { period } = useWorkspace();
  const clients = clientSummaries(period);
  const invoices = invoiceViews();
  const health = incomeHealth(period);
  const diversification = health.components.find(
    (component) => component.id === 'diversification',
  )!;
  const recurring = health.components.find((component) => component.id === 'recurring')!;
  const top = clients[0]!;
  const topMonthly = money(top.netMinor / 12n, { cents: false });
  return (
    <div className="page clients-page">
      <section className="page-intro">
        <div>
          <h1>Clients</h1>
          <p>
            Fictional sample-client analysis: revenue, payment patterns and concentration through{' '}
            {monthLong(period)}.
          </p>
        </div>
      </section>

      <div className="insight-strip">
        <div className="card insight-tile is-warning">
          <ShieldAlert size={18} />
          <div>
            <strong>Concentration · {diversification.score}/25</strong>
            <span>
              {top.name} brings {percent(top.share, 0)} of gross. A pause there would remove{' '}
              {topMonthly} of net income a month.
            </span>
          </div>
        </div>
        <div className="card insight-tile is-brand">
          <Repeat size={18} />
          <div>
            <strong>Recurring income · {recurring.score}/25</strong>
            <span>{recurring.detail}. Retainers smooth the months between milestones.</span>
          </div>
        </div>
        <Link
          className="card insight-tile is-ai"
          href={`/app/insights?q=${encodeURIComponent('Am I too dependent on one client?')}`}
        >
          <ArrowRight size={18} />
          <div>
            <strong>Ask FinSig about client risk</strong>
            <span>Grounded answer citing sample source records</span>
          </div>
        </Link>
      </div>

      <div className="client-grid">
        {clients.map((client) => {
          const open = invoices.filter((invoice) => invoice.clientId === client.id);
          const average = client.payments ? client.grossMinor / BigInt(client.payments) : 0n;
          return (
            <article key={client.id} className="card client-card">
              <header>
                <ClientAvatar clientId={client.id} size={44} />
                <div>
                  <h2>{client.name}</h2>
                  <span className="pill">{client.engagement}</span>
                </div>
              </header>
              <div className="client-card__value">
                <strong>{money(client.netMinor, { cents: false })}</strong>
                <span>net income · 12 months</span>
              </div>
              <div className="share-bar" aria-label={`${percent(client.share, 0)} of gross`}>
                <i
                  style={{ width: `${Math.max(2, client.share * 100)}%`, background: client.color }}
                />
              </div>
              <div className="client-card__meta">
                <span>
                  <strong>{percent(client.share, 0)}</strong> of gross
                </span>
                <span>
                  <strong>{client.payments}</strong> payments
                </span>
                <span>
                  <strong>{money(average, { cents: false })}</strong> average
                </span>
              </div>
              <div className="client-card__trend">
                <Sparkline
                  values={client.monthlyNetMinor.map((value) => Number(value) / 100)}
                  color={client.color}
                  width={250}
                  height={44}
                  ariaLabel={`${client.name} monthly net income`}
                />
              </div>
              <footer>
                <span>Last paid {client.lastPaidAt ? longDate(client.lastPaidAt) : '—'}</span>
                {open.map((invoice) => (
                  <span
                    key={invoice.id}
                    className={`pill ${invoice.status === 'overdue' ? 'is-danger' : invoice.status === 'due-soon' ? 'is-warning' : 'is-brand'}`}
                  >
                    {money(invoice.amountMinor, { cents: false })}{' '}
                    {invoice.status === 'overdue' ? 'overdue' : 'invoiced'}
                  </span>
                ))}
                <Link
                  className="text-link"
                  href={`/app/transactions?q=${encodeURIComponent(client.name)}`}
                >
                  Payments <ArrowRight size={13} />
                </Link>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
