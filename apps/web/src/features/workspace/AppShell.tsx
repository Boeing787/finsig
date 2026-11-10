'use client';

import {
  ArrowLeftRight,
  Bell,
  ChartNoAxesCombined,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  balanceSummary,
  invoiceViews,
  money,
  monthLong,
  PERIODS,
  unassignedSales,
  type Period,
} from '../../domain/workspace';
import { BrandMark } from '../auth/Logo';
import { useWorkspace } from './WorkspaceProvider';

const navigation = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/app/clients', label: 'Clients', icon: Users },
  { href: '/app/insights', label: 'AI Insights', icon: Sparkles },
  { href: '/app/studio', label: 'Studio', icon: ChartNoAxesCombined },
  { href: '/app/settings', label: 'Security', icon: ShieldCheck },
];

function initials(name: string) {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useWorkspace();
  const isStudio = pathname.startsWith('/app/studio');
  return (
    <div className={`app-shell ${isStudio ? 'is-studio' : ''}`}>
      <aside className="app-rail" aria-label="Primary">
        <Link href="/app" className="app-rail__brand" aria-label="FinSig dashboard">
          <BrandMark size={40} />
        </Link>
        <nav className="app-rail__nav">
          {navigation.map((item) => {
            const active =
              item.href === '/app' ? pathname === '/app' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`app-rail__link ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={19} strokeWidth={2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <form action="/api/auth/logout" method="post" className="app-rail__footer">
          <button type="submit" className="app-rail__link" aria-label="Sign out">
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
          <span className="app-rail__avatar" title={user.name}>
            {initials(user.name)}
          </span>
        </form>
      </aside>
      <div className="app-main">
        <Topbar />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}

function Topbar() {
  const router = useRouter();
  const { user, period, setPeriod, live, syncNow, state } = useWorkspace();
  const [query, setQuery] = useState('');

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(
      trimmed ? `/app/transactions?q=${encodeURIComponent(trimmed)}` : '/app/transactions',
    );
  }

  return (
    <header className="topbar">
      <form className="topbar__search" role="search" onSubmit={onSearch}>
        <Search size={16} />
        <input
          aria-label="Search transactions"
          placeholder="Search clients, payments, records…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <kbd>↵</kbd>
      </form>
      <div className="topbar__actions">
        <label className="period-select">
          <span className="sr-only">Reporting month</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
            {[...PERIODS].reverse().map((month) => (
              <option key={month} value={month}>
                {monthLong(month)}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <SyncPill live={live} onSync={() => void syncNow()} />
        <Notifications unassigned={unassignedSales(state).length} />
        <div className="topbar__user">
          <span className="topbar__avatar">{initials(user.name)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>
              {user.mode === 'paypal' ? 'PayPal identity · sample analytics' : 'Demo workspace'}
            </small>
          </div>
        </div>
      </div>
    </header>
  );
}

export function SyncPill({
  live,
  onSync,
}: {
  live: ReturnType<typeof useWorkspace>['live'];
  onSync: () => void;
}) {
  const label =
    live.status === 'loading' || live.status === 'idle'
      ? 'Syncing merchant…'
      : live.status === 'ready'
        ? `Merchant synced · ${new Date(live.result.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
        : live.status === 'unconfigured'
          ? 'Sample data · live sync off'
          : 'Merchant sync paused';
  const tone =
    live.status === 'ready'
      ? 'is-ok'
      : live.status === 'error'
        ? 'is-error'
        : live.status === 'unconfigured'
          ? 'is-muted'
          : 'is-busy';
  return (
    <button
      type="button"
      className={`sync-pill ${tone}`}
      onClick={onSync}
      title="Sync FinSig’s configured sandbox merchant"
    >
      <span className="sync-pill__dot" />
      <span>{label}</span>
      <RefreshCw size={13} className={live.status === 'loading' ? 'is-spinning' : undefined} />
    </button>
  );
}

function Notifications({ unassigned }: { unassigned: number }) {
  const overdue = invoiceViews().filter((invoice) => invoice.status === 'overdue');
  const held = balanceSummary().heldForReviewMinor;
  const items = [
    ...overdue.map((invoice) => ({
      href: '/app/clients',
      title: `${invoice.client.name} invoice is ${Math.abs(invoice.daysUntilDue)} days overdue`,
      detail: `${invoice.id} · ${money(invoice.amountMinor)}`,
      tone: 'danger',
    })),
    ...(unassigned
      ? [
          {
            href: '/app/transactions?filter=review',
            title: `${unassigned} payment${unassigned > 1 ? 's' : ''} need a category`,
            detail: 'AI can suggest one — you confirm',
            tone: 'ai',
          },
        ]
      : []),
    ...(held
      ? [
          {
            href: '/app/transactions?record=pp-2026-10-correction',
            title: 'Account correction held for review',
            detail: `${money(held)} excluded from income`,
            tone: 'warning',
          },
        ]
      : []),
  ];
  return (
    <details className="notifications">
      <summary aria-label={`${items.length} notifications`}>
        <Bell size={18} />
        {items.length ? <span className="notifications__badge">{items.length}</span> : null}
      </summary>
      <div className="notifications__panel">
        <strong>Needs your attention</strong>
        {items.map((item) => (
          <Link key={item.title} href={item.href} className={`notifications__item is-${item.tone}`}>
            <span>{item.title}</span>
            <small>{item.detail}</small>
          </Link>
        ))}
      </div>
    </details>
  );
}
