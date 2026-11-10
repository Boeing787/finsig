# FinSig

FinSig is a financial cockpit demo for freelancers who get paid through PayPal. Its dashboard and AI
insights use a fictional 12-month sample history. PayPal sandbox OpenID Connect verifies a sign-in
identity; it does not grant access to that person's transaction history. Separately, when configured,
PayPal Transaction Search reads the sandbox merchant attached to FinSig's developer app. Those live
records are labelled and shown separately from the sample analytics. Claude explains and categorises;
code calculates every amount and every AI claim must cite verified metrics and source record IDs.

## Judge path

Open the [live app](https://finsig-demo.onrender.com) → **Explore the demo workspace** (or go
straight to [/demo](https://finsig-demo.onrender.com/demo)). No credentials are needed; the demo
workspace is a fictional freelancer with twelve months of PayPal-shaped records. Locally, run
`pnpm dev` and open `http://localhost:3000`.

1. **Sign in & sync.** The sign-in screen offers _Continue with PayPal_ (OpenID Connect identity
   verification, sandbox) and a one-click demo. The sync screen shows the configured app merchant's
   live read, if available, and separate checks against the fictional sample history. AI suggestions
   run only after the judge chooses _Suggest with AI_.
2. **Dashboard.** Sample balance (available / pending / tax reserve), KPI cards with sparklines, a
   12-month cash-flow chart (click any month to re-run every widget), effective-hourly-rate trend,
   client mix, monthly goal gauge, upcoming invoices and the latest sample activity.
3. **Needs a category.** Click _Suggest with AI_ on an unassigned payment. Claude proposes an activity
   with quoted PayPal fields; you confirm. The linked refund follows and per-hour figures change.
4. **AI Insights.** Ask _“Why did the sample net income change this month?”_. Each claim shows the
   code-rendered sample metrics it relies on and links to the source records behind it. The exact bridge,
   the income-health score and the 30-day plan sit below; edit hours to see the rates move.
5. **Transactions.** An AG Grid ledger with filters, search, CSV export and a source drawer for every
   record. The _Live sandbox_ filter shows records read live from the sandbox merchant configured
   for FinSig.
6. **Income investigation.** _“Why did October net income fall by $3,527.36?”_ answered as a verified
   bridge (a custom AG Studio widget) beside the PayPal records behind each factor. Select a factor to
   narrow the evidence, or ask FinSig to investigate. _Customize analysis_ opens the AG Studio editor
   and its agent on the same investigation.
7. **Security.** What FinSig can read, what it can never do, and where data lives.

## PayPal integration

- **Log in with PayPal** (`/api/auth/paypal/start` → `/api/auth/paypal/callback`): OpenID Connect
  authorisation-code flow with a `state` cookie. The code is exchanged server-side, the profile is
  read once, and the PayPal access token is discarded. FinSig stores only an 8-hour, HMAC-signed,
  httpOnly session cookie.
- **Transaction Search** (`/api/paypal/sync`): live, read-only reads using the developer app's
  client credentials for its configured sandbox merchant over the last 90 days in 30-day windows,
  normalised by the same code as the importer. This API credential is not delegated from the
  PayPal identity that signed in.
  Buyer names, emails and raw transaction IDs never leave the server.
- **Importer CLI**: the original first-party sandbox importer with idempotent composite keys, see
  below and the [capture/refund verification log](docs/reporting-gate.md).

FinSig does not connect arbitrary PayPal accounts: delegated merchant onboarding is not available
from Ukraine, so live reads cover the sandbox merchant attached to the app. The demo workspace uses
fictional records with the same pipeline.

## AI

The Anthropic key is server-only. Claude (1) suggests an activity for unassigned receipts from quoted
PayPal fields, (2) answers free-form questions by choosing among ~60 code-calculated metrics — claims
containing digits or currency symbols, unknown metric IDs, or records outside the cited metrics are
rejected — and (3) operates AG Studio through the Agent Framework. The person's own confirmations,
hours and preferences are validated server-side and used only to recompute metrics in code.

### Configuration

| Variable                                                   | Purpose                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`                     | Server-only Claude access                                                             |
| `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET` | Sandbox REST app with Transaction Search (enables live sync)                          |
| `PAYPAL_LOGIN_ENABLED=true`                                | Turns on _Continue with PayPal_ once _Log in with PayPal_ is enabled for the app      |
| `APP_BASE_URL`                                             | Public origin used for the PayPal return URL, e.g. `https://finsig-demo.onrender.com` |
| `SESSION_SECRET`                                           | 32+ character HMAC key for sessions (derived from another server secret if unset)     |
| `NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY`                        | AG Studio client license string                                                       |

To enable PayPal sign-in: in the PayPal developer dashboard open the sandbox app → **Log in with
PayPal** → enable it, request _Full name_ and _Email_, and add the return URL
`${APP_BASE_URL}/api/auth/paypal/callback`. Sign in with a sandbox **personal** account.

See the [AG Studio implementation notes](docs/ag-studio.md) and [FinSig design system](docs/design-system.md).

## Workspace

- `apps/web` — Next.js application.
- `packages/ui` — FinSig tokens, generic controls, composed financial UI, and the TanStack-based
  application table.
- `packages/eslint-config` — shared flat ESLint configuration.
- `packages/typescript-config` — shared TypeScript configuration.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

To test AI locally, add `ANTHROPIC_API_KEY` to the ignored root `.env.local`. Add the trial key as
`NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY`; this is a client license string, never a provider secret. Without AI, the
demo still shows calculations and manual classification, but AI actions return an explicit
configuration error. The main demo API accepts only fixed tasks. The Studio AI proxy accepts the
Agent Framework protocol, rate-limits calls, and translates only declared client tools.
The [Render Blueprint](render.yaml) provisions a Node web service and prompts for the key.
For API deployment, set `RENDER_API_KEY` in the ignored `.env.local` and run
`RENDER_PLAN=free node scripts/deploy-render.mjs`. If the key can access multiple Render workspaces,
also set `RENDER_OWNER_ID`. The script creates a Frankfurt service, sends the Anthropic key as a
server-side environment variable, and refuses to create a second service with the same name.
The current demo uses Render Free because Starter requires a payment method, even with promotional
credits. Free services spin down after 15 minutes of inactivity and can take about a minute to wake.
Switch to Starter before judging for a consistently responsive demo.

Run a command for one workspace with pnpm filters:

```bash
pnpm --filter @finsig/web dev
```

The [reporting gate](docs/reporting-gate.md) records the PayPal sandbox access test.
The [interview guide](docs/user-interviews.md) covers the first user conversations.
The [AWS access guide](docs/aws-access.md) documents the isolated project profile and account guard.
The [Terraform infrastructure](infra/README.md) contains the modular AWS baseline and apply sequence.

## CI and deployment

GitHub Actions classifies changes, runs formatting, lint and type checks, then
selectively runs tests, build, Flyway migration checks and Terraform validation.
The single `ci-gate` job fails if a required check fails. A successful `main`
push triggers [Render deployment](.github/workflows/infra-deploy.yml) of that
exact commit, followed by an HTTP smoke check of `/demo` (the static demo entry page). A newer `main` commit
supersedes an older deployment. Configure `RENDER_API_KEY` as a repository secret
and `RENDER_SERVICE_ID` as a repository variable; do not commit either key.

The optional [AWS deployment identity](infra/deploy-identity/README.md) is
separate from Render. AWS Terraform is syntax-checked in CI but is not
auto-applied to the account while the AWS app stack remains a baseline.

## Local reporting and calculations

Use Node 22+ and Docker Desktop. Put the sandbox app credentials in the ignored root
`.env.local` file. The `DATABASE_URL` value is optional for the local Compose database;
set it explicitly for another PostgreSQL instance. The default Compose password is
development-only. Do not expose this database or the current CLI flow publicly.

```bash
docker compose up -d postgres
pnpm db:migrate
pnpm --filter @finsig/web paypal:import
pnpm --filter @finsig/web finsig:records
pnpm --filter @finsig/web finsig:summary 2026-11
```

The importer reads a seven-day window, fetches every Reporting page, stores source
records, and upserts by a composite source key. Re-running `paypal:import` should
return `inserted: 0` when no new reporting rows exist. `T0006` positive receipts
count as sales, `T1107` negative refunds reduce them, and other events, including
`T1900` account corrections, remain in review. Only status `S` contributes to the
cash summary. Unknown fees, hours, and direct costs are represented separately.

Database changes are versioned with Flyway. See the [migration guide](docs/MIGRATIONS.md); never
edit a migration that has already been applied.

For a local classification and work-input check, use UUIDs from `finsig:records`:

```bash
pnpm --filter @finsig/web finsig:confirm <record-uuid> 'Sandbox test' 'Sandbox buyer'
pnpm --filter @finsig/web finsig:work 'Sandbox test' 2026-11 2 0.50
pnpm --filter @finsig/web finsig:summary 2026-11
```

When a refund references a confirmed sale, another import proposes the same
activity for that refund; it still requires confirmation. No PayPal transaction
is changed by classification or work inputs.

## License

MIT. See [LICENSE](LICENSE).
