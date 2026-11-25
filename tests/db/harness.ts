import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const SHIM = path.join(ROOT, "tests", "db", "supabase-shim.sql");

/** Conexión mínima que usan los tests, igual para PGlite y para Postgres real. */
export interface TestDb {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; affectedRows: number }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * Base para los tests de la base de datos.
 *
 * - Sin `TEST_DATABASE_URL`: Postgres en memoria (PGlite) con un shim de
 *   Supabase y todas las migraciones aplicadas. No necesita Docker.
 * - Con `TEST_DATABASE_URL`: se conecta a un Postgres de Supabase que ya tiene
 *   las migraciones aplicadas (por ejemplo, `supabase start` en CI).
 */
export async function createTestDatabase(): Promise<TestDb> {
  const url = process.env.TEST_DATABASE_URL;
  return url ? connectToPostgres(url) : createInMemoryDatabase();
}

async function createInMemoryDatabase(): Promise<TestDb> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { citext } = await import("@electric-sql/pglite/contrib/citext");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
  const { unaccent } = await import("@electric-sql/pglite/contrib/unaccent");

  const db = await PGlite.create({ extensions: { citext, pg_trgm, pgcrypto, unaccent } });
  await db.exec(await readFile(SHIM, "utf8"));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    try {
      await db.exec(await readFile(path.join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Falló la migración ${file}: ${(error as Error).message}`);
    }
  }

  return {
    async query<T>(sql: string, params?: unknown[]) {
      const result = await db.query<T>(sql, params);
      return { rows: result.rows, affectedRows: result.affectedRows ?? 0 };
    },
    async exec(sql) {
      await db.exec(sql);
    },
    close: () => db.close(),
  };
}

async function connectToPostgres(url: string): Promise<TestDb> {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url });
  await client.connect();

  return {
    async query<T>(sql: string, params?: unknown[]) {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[], affectedRows: result.rowCount ?? 0 };
    },
    async exec(sql) {
      await client.query(sql);
    },
    close: () => client.end(),
  };
}

export type DbRole =
  | { role: "anon" }
  | { role: "authenticated"; userId: string }
  | { role: "service_role" };

/**
 * Ejecuta `fn` como lo haría la Data API de Supabase: dentro de una transacción
 * con el rol y los claims del JWT. La transacción siempre se revierte, así que
 * cada llamada parte del mismo estado.
 */
export async function asRole<T>(db: TestDb, who: DbRole, fn: (db: TestDb) => Promise<T>): Promise<T> {
  const claims = who.role === "authenticated" ? { sub: who.userId, role: who.role } : { role: who.role };

  await db.exec("begin");
  try {
    await db.exec(`set local role ${who.role}`);
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    return await fn(db);
  } finally {
    await db.exec("rollback");
  }
}

/** Ejecuta `fn` con el rol de las migraciones y revierte todo al terminar. */
export async function inRollback<T>(db: TestDb, fn: (db: TestDb) => Promise<T>): Promise<T> {
  await db.exec("begin");
  try {
    return await fn(db);
  } finally {
    await db.exec("rollback");
  }
}

/** Devuelve el mensaje de error de una consulta que debería fallar. */
export async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("Se esperaba que la consulta fallara, pero terminó bien.");
}

/** Crea un usuario en auth.users (como lo haría Supabase Auth) y devuelve su id. */
export async function createAuthUser(db: TestDb, metadata: Record<string, unknown> = {}): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), $1, $2::jsonb) returning id",
    [`${crypto.randomUUID()}@example.test`, JSON.stringify(metadata)],
  );
  return rows[0].id;
}
