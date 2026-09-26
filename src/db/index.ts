import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzlePg<typeof schema>>;

// Reuse one connection across Next.js hot reloads.
const globalForDb = globalThis as unknown as { __db?: Db };

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (url) {
    return drizzlePg(new Pool({ connectionString: url, max: 10 }), { schema });
  }
  // Local dev fallback: embedded Postgres (WASM) persisted to ./.data/pglite.
  const client = new PGlite(process.env.PGLITE_DIR ?? "./.data/pglite");
  return drizzlePglite(client, { schema }) as unknown as Db;
}

export const db: Db = globalForDb.__db ?? (globalForDb.__db = createDb());
export { schema };
