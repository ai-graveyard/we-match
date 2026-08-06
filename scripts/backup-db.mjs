// SQLite 在线备份：用 better-sqlite3 的 backup API，对运行中的 WAL 库安全。
// 用法：node scripts/backup-db.mjs [备份目录]，默认 ./backups，保留最近 14 份。
// 建议 cron 每日执行，并把备份目录同步到异地（对象存储 / 另一台机器）。
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const KEEP = Number(process.env.BACKUP_KEEP ?? 14);
const srcPath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "we-match.db");
const destDir = process.argv[2] ?? path.join(process.cwd(), "backups");

if (!fs.existsSync(srcPath)) {
  console.error(`数据库不存在：${srcPath}`);
  process.exit(1);
}
fs.mkdirSync(destDir, { recursive: true });

const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\..+/, "")
  .replace("T", "-");
const destPath = path.join(destDir, `we-match-${stamp}.db`);

const db = new Database(srcPath, { readonly: true, fileMustExist: true });
await db.backup(destPath);
db.close();
console.log(`已备份 → ${destPath}`);

const old = fs
  .readdirSync(destDir)
  .filter((f) => /^we-match-\d{8}-\d{6}\.db$/.test(f))
  .sort()
  .slice(0, -KEEP);
for (const f of old) {
  fs.unlinkSync(path.join(destDir, f));
  console.log(`已清理旧备份 ${f}`);
}
