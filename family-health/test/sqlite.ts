/**
 * Test-only SQLite harness: a better-sqlite3-compatible shim over Node's
 * built-in `node:sqlite`, so repository tests run against a real SQLite
 * engine without compiling native modules. Lives outside `src/` so it is
 * never shipped in the app bundle.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { AppDbContext, DrizzleDb } from "@rome-os/app-runtime";

type Param = null | number | bigint | string | Uint8Array;

function params(args: unknown[]): Param[] {
  return args.map((a) => (typeof a === "boolean" ? (a ? 1 : 0) : a === undefined ? null : (a as Param)));
}

function wrap(stmt: StatementSync) {
  const withArrays = <T>(fn: () => T): T => {
    stmt.setReturnArrays(true);
    try {
      return fn();
    } finally {
      stmt.setReturnArrays(false);
    }
  };
  return {
    run: (...a: unknown[]) => {
      const r = stmt.run(...params(a));
      return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid };
    },
    all: (...a: unknown[]) => stmt.all(...params(a)),
    get: (...a: unknown[]) => stmt.get(...params(a)),
    raw: () => ({
      all: (...a: unknown[]) => withArrays(() => stmt.all(...params(a))),
      get: (...a: unknown[]) => withArrays(() => stmt.get(...params(a))),
    }),
  };
}

class BetterSqliteShim {
  constructor(readonly db: DatabaseSync) {}
  prepare(sql: string) {
    return wrap(this.db.prepare(sql));
  }
  exec(sql: string) {
    this.db.exec(sql);
    return this;
  }
  transaction<T>(fn: (...args: unknown[]) => T) {
    const run = (...args: unknown[]) => {
      this.db.exec("BEGIN");
      try {
        const out = fn(...args);
        this.db.exec("COMMIT");
        return out;
      } catch (err) {
        this.db.exec("ROLLBACK");
        throw err;
      }
    };
    return Object.assign(run, { deferred: run, immediate: run, exclusive: run });
  }
}

/** Apply every generated migration in order, splitting on drizzle breakpoints. */
export function applyMigrations(db: DatabaseSync, dir = join(import.meta.dirname, "..", "src", "db", "migrations")): string[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      if (stmt.trim()) db.exec(stmt);
    }
  }
  return files;
}

/** Fresh in-memory database with all migrations applied, wrapped as an AppDbContext. */
export function createTestDb(tablePrefix = "family_health"): { ctx: AppDbContext; raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  applyMigrations(raw);
  const connection = drizzle(new BetterSqliteShim(raw) as never) as unknown as DrizzleDb;
  return {
    raw,
    ctx: { connection, tablePrefix, tableName: (name: string) => `${tablePrefix}__${name}` },
  };
}
