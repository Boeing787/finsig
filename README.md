# FinSig

FinSig turns PayPal activity, work time, and known costs into explainable financial
signals for independent professionals.

Current integration is first-party Transaction Search for the configured sandbox merchant.
It does not connect arbitrary PayPal accounts. The CLI below is a local development path;
the application has no user authentication or public deployment yet.

## Workspace

- `apps/web` — Next.js application.
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

Run a command for one workspace with pnpm filters:

```bash
pnpm --filter @finsig/web dev
```

The [reporting gate](docs/reporting-gate.md) records the PayPal sandbox access test.
The [interview guide](docs/user-interviews.md) covers the first user conversations.
The [AWS access guide](docs/aws-access.md) documents the isolated project profile and account guard.
The [Terraform infrastructure](infra/README.md) contains the modular AWS baseline and apply sequence.

## Local reporting and calculations

Use Node 22+ and Docker Desktop. Put the sandbox app credentials in the ignored root
`.env.local` file. The `DATABASE_URL` value is optional for the local Compose database;
set it explicitly for another PostgreSQL instance. The default Compose password is
development-only. Do not expose this database or the current CLI flow publicly.

```bash
docker compose up -d postgres
pnpm --filter @finsig/web db:migrate
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
