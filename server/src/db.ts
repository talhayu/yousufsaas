import dotenv from "dotenv";
import path from "path";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const serverRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(serverRoot, ".env") });
dotenv.config({ path: path.join(serverRoot, "..", ".env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing. Add your Supabase Postgres connection string to .env (see .env.example).",
  );
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("localhost") ? undefined : { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 15000,
});

type Queryable = Pool | PoolClient;

function toPg(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function queryAll<T extends QueryResultRow>(
  client: Queryable,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await client.query<T>(toPg(sql), params);
  return result.rows;
}

export async function all<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return queryAll<T>(pool, sql, params);
}

export async function get<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await all<T>(sql, params);
  return rows[0];
}

function withReturningId(sql: string): string {
  const trimmed = sql.trim();
  if (!/^insert\b/i.test(trimmed) || /\breturning\b/i.test(trimmed)) return trimmed;
  // Only tables with a serial `id` column support RETURNING id.
  if (
    !/\binsert\s+into\s+(users|applications|issues|alerts|activity|snapshots|reports|messages)\b/i.test(
      trimmed,
    )
  ) {
    return trimmed;
  }
  return `${trimmed} RETURNING id`;
}

export async function run(
  sql: string,
  params: unknown[] = [],
): Promise<{ changes: number; lastInsertRowid: number }> {
  const result = await pool.query(toPg(withReturningId(sql)), params);
  const row = result.rows[0] as { id?: number } | undefined;
  return {
    changes: result.rowCount ?? 0,
    lastInsertRowid: Number(row?.id ?? 0),
  };
}

export async function exec(sql: string): Promise<void> {
  await pool.query(sql);
}

type Tx = {
  all: <T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) => Promise<T[]>;
  get: <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ) => Promise<T | undefined>;
  run: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number }>;
  exec: (sql: string) => Promise<void>;
};

export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx: Tx = {
      all: <R extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) =>
        queryAll<R>(client, sql, params),
      get: async <R extends QueryResultRow = QueryResultRow>(
        sql: string,
        params: unknown[] = [],
      ): Promise<R | undefined> => {
        const rows = await queryAll<R>(client, sql, params);
        return rows[0];
      },
      run: async (sql: string, params: unknown[] = []) => {
        const result = await client.query(toPg(withReturningId(sql)), params);
        const row = result.rows[0] as { id?: number } | undefined;
        return {
          changes: result.rowCount ?? 0,
          lastInsertRowid: Number(row?.id ?? 0),
        };
      },
      exec: async (sql: string) => {
        await client.query(sql);
      },
    };
    const value = await fn(tx);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      risk TEXT NOT NULL,
      user_count INTEGER NOT NULL,
      cost_per_user DOUBLE PRECISION NOT NULL,
      flat_monthly_cost DOUBLE PRECISION NOT NULL,
      billing_cycle TEXT NOT NULL,
      renewal_date TEXT NOT NULL,
      source TEXT NOT NULL,
      spec TEXT NOT NULL,
      compliance_score INTEGER,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS control_results (
      app_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      framework TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      evidence TEXT NOT NULL,
      PRIMARY KEY (app_id, code)
    )`,
  `CREATE TABLE IF NOT EXISTS issues (
      id SERIAL PRIMARY KEY,
      app_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      framework TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      due_date TEXT,
      guide TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      UNIQUE (app_id, code)
    )`,
  `CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      app_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      severity TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS activity (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      happened_at TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS integrations (
      provider TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      connected_at TEXT,
      last_discovery_at TEXT,
      detail TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS snapshots (
      id SERIAL PRIMARY KEY,
      created_at TEXT NOT NULL,
      payload TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      html TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
];

export async function ensureSchema(): Promise<void> {
  // Supabase transaction pooler rejects multi-statement queries — run one at a time.
  for (const statement of SCHEMA_STATEMENTS) {
    await exec(statement);
  }
}
