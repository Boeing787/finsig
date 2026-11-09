# FinSig

FinSig turns PayPal activity, work time, and known costs into explainable financial
signals for independent professionals.

## Judge path

The [interactive demo](https://finsig-demo.onrender.com/demo) needs no login and uses a fictional
workspace. The [AG Studio income control room](https://finsig-demo.onrender.com/demo/studio) is the
primary judge path. For local development, run `pnpm dev` and open `http://localhost:3000/demo`.

1. **AG Studio:** open the report builder, inspect the custom net-change bridge and source ledger,
   then ask the built-in agent to explain the decline and show the evidence. Switch to edit mode to
   resize, configure, and add widgets; use **Reset demo** to restore the authored report.
2. **Overview:** compare September and October, inspect the exact cash bridge, then ask Claude for a source-grounded explanation.
3. **Activities:** ask Claude to classify the unassigned receipt; inspect its evidence and confirm the suggestion yourself. The linked refund follows that assignment. Edit hours and known costs to see the contribution per hour change.
4. **Manager:** inspect the deterministic 30-day run-rate scenario and the cash-trend alert.
5. **Sources:** inspect the normalized records, including the `T1900` account correction excluded from revenue.

The public demo contains synthetic records and stores each visitor's choices in that browser's local storage. The actual PayPal integration is a first-party sandbox Transaction Search importer. Its [capture/refund verification log](docs/reporting-gate.md) records the observed API events and fee. FinSig does not connect arbitrary PayPal accounts from Ukraine. The Anthropic API key is server-only; AI suggests a category, operates AG Studio through the Agent Framework, and ranks explanations, while code calculates money, validates references and requires human confirmation. See the [AG Studio implementation notes](docs/ag-studio.md) and [FinSig design system](docs/design-system.md).

Current integration is first-party Transaction Search for the configured sandbox merchant.
The CLI below is a local development path for real sandbox records.

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
exact commit, followed by an HTTP smoke check of `/demo`. A newer `main` commit
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
