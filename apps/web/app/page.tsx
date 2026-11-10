import {
  ArrowRight,
  BadgeCheck,
  Bot,
  ChartNoAxesCombined,
  Lock,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { Logo } from '../src/features/auth/Logo';

const features = [
  {
    icon: RefreshCw,
    title: 'PayPal sandbox reporting',
    body: 'PayPal sign-in verifies identity. Separately, Transaction Search reads the merchant configured for FinSig; fictional sample history powers dashboard analytics.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Analytics that reconcile',
    body: 'Net income, effective hourly rate, client concentration and a 30-day outlook. Every bridge adds up to the cent.',
  },
  {
    icon: Bot,
    title: 'AI you can audit',
    body: 'Claude explains and categorises. Every claim cites verified metrics and source record IDs; code renders every number.',
  },
  {
    icon: Lock,
    title: 'Secure by design',
    body: 'Read-only merchant reporting, no stored PayPal password or token, signed short sessions. FinSig can never move your money.',
  },
];

export default function HomePage() {
  return (
    <main className="landing">
      <header className="landing__nav">
        <Logo />
        <nav>
          <a href="https://github.com/dmrvcodes/finsig" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <Link href="/login" className="fs-button fs-button--primary fs-button--sm">
            Sign in
          </Link>
        </nav>
      </header>

      <section className="landing__hero">
        <span className="landing__badge">
          <Wallet size={14} /> Built on the PayPal developer platform · AI by Claude
        </span>
        <h1>
          Know what your freelance work <em>really</em> earns.
        </h1>
        <p>
          FinSig turns a fictional freelancer history into net income, hourly rates and client risk.
          Optional live reads from the FinSig sandbox merchant stay separate and traceable.
        </p>
        <div className="landing__actions">
          <Link className="paypal-button" href="/login">
            <Wallet size={18} /> Sign in with PayPal
          </Link>
          <Link className="fs-button fs-button--quiet fs-button--lg" href="/demo">
            Explore the live demo <ArrowRight size={16} />
          </Link>
        </div>
        <ul className="landing__proof">
          <li>
            <BadgeCheck size={14} /> 12-month bridges reconcile to the cent
          </li>
          <li>
            <BadgeCheck size={14} /> AI answers cite source record IDs
          </li>
          <li>
            <BadgeCheck size={14} /> Read-only — never moves money
          </li>
        </ul>
      </section>

      <section className="landing__features" aria-label="What FinSig does">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <article key={feature.title} className="card">
              <span className="card-header__icon">
                <Icon size={17} />
              </span>
              <h2>{feature.title}</h2>
              <p>{feature.body}</p>
            </article>
          );
        })}
      </section>

      <section className="landing__steps card">
        <h2>From PayPal sign-in to a decision in under a minute</h2>
        <ol>
          <li>
            <strong>1 · Sign in with PayPal</strong>
            <span>
              OpenID Connect on PayPal verifies your sandbox identity. FinSig receives your name,
              email and PayPal account ID, never your password.
            </span>
          </li>
          <li>
            <strong>2 · FinSig syncs and reconciles</strong>
            <span>
              Transaction Search reads the sandbox merchant configured for FinSig. It is separate
              from your sign-in identity and the sample analytics.
            </span>
          </li>
          <li>
            <strong>3 · Ask, confirm, plan</strong>
            <span>
              AI suggests categories for sample records and explains changes. You confirm; sample
              hourly-rate analytics update.
            </span>
          </li>
        </ol>
        <Link className="fs-button fs-button--primary fs-button--lg" href="/demo">
          Open the demo workspace <ArrowRight size={16} />
        </Link>
      </section>

      <footer className="landing__foot">
        Hackathon prototype on the PayPal sandbox · demo data is fictional · MIT licensed
      </footer>
    </main>
  );
}
