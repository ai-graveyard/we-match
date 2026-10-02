import { sql } from "drizzle-orm";
import { users } from "@/lib/db/schema";

// 列表也必须执行名片的可见性规则；隐藏值不进入渲染数据。
export const publicAuthor = {
  nickname: users.nickname,
  city: sql<string | null>`case when json_extract(${users.fieldVisibility}, '$.city') = 'hidden' then null else ${users.city} end`,
};
