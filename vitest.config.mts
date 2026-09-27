import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/empty.ts", import.meta.url)),
    },
  },
  test: {
    env: { PGLITE_DIR: "memory://", PAYMENT_PROVIDER: "mock" },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
