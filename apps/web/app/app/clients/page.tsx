import { Clients } from '../../../src/features/workspace/Clients';

export const metadata = { title: 'Clients · FinSig' };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  return <Clients key={focus ?? 'all'} focusClientId={focus?.slice(0, 40) ?? null} />;
}
