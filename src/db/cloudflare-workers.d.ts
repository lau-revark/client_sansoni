// Only resolvable in the Workers build; lets tsc accept src/db/index.workers.ts.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
