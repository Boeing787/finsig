import { Wallet } from 'lucide-react';

/**
 * Log in with PayPal (OpenID Connect). Rendered only when the deployment has it switched on;
 * otherwise the sign-in screen offers the demo workspace alone instead of an unfinished button.
 */
export function PayPalSignIn() {
  return (
    <a className="paypal-button" href="/api/auth/paypal/start">
      <Wallet size={18} />
      <span>Continue with PayPal</span>
    </a>
  );
}
