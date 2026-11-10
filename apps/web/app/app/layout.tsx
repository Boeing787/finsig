import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { maskEmail, readSessionToken, SESSION_COOKIE } from '../../src/auth/session';
import { AppShell } from '../../src/features/workspace/AppShell';
import {
  WorkspaceProvider,
  type SessionUser,
} from '../../src/features/workspace/WorkspaceProvider';

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect('/login');
  const user: SessionUser = {
    mode: session.mode,
    name: session.name,
    email: maskEmail(session.email),
    payerId: session.payerId
      ? `${session.payerId.slice(0, 3)}•••${session.payerId.slice(-2)}`
      : null,
    expiresAt: session.exp * 1000,
  };
  return (
    <WorkspaceProvider user={user}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
