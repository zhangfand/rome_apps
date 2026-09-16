import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/core/db/schema.ts",
  out: "./src/core/db/migrations",
  dialect: "sqlite",
  migrations: { table: "__drizzle_migrations_app_conductor" },
  tablesFilter: ["conductor\\__*"],
});
