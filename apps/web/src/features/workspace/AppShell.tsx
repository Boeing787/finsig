'use client';

import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Bot,
  CalendarClock,
  ChartNoAxesCombined,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  balanceSummary,
  invoiceViews,
  money,
  monthLong,
  PERIODS,
  unassignedSales,
  type Period,
} from '../../domain/workspace';
import { BrandMark, Logo } from '../auth/Logo';
import { OverlayProvider, Scrim, useOverlay } from './overlay';
import { useWorkspace } from './WorkspaceProvider';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: 'review' | 'overdue';
  ai?: boolean;
}

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [
      { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/app/transactions', label: 'Transactions', icon: ArrowLeftRight, badge: 'review' },
      { href: '/app/clients', label: 'Clients', icon: Users, badge: 'overdue' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/app/insights', label: 'AI Insights', icon: Sparkles, ai: true },
      { href: '/app/studio', label: 'Report studio', icon: ChartNoAxesCombined },
    ],
  },
  {
    label: 'Account',
    items: [{ href: '/app/settings', label: 'Security', icon: ShieldCheck }],
  },
];

const allItems = sections.flatMap((section) => section.items);

function initials(name: string) {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function isActive(pathname: string, href: string) {
  return href === '/app' ? pathname === '/app' : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <OverlayProvider>
      <Shell>{children}</Shell>
    </OverlayProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { active, close } = useOverlay();
  const isStudio = pathname.startsWith('/app/studio');
  return (
    <div className={`app-shell ${isStudio ? 'is-studio' : ''}`}>
      <Sidebar />
      {active === 'nav' ? <Scrim className="is-nav" onClose={() => close('nav')} /> : null}
      <div className="app-main">
        <Topbar />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { user, state, live, syncNow } = useWorkspace();
  const { active, close } = useOverlay();
  const counts = {
    review: unassignedSales(state).length,
    overdue: invoiceViews().filter((invoice) => invoice.status === 'overdue').length,
  };
  const syncLabel =
    live.status === 'ready'
      ? `Synced ${new Date(live.result.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      : live.status === 'unconfigured'
        ? 'Live sync off · sample data'
        : live.status === 'error'
          ? 'Sync paused'
          : 'Syncing…';
  return (
    <aside className={`sidebar ${active === 'nav' ? 'is-open' : ''}`} aria-label="Primary">
      <div className="sidebar__panel">
        <div className="sidebar__brand">
          <Link href="/app" aria-label="FinSig dashboard" className="sidebar__logo">
            <Logo height={30} />
            <BrandMark size={46} className="sidebar__mark" />
            <small>Freelance finance</small>
          </Link>
          <button
            type="button"
            className="sidebar__close"
            onClick={() => close('nav')}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {sections.map((section) => (
            <div key={section.label} className="sidebar__section">
              <p className="sidebar__label">{section.label}</p>
              {section.items.map((item) => {
                const current = isActive(pathname, item.href);
                const Icon = item.icon;
                const badge = item.badge ? counts[item.badge] : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`sidebar__link ${current ? 'is-active' : ''} ${item.ai ? 'is-ai' : ''}`}
                    aria-current={current ? 'page' : undefined}
                  >
                    <span className="sidebar__icon">
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <span className="sidebar__text">{item.label}</span>
                    {badge ? (
                      <span
                        className={`sidebar__badge ${item.badge === 'overdue' ? 'is-danger' : 'is-ai'}`}
                        aria-label={`${badge} ${item.badge === 'overdue' ? 'overdue' : 'to review'}`}
                      >
                        {badge}
                      </span>
                    ) : item.ai ? (
                      <span className="sidebar__badge is-tag">AI</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <button
          type="button"
          className={`sidebar__sync is-${live.status}`}
          onClick={() => void syncNow()}
          title="Read the sandbox merchant through PayPal Transaction Search"
        >
          <span className="sidebar__sync-mark">P</span>
          <span className="sidebar__text">
            <strong>PayPal sandbox</strong>
            <small>
              <i className="sidebar__dot" /> {syncLabel}
            </small>
          </span>
          <RefreshCw size={14} className={live.status === 'loading' ? 'is-spinning' : undefined} />
        </button>

        <div className="sidebar__user">
          <span className="avatar" aria-hidden="true">
            {initials(user.name)}
          </span>
          <span className="sidebar__text">
            <strong>{user.name}</strong>
            <small>{user.mode === 'paypal' ? 'Signed in with PayPal' : 'Demo workspace'}</small>
          </span>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="icon-button" aria-label="Sign out" title="Sign out">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { period, setPeriod, live, syncNow } = useWorkspace();
  const { toggle } = useOverlay();
  const [query, setQuery] = useState('');
  const page = allItems.find((item) => isActive(pathname, item.href));

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(
      trimmed ? `/app/transactions?q=${encodeURIComponent(trimmed)}` : '/app/transactions',
    );
  }

  return (
    <header className="topbar">
      <div className="topbar__mobile">
        <button
          type="button"
          className="icon-button"
          onClick={() => toggle('nav')}
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <BrandMark size={34} />
        <strong>{page?.label ?? 'FinSig'}</strong>
      </div>
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
        <Notifications />
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

interface Notice {
  id: string;
  icon: LucideIcon;
  tone: 'danger' | 'ai' | 'warning';
  title: string;
  detail: string;
  destination: string;
  href: string;
}

const seenKey = 'finsig-seen-notices-v1';

function Notifications() {
  const router = useRouter();
  const { state } = useWorkspace();
  const { active, toggle, close } = useOverlay();
  const open = active === 'notifications';
  const root = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const unassigned = unassignedSales(state).length;
  const held = balanceSummary().heldForReviewMinor;

  const notices: Notice[] = [
    ...invoiceViews()
      .filter((invoice) => invoice.status === 'overdue')
      .map((invoice): Notice => ({
        id: `overdue:${invoice.id}`,
        icon: CalendarClock,
        tone: 'danger',
        title: `${invoice.client.name} invoice is ${Math.abs(invoice.daysUntilDue)} days overdue`,
        detail: `${invoice.id} · ${money(invoice.amountMinor)}`,
        destination: `Clients → ${invoice.client.name}`,
        href: `/app/clients?focus=${invoice.clientId}`,
      })),
    ...(unassigned
      ? [
          {
            id: `review:${unassigned}`,
            icon: Bot,
            tone: 'ai' as const,
            title: `${unassigned} payment${unassigned > 1 ? 's need' : ' needs'} a category`,
            detail: 'AI suggests one from the PayPal fields — you confirm',
            destination: 'Transactions → Needs review',
            href: '/app/transactions?filter=review',
          },
        ]
      : []),
    ...(held
      ? [
          {
            id: 'held:pp-2026-10-correction',
            icon: ShieldAlert,
            tone: 'warning' as const,
            title: 'Account correction held for review',
            detail: `${money(held)} excluded from income`,
            destination: 'Transactions → open the record',
            href: '/app/transactions?record=pp-2026-10-correction',
          },
        ]
      : []),
  ];
  const unseen = notices.filter((notice) => !seen.includes(notice.id)).length;

  useEffect(() => {
    const task = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(seenKey);
        if (raw) setSeen(JSON.parse(raw) as string[]);
      } catch {
        // Storage unavailable: every notice simply stays unread.
      }
    }, 0);
    return () => window.clearTimeout(task);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) close('notifications');
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open, close]);

  function onToggle() {
    if (!open) {
      const ids = notices.map((notice) => notice.id);
      setSeen(ids);
      try {
        window.localStorage.setItem(seenKey, JSON.stringify(ids));
      } catch {
        // ignore
      }
    }
    toggle('notifications');
  }

  function go(href: string) {
    close('notifications');
    router.push(href);
  }

  return (
    <div className="notifications" ref={root}>
      <button
        type="button"
        className={`notifications__trigger ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notifications: ${notices.length}, ${unseen} unread`}
        onClick={onToggle}
      >
        <Bell size={18} />
        {unseen ? <span className="notifications__badge">{unseen}</span> : null}
      </button>
      {open ? (
        <div className="notifications__panel" role="dialog" aria-label="Needs your attention">
          <header>
            <strong>Needs your attention</strong>
            <span>{notices.length} open</span>
          </header>
          {notices.length ? (
            notices.map((notice) => {
              const Icon = notice.icon;
              return (
                <button
                  key={notice.id}
                  type="button"
                  className={`notice is-${notice.tone}`}
                  onClick={() => go(notice.href)}
                >
                  <span className="notice__icon">
                    <Icon size={16} />
                  </span>
                  <span className="notice__body">
                    <strong>{notice.title}</strong>
                    <small>{notice.detail}</small>
                    <em>
                      {notice.destination} <ArrowRight size={12} />
                    </em>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="notifications__empty">Nothing needs you right now.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
