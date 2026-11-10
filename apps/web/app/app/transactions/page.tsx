import { Transactions, type Filter } from '../../../src/features/workspace/Transactions';

export const metadata = { title: 'Transactions · FinSig' };

const allowed: Filter[] = ['all', 'income', 'refunds', 'expenses', 'transfers', 'review', 'live'];

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; record?: string }>;
}) {
  const params = await searchParams;
  const filter = allowed.includes(params.filter as Filter) ? (params.filter as Filter) : 'all';
  const query = (params.q ?? '').slice(0, 80);
  const record = params.record?.slice(0, 80) ?? null;
  return (
    <Transactions
      key={`${filter}:${query}:${record}`}
      initialFilter={filter}
      initialQuery={query}
      initialRecordId={record}
    />
  );
}
