import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  resolve: {
    // Workers: swap the PGlite/global-pool db module for the per-request one.
    alias: [{ find: /^@\/db$/, replacement: fileURLToPath(new URL("./src/db/index.workers.ts", import.meta.url)) }],
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
