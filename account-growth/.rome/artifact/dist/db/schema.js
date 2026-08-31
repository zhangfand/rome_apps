import { integer, sqliteTable, text as sqlite_core_text } from "drizzle-orm/sqlite-core";
function createAppDbSchema(tablePrefix = "account_growth") {
    const plans = sqliteTable(`${tablePrefix}__plans`, {
        id: sqlite_core_text("id").primaryKey(),
        title: sqlite_core_text("title").notNull(),
        markdown: sqlite_core_text("markdown").notNull(),
        performanceSummary: sqlite_core_text("performance_summary"),
        focus: sqlite_core_text("focus"),
        createdAt: integer("created_at", {
            mode: "timestamp"
        }).notNull()
    });
    return {
        plans
    };
}
const defaultSchema = createAppDbSchema();
const schema_plans = defaultSchema.plans;
export { createAppDbSchema, schema_plans as plans };

//# sourceMappingURL=schema.js.map