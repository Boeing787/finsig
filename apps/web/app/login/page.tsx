import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSessionToken, SESSION_COOKIE } from '../../src/auth/session';
import { LoginScreen } from '../../src/features/auth/LoginScreen';
import { paypalLoginEnabled, paypalSyncEnabled } from '../../src/paypal/identity';

export const metadata = { title: 'Sign in · FinSig' };

const errors: Record<string, string> = {
  paypal_unavailable:
    'PayPal sign-in is not enabled on this deployment yet. Use the demo workspace to explore FinSig.',
  paypal_denied: 'PayPal sign-in was cancelled. Nothing was shared with FinSig.',
  paypal_state: 'That sign-in link expired or was already used. Please try again.',
  paypal_exchange: 'PayPal could not confirm the sign-in. Please try again.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; signedOut?: string }>;
}) {
  const params = await searchParams;
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (session && !params.error) redirect('/app');
  return (
    <LoginScreen
      error={params.error ? (errors[params.error] ?? 'Sign-in failed. Please try again.') : null}
      signedOut={params.signedOut === '1'}
      paypalLogin={paypalLoginEnabled()}
      liveSync={paypalSyncEnabled()}
    />
  );
}
