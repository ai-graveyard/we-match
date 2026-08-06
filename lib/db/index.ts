import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const dbPath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "we-match.db");

// dev 下模块会随 HMR 反复加载，用 globalThis 复用连接
const globalForDb = globalThis as unknown as {
  __weMatchDb?: BetterSQLite3Database<typeof schema>;
};

function createDb() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const database = drizzle(sqlite, { schema });
  migrate(database, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });
  return database;
}

export const db = (globalForDb.__weMatchDb ??= createDb());
export * as tables from "./schema";
