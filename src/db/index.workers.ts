import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { cacheForRequest } from "vinext/cache";
import type { Db } from "./index";
import * as schema from "./schema";

// Cloudflare Workers build only (aliased over ./index in vite.config.ts).
// Workers can't reuse a socket across requests, so each request gets its own pool.
// Hyperdrive keeps warm connections to Neon, so opening one per request is cheap.
const hyperdrive = (env as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE;
const getDb = cacheForRequest(() =>
  drizzle(new Pool({ connectionString: hyperdrive?.connectionString ?? process.env.DATABASE_URL, max: 5 }), { schema }),
);

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
export { schema };
