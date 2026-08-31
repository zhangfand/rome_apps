import { desc } from "drizzle-orm";
import { createAppDbSchema } from "../schema.js";
class PlansRepository {
    db;
    tables;
    constructor(db, tablePrefix){
        this.db = db;
        this.tables = createAppDbSchema(tablePrefix);
    }
    async save(input) {
        const row = {
            id: crypto.randomUUID(),
            title: input.title,
            markdown: input.markdown,
            performanceSummary: input.performanceSummary ?? null,
            focus: input.focus ?? null,
            createdAt: new Date()
        };
        this.db.insert(this.tables.plans).values(row).run();
        return row;
    }
    async list(limit = 12) {
        return this.db.select().from(this.tables.plans).orderBy(desc(this.tables.plans.createdAt)).limit(limit).all();
    }
}
function createPlansRepository(ctx) {
    return new PlansRepository(ctx.connection, ctx.tablePrefix);
}
export { PlansRepository, createPlansRepository };

//# sourceMappingURL=plans.js.map