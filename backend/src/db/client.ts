import { Pool, type PoolClient } from 'pg';
import { config } from '../config';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    });
    pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err.message);
    });
  }
  return pool;
}

export { getPool };

export const db = {
  query: (text: string, params?: unknown[]) => getPool().query(text, params),
  connect: (): Promise<PoolClient> => getPool().connect(),
};
