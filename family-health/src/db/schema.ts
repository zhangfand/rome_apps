import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export function createAppDbSchema(tablePrefix: string = "family_health") {
  const greetings = sqliteTable(`${tablePrefix}__greetings`, {
    id: text("id").primaryKey(),
    message: text("message").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  });

  return { greetings };
}

const defaultSchema = createAppDbSchema();

export const greetings = defaultSchema.greetings;
