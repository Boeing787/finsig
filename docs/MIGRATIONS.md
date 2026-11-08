# Database migrations

FinSig uses Flyway Community for every PostgreSQL schema change. Versioned SQL lives in
`db/migrations` and follows StackUp's timestamped `VYYYYMMDD_HHMMSS__short_description.sql`
convention. Applied migration files are immutable; add a new migration for each follow-up change.
`flyway clean` is disabled in all environments.

The first migration, `V20261108_131500__initial_schema.sql`, captures the original application
schema. Default activity rows are seeded separately in
`V20261108_131600__seed_default_activities.sql` so schema creation and reference data have distinct
history entries.

## Local development

Start PostgreSQL and apply or validate migrations from the repository root:

```bash
docker compose up -d postgres
pnpm db:migrate
pnpm db:validate
```

The Flyway container mounts `db/migrations` read-only, waits for PostgreSQL health, and uses the
development-only Compose credentials. The database is not exposed beyond `127.0.0.1`.

GitHub Actions applies all migrations to a clean PostgreSQL instance, validates the resulting
history, and runs migrate a second time to confirm the versioned migration set is already current.
