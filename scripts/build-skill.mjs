// 打包官方 Skill：skills/we-match → public/we-match-skill.zip
// 构建时执行（pnpm build），下载入口在 /me/api 页
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const projectRoot = path.join(root, "..");
const skillDir = path.join(projectRoot, "skills");
const outFile = path.join(projectRoot, "public", "we-match-skill.zip");

if (!fs.existsSync(path.join(skillDir, "we-match", "SKILL.md"))) {
  console.error("skills/we-match/SKILL.md 不存在，跳过打包");
  process.exit(1);
}

fs.rmSync(outFile, { force: true });
// zip 内以 we-match/ 为根目录，解压到 ~/.claude/skills/ 即就位
execFileSync("zip", ["-r", "-q", outFile, "we-match"], { cwd: skillDir });
console.log(`已生成 ${path.relative(projectRoot, outFile)}`);
