import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export function createAppDbSchema(tablePrefix: string = "account_growth") {
  const plans = sqliteTable(`${tablePrefix}__plans`, {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    markdown: text("markdown").notNull(),
    performanceSummary: text("performance_summary"),
    focus: text("focus"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  });

  return { plans };
}

const defaultSchema = createAppDbSchema();

export const plans = defaultSchema.plans;
