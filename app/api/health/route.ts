import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// 部署后 smoke check 用的轻量探针：只确认应用起来了、数据库能查。
// 故意不暴露版本、迁移数量等内部信息，避免给外部探测提供指纹。
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    db.get(sql`SELECT 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
