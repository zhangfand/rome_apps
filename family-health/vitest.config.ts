import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "better-sqlite3": fileURLToPath(new URL("./test/better-sqlite3-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    // Inline drizzle so the `better-sqlite3` alias above applies to its imports.
    server: { deps: { inline: ["drizzle-orm"] } },
  },
});
