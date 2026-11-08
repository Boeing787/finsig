-- IF NOT EXISTS lets existing local databases created by the former schema.sql
-- command transition to Flyway without dropping records. New migrations should
-- use explicit DDL and never edit an applied version.
CREATE TABLE IF NOT EXISTS import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  reporting_refreshed_at timestamptz,
  rows_fetched integer NOT NULL DEFAULT 0,
  rows_inserted integer NOT NULL DEFAULT 0,
  error text
);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 80)
);

CREATE TABLE IF NOT EXISTS paypal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  paypal_transaction_id text NOT NULL,
  event_code text NOT NULL,
  initiated_at timestamptz NOT NULL,
  status text NOT NULL,
  amount_minor bigint NOT NULL,
  fee_minor bigint,
  currency char(3) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('sale', 'refund', 'review')),
  reference_id text,
  raw jsonb NOT NULL,
  first_import_id uuid NOT NULL REFERENCES import_runs(id),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paypal_records_initiated_idx ON paypal_records (initiated_at DESC);
CREATE INDEX IF NOT EXISTS paypal_records_kind_currency_idx ON paypal_records (kind, currency);

CREATE TABLE IF NOT EXISTS classifications (
  record_id uuid PRIMARY KEY REFERENCES paypal_records(id) ON DELETE CASCADE,
  proposed_activity_id uuid REFERENCES activities(id),
  confirmed_activity_id uuid REFERENCES activities(id),
  client_label text,
  evidence text,
  confirmed_at timestamptz
);

CREATE TABLE IF NOT EXISTS work_inputs (
  activity_id uuid NOT NULL REFERENCES activities(id),
  period date NOT NULL CHECK (period = date_trunc('month', period)::date),
  hours numeric(12, 2),
  direct_cost_minor bigint,
  currency char(3) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, period, currency),
  CHECK (hours IS NULL OR hours >= 0),
  CHECK (direct_cost_minor IS NULL OR direct_cost_minor >= 0)
);
