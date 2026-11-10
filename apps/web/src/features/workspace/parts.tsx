'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CircleAlert,
  Landmark,
  ReceiptText,
  RotateCcw,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { clients, type ClientId, type WorkspaceRecord } from '../../domain/workspace';

export function ClientAvatar({ clientId, size = 36 }: { clientId: ClientId; size?: number }) {
  const client = clients.find((item) => item.id === clientId);
  if (!client) return null;
  return (
    <span
      className="client-avatar"
      style={{ width: size, height: size, background: `${client.color}1f`, color: client.color }}
      aria-hidden="true"
    >
      {client.initials}
    </span>
  );
}

export function RecordIcon({ record }: { record: WorkspaceRecord }) {
  const incoming = record.amountMinor >= 0n;
  if (record.clientId && record.kind === 'sale') return <ClientAvatar clientId={record.clientId} />;
  const icon =
    record.kind === 'refund' ? (
      <RotateCcw size={16} />
    ) : record.kind === 'expense' ? (
      <ReceiptText size={16} />
    ) : record.kind === 'withdrawal' ? (
      <Landmark size={16} />
    ) : record.kind === 'review' ? (
      <CircleAlert size={16} />
    ) : incoming ? (
      <ArrowDownLeft size={16} />
    ) : (
      <ArrowUpRight size={16} />
    );
  return <span className={`record-icon is-${record.kind}`}>{icon}</span>;
}

export function StatusPill({
  record,
  short = false,
}: {
  record: WorkspaceRecord;
  short?: boolean;
}) {
  if (record.kind === 'review') return <span className="pill is-warning">In review</span>;
  if (record.status === 'P') return <span className="pill is-brand">Pending</span>;
  if (record.kind === 'refund') return <span className="pill is-danger">Refund</span>;
  return <span className="pill">{short ? 'Done' : 'Completed'}</span>;
}

export const eventCodeMeaning: Record<string, string> = {
  T0006: 'PayPal Checkout payment',
  T1107: 'Payment refund',
  T0002: 'Subscription payment',
  T0400: 'General withdrawal',
  T1900: 'Account correction',
};

export function Delta({ ratio, invert = false }: { ratio: number | null; invert?: boolean }) {
  if (ratio === null || !Number.isFinite(ratio)) return null;
  const up = ratio >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`delta ${good ? 'is-good' : 'is-bad'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
      {new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(
        Math.abs(ratio),
      )}
    </span>
  );
}

export function CardHeader({
  title,
  eyebrow,
  icon,
  action,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="card-header">
      <div className="card-header__title">
        {icon ? <span className="card-header__icon">{icon}</span> : null}
        <div>
          {eyebrow ? <p className="card-header__eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
        </div>
      </div>
      {action ? <div className="card-header__action">{action}</div> : null}
    </header>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="empty-note">
      <Building2 size={14} /> {children}
    </p>
  );
}
