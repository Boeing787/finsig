'use client';

import {
  Ban,
  Check,
  Cookie,
  Eye,
  KeyRound,
  LogOut,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { money } from '../../domain/workspace';
import { CardHeader } from './parts';
import { useWorkspace } from './WorkspaceProvider';

export function Settings() {
  const { user, live, state, setTaxRate, setGoal, reset } = useWorkspace();
  const [taxError, setTaxError] = useState<string | null>(null);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);
  const goalUsd = Number(state.monthlyGoalMinor / 100n);
  const expires = new Date(user.expiresAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <div className="page settings-page">
      <section className="page-intro">
        <div>
          <h1>Security & connection</h1>
          <p>What FinSig can see, what it can never do, and which figures are sample data.</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="fs-button fs-button--quiet">
            <LogOut size={15} /> Sign out
          </button>
        </form>
      </section>

      <div className="settings-grid">
        <section className="card connection-card">
          <CardHeader
            title={user.mode === 'paypal' ? 'Verified PayPal identity' : 'Demo workspace'}
            eyebrow={
              user.mode === 'paypal' ? 'Signed in with PayPal (sandbox)' : 'Signed demo session'
            }
            icon={<Wallet size={16} />}
            action={
              <span className="pill is-success">
                <Check size={12} /> Active
              </span>
            }
          />
          <dl className="kv">
            <div>
              <dt>Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email ?? 'Not shared'}</dd>
            </div>
            <div>
              <dt>PayPal payer ID</dt>
              <dd>
                {user.payerId ?? (user.mode === 'demo' ? 'Fictional workspace' : 'Not returned')}
              </dd>
            </div>
            <div>
              <dt>Sign-in method</dt>
              <dd>
                {user.mode === 'paypal'
                  ? 'PayPal OpenID Connect · scopes openid, profile, email'
                  : 'One-click demo · no PayPal credentials'}
              </dd>
            </div>
            <div>
              <dt>Session expires</dt>
              <dd>{expires}</dd>
            </div>
            <div>
              <dt>Transaction sync</dt>
              <dd>
                {live.status === 'ready'
                  ? `Configured app sandbox merchant · ${live.result.records.length} live records; separate from sample analytics`
                  : live.status === 'unconfigured'
                    ? 'Not configured on this deployment'
                    : live.status === 'error'
                      ? 'Temporarily unavailable'
                      : 'Checking…'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="card permissions-card">
          <CardHeader
            title="Permissions"
            eyebrow="Least privilege by design"
            icon={<ShieldCheck size={16} />}
          />
          <ul className="permission-list">
            <li className="is-allowed">
              <Eye size={16} />
              <div>
                <strong>Read your PayPal identity</strong>
                <span>Name, email and payer ID — once, at sign-in.</span>
              </div>
            </li>
            <li className="is-allowed">
              <Eye size={16} />
              <div>
                <strong>Read transaction history</strong>
                <span>
                  The app reads its configured sandbox merchant with app credentials. This is not
                  linked to the PayPal identity above or used by the sample analytics.
                </span>
              </div>
            </li>
            <li className="is-blocked">
              <Ban size={16} />
              <div>
                <strong>Send, refund or move money</strong>
                <span>FinSig never requests these scopes. No PayPal transaction is changed.</span>
              </div>
            </li>
            <li className="is-blocked">
              <Ban size={16} />
              <div>
                <strong>See your PayPal password</strong>
                <span>You sign in on paypal.com; FinSig only receives a one-time code.</span>
              </div>
            </li>
          </ul>
        </section>

        <section className="card data-card">
          <CardHeader
            title="Where your data lives"
            eyebrow="Data handling"
            icon={<ServerCog size={16} />}
          />
          <ul className="permission-list">
            <li>
              <Cookie size={16} />
              <div>
                <strong>Signed, httpOnly session cookie</strong>
                <span>
                  HMAC-SHA256, 8 hours, SameSite=Lax, Secure in production. Not readable by scripts.
                </span>
              </div>
            </li>
            <li>
              <KeyRound size={16} />
              <div>
                <strong>No stored PayPal tokens</strong>
                <span>
                  The access token from sign-in is used once for your profile and discarded.
                </span>
              </div>
            </li>
            <li>
              <ShieldCheck size={16} />
              <div>
                <strong>Sanitised sync</strong>
                <span>
                  Buyer names, emails and raw transaction IDs stay on the server; IDs are hashed.
                </span>
              </div>
            </li>
            <li>
              <Sparkles size={16} />
              <div>
                <strong>AI sees metrics, not credentials</strong>
                <span>
                  Claude receives code-calculated metrics and record descriptions. Answers that cite
                  unknown data or write their own numbers are rejected.
                </span>
              </div>
            </li>
          </ul>
        </section>

        <section className="card prefs-card" id="preferences">
          <CardHeader title="Planning preferences" eyebrow="Stored only in this browser" />
          <label className="pref-field">
            <span>Tax set-aside (% of profit)</span>
            <input
              inputMode="numeric"
              defaultValue={state.taxRatePercent}
              key={`tax-${state.taxRatePercent}`}
              onBlur={(event) => setTaxError(setTaxRate(event.target.value))}
            />
            {taxError ? (
              <small className="is-error">{taxError}</small>
            ) : (
              <small>Used for the tax reserve and set-aside figures.</small>
            )}
          </label>
          <label className="pref-field">
            <span>Monthly net income goal (USD)</span>
            <input
              inputMode="numeric"
              defaultValue={goalUsd}
              key={`goal-${state.monthlyGoalMinor}`}
              onBlur={(event) => setGoalError(setGoal(event.target.value))}
            />
            {goalError ? (
              <small className="is-error">{goalError}</small>
            ) : (
              <small>
                Currently {money(state.monthlyGoalMinor, { cents: false })} — drives the goal gauge.
              </small>
            )}
          </label>
          <button
            type="button"
            className="fs-button fs-button--quiet"
            onClick={() => {
              reset();
              setResetDone(true);
            }}
          >
            <RotateCcw size={14} /> Reset workspace choices
          </button>
          {resetDone ? (
            <p className="callout is-success">Confirmations, hours and preferences were reset.</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
