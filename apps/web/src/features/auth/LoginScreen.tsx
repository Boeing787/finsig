import { ArrowRight, Eye, KeyRound, Lock, Sparkles, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Logo } from './Logo';

export function LoginScreen({
  error,
  signedOut,
  paypalLogin,
  liveSync,
}: {
  error: string | null;
  signedOut: boolean;
  paypalLogin: boolean;
  liveSync: boolean;
}) {
  return (
    <div className="login">
      <section className="login__story" aria-label="About FinSig">
        <Link href="/" aria-label="FinSig home">
          <Logo light />
        </Link>
        <div className="login__pitch">
          <p className="login__kicker">For freelancers paid through PayPal</p>
          <h1>Know what your work really earns.</h1>
          <p>
            FinSig turns PayPal payments, refunds and fees into net income, hourly rates and client
            risk — with AI explanations you can verify, record by record.
          </p>
        </div>
        <div className="login__preview" aria-hidden="true">
          <div className="preview-card is-main">
            <span>Net income · October</span>
            <strong>$5,300.85</strong>
            <div className="preview-bars">
              {[44, 32, 78, 50, 66, 58, 50, 72, 66, 60, 96, 56].map((height, index) => (
                <i
                  key={index}
                  style={{ height: `${height}%` }}
                  className={index === 11 ? 'is-on' : ''}
                />
              ))}
            </div>
          </div>
          <div className="preview-card is-rate">
            <span>Effective rate</span>
            <strong>$69.98/h</strong>
            <em>Consulting pays best</em>
          </div>
          <div className="preview-card is-ai">
            <Sparkles size={14} />
            <p>The missing Lumen Health milestone was the biggest driver of the drop.</p>
            <small>Cites 2 PayPal records</small>
          </div>
        </div>
        <ul className="login__trust">
          <li>
            <Lock size={14} /> PayPal OpenID Connect
          </li>
          <li>
            <Eye size={14} /> Merchant reporting is read-only
          </li>
          <li>
            <KeyRound size={14} /> No PayPal password or token stored
          </li>
        </ul>
      </section>

      <section className="login__panel">
        <div className="login__card">
          <h2>Sign in</h2>
          <p className="login__lede">
            Sign in with a PayPal sandbox identity, or open the fictional sample workspace.
          </p>
          {error ? (
            <p className="callout is-error" role="alert">
              {error}
            </p>
          ) : null}
          {signedOut ? (
            <p className="callout is-success">You are signed out. Your session was cleared.</p>
          ) : null}

          <a className="paypal-button" href="/api/auth/paypal/start">
            <Wallet size={18} />
            <span>Continue with PayPal</span>
          </a>
          <p className="login__hint">
            {paypalLogin
              ? 'Sandbox sign-in verifies your identity only; it does not connect that account’s transaction history.'
              : 'PayPal sandbox sign-in is not enabled on this deployment yet.'}
          </p>
          <p className="login__hint">
            Live Transaction Search, when configured, reads FinSig’s sandbox merchant account and
            stays separate from the sample analytics below.
          </p>

          <div className="login__divider">
            <span>or</span>
          </div>

          <Link className="demo-button" href="/demo">
            <div>
              <strong>Explore the demo workspace</strong>
              <span>One click · fictional freelancer · 12 months of data</span>
            </div>
            <ArrowRight size={18} />
          </Link>

          <ul className="login__security">
            <li>
              <Lock size={15} />
              <div>
                <strong>Your PayPal password never reaches FinSig</strong>
                <span>
                  Sign-in happens on PayPal. FinSig receives your name, email and PayPal account ID.
                </span>
              </div>
            </li>
            <li>
              <Eye size={15} />
              <div>
                <strong>Read-only by design</strong>
                <span>
                  FinSig cannot send, refund or move money. AI only suggests; you confirm.
                </span>
              </div>
            </li>
            <li>
              <KeyRound size={15} />
              <div>
                <strong>Short, signed session</strong>
                <span>
                  An 8-hour httpOnly cookie. The sign-in token is discarded after reading your
                  profile;{' '}
                  {liveSync
                    ? 'live transactions come from FinSig’s configured sandbox merchant.'
                    : 'live Transaction Search is not configured on this deployment.'}
                </span>
              </div>
            </li>
          </ul>
        </div>
        <p className="login__legal">
          Hackathon prototype on the PayPal sandbox. Demo data is fictional.{' '}
          <a href="https://github.com/dmrvcodes/finsig" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </p>
      </section>
    </div>
  );
}
