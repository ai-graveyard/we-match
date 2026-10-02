import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { vi } from "vitest";

// Services schedule email only within real Next requests. Tests exercise delivery explicitly.
vi.mock("next/server", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/server")>(),
  after: vi.fn(),
}));

// 必须先于任何 lib/db 的 import：连接在模块加载时按 DATABASE_PATH 建立并跑迁移
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "we-match-test-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");
