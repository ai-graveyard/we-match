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
  let database!: BetterSQLite3Database<typeof schema>;
  // fresh DB 上连 journal_mode 初始化也会拿写锁，所以从打开连接开始串行；
  // 否则多个 Next build worker 会先在 PRAGMA 阶段撞 SQLITE_BUSY。
  withMigrationLock(() => {
    const sqlite = new Database(dbPath);
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    database = drizzle(sqlite, { schema });
    migrate(database, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  });
  return database;
}

function withMigrationLock<T>(run: () => T): T {
  const lockPath = `${dbPath}.migrate.lock`;
  const deadline = Date.now() + 60_000;
  let fd: number | null = null;

  while (fd == null) {
    try {
      fd = fs.openSync(lockPath, "wx", 0o600);
      fs.writeFileSync(fd, String(process.pid));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;

      // 上一个进程若异常退出，清掉它遗留的锁；活进程则短暂等待。
      try {
        const ownerPid = Number(fs.readFileSync(lockPath, "utf8"));
        if (!Number.isInteger(ownerPid) || ownerPid <= 0) {
          fs.unlinkSync(lockPath);
          continue;
        }
        process.kill(ownerPid, 0);
      } catch (ownerError) {
        const ownerCode = (ownerError as NodeJS.ErrnoException).code;
        if (
          ownerCode === "ESRCH" ||
          ownerCode === "ENOENT" ||
          ownerCode === undefined
        ) {
          try {
            fs.unlinkSync(lockPath);
          } catch (unlinkError) {
            if ((unlinkError as NodeJS.ErrnoException).code !== "ENOENT") {
              throw unlinkError;
            }
          }
          continue;
        }
        if (ownerCode !== "EPERM") throw ownerError;
      }

      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for database migration lock: ${lockPath}`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }

  try {
    return run();
  } finally {
    fs.closeSync(fd);
    try {
      fs.unlinkSync(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export const db = (globalForDb.__weMatchDb ??= createDb());
export * as tables from "./schema";
