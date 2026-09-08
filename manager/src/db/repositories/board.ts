import { eq } from "drizzle-orm";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";
import type { GithubBoardSnapshot } from "../../lib/board-snapshot.js";
import { createAppDbSchema } from "../schema.js";

/** Persistence for the Board read model. This repository never touches task facts. */
export class BoardRepository {
  private readonly tables;

  constructor(private readonly db: DrizzleDb, tablePrefix: string) {
    this.tables = createAppDbSchema(tablePrefix);
  }

  getSelectedRepo(): string | null {
    return this.db
      .select({ selectedRepo: this.tables.preferences.selectedRepo })
      .from(this.tables.preferences)
      .where(eq(this.tables.preferences.id, "guardian"))
      .get()?.selectedRepo ?? null;
  }

  setSelectedRepo(selectedRepo: string): void {
    const updatedAt = new Date();
    this.db
      .insert(this.tables.preferences)
      .values({ id: "guardian", selectedRepo, updatedAt })
      .onConflictDoUpdate({
        target: this.tables.preferences.id,
        set: { selectedRepo, updatedAt },
      })
      .run();
  }

  getSnapshot(repo: string): GithubBoardSnapshot | null {
    const row = this.db
      .select({ data: this.tables.snapshots.data })
      .from(this.tables.snapshots)
      .where(eq(this.tables.snapshots.repo, repo))
      .get();
    if (!row) return null;
    try {
      return JSON.parse(row.data) as GithubBoardSnapshot;
    } catch {
      return null;
    }
  }

  /** Called only after a complete sync, so a failed refresh preserves this row. */
  saveSnapshot(repo: string, snapshot: GithubBoardSnapshot, syncedAt: Date): void {
    const data = JSON.stringify(snapshot);
    this.db
      .insert(this.tables.snapshots)
      .values({ repo, data, syncedAt })
      .onConflictDoUpdate({
        target: this.tables.snapshots.repo,
        set: { data, syncedAt },
      })
      .run();
  }
}

export function createBoardRepository(ctx: AppDbContext): BoardRepository {
  return new BoardRepository(ctx.connection, ctx.tablePrefix);
}
