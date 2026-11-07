import { Pool } from 'pg';

const localDatabaseUrl = 'postgres://finsig:finsig_dev@127.0.0.1:5432/finsig';

export function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL ?? localDatabaseUrl,
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
  });
}
