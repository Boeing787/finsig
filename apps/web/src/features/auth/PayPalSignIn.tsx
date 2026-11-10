'use client';

import { ArrowRight, Info, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

/** Real OAuth when enabled; otherwise an inline explanation instead of a dead-end redirect. */
export function PayPalSignIn({ enabled }: { enabled: boolean }) {
  const [explain, setExplain] = useState(false);
  if (enabled) {
    return (
      <a className="paypal-button" href="/api/auth/paypal/start">
        <Wallet size={18} />
        <span>Continue with PayPal</span>
      </a>
    );
  }
  return (
    <>
      <button
        type="button"
        className="paypal-button is-unavailable"
        aria-expanded={explain}
        aria-controls="paypal-unavailable"
        onClick={() => setExplain((value) => !value)}
      >
        <Wallet size={18} />
        <span>Continue with PayPal</span>
        <span className="paypal-button__tag">Sandbox setup pending</span>
      </button>
      {explain ? (
        <div id="paypal-unavailable" className="callout is-info" role="status">
          <Info size={14} />
          <div>
            <strong>PayPal sign-in is not switched on for this deployment yet.</strong>
            <span>
              The demo workspace runs the same pipeline, including the live Transaction Search read
              of FinSig’s sandbox merchant.
            </span>
            <Link href="/demo" className="text-link">
              Open the demo workspace <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
