/**
 * drizzle-orm/better-sqlite3 imports `better-sqlite3` at module load even when
 * a client is passed in. Tests always pass the node:sqlite shim, so this stub
 * only satisfies the import and fails loudly if drizzle ever tries to open a
 * database itself.
 */
export default class Database {
  constructor() {
    throw new Error("better-sqlite3 is not available in tests; pass the node:sqlite shim client");
  }
}
