import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSessionToken, SESSION_COOKIE } from '../../src/auth/session';
import { ConnectFlow } from '../../src/features/auth/ConnectFlow';

export const metadata = { title: 'Preparing workspace · FinSig' };

export default async function ConnectPage() {
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect('/login');
  return <ConnectFlow mode={session.mode} name={session.name} />;
}
