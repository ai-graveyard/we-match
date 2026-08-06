// 测试数据种子：node scripts/seed.mjs
// 幂等：检测到已有种子用户则直接退出，不会重复插入
import Database from "better-sqlite3";
import path from "node:path";

const dbPath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "we-match.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const now = Date.now();

if (db.prepare("SELECT id FROM users WHERE phone = ?").get("13800000001")) {
  console.log("种子数据已存在，跳过（如需重建请先删除 data/we-match.db 或手动清理）");
  process.exit(0);
}

const insertUser = db.prepare(`
  INSERT INTO users (phone, nickname, bio, tags, city, wechat, email, contact_phone,
    weixin_mp, weixin_channels, xiaohongshu, weibo, field_visibility, created_at)
  VALUES (@phone, @nickname, @bio, @tags, @city, @wechat, @email, NULL,
    NULL, NULL, @xiaohongshu, NULL, @vis, @createdAt)
`);

const users = [
  { phone: "13800000001", nickname: "陈皮", bio: "产品经理，关注增长和用户研究", tags: ["产品", "增长"], city: "北京", wechat: "chenpi_pm", email: null, xiaohongshu: null, vis: {} },
  { phone: "13800000002", nickname: "小竹", bio: "独立设计师，接品牌和 UI", tags: ["设计", "UI", "插画"], city: "杭州", wechat: "xiaozhu_design", email: "zhu@example.com", xiaohongshu: null, vis: { email: "orgs" } },
  { phone: "13800000003", nickname: "老白", bio: "十年后端，Go / 数据库", tags: ["后端", "Go", "数据库"], city: "深圳", wechat: null, email: "laobai@example.com", xiaohongshu: null, vis: {} },
  { phone: "13800000004", nickname: "阿枣", bio: "自由撰稿人，科技与生活方式", tags: ["写作", "文案"], city: "成都", wechat: "azao_writer", email: "azao@example.com", xiaohongshu: null, vis: { wechat: "orgs" } },
  { phone: "13800000005", nickname: "大鱼", bio: "执业律师，擅长合同与合规", tags: ["法律", "合同"], city: "上海", wechat: null, email: "dayu@example.com", xiaohongshu: null, vis: {} },
  { phone: "13800000006", nickname: "冬冬", bio: "前端实习生，求带", tags: ["前端", "React"], city: "广州", wechat: "dongdong_fe", email: null, xiaohongshu: null, vis: {} },
  { phone: "13800000007", nickname: "木木", bio: "人像摄影师，胶片爱好者", tags: ["摄影", "修图"], city: "上海", wechat: "mumu_photo", email: null, xiaohongshu: "木木的取景框", vis: {} },
  { phone: "13800000008", nickname: "石头", bio: "连续创业者，正在做 AI 工具", tags: ["创业", "融资"], city: "北京", wechat: "shitou_ai", email: "stone@example.com", xiaohongshu: null, vis: { wechat: "hidden" } },
];

const uid = {};
const seedUsers = db.transaction(() => {
  users.forEach((u, i) => {
    const r = insertUser.run({
      ...u,
      tags: JSON.stringify(u.tags),
      vis: JSON.stringify(u.vis),
      createdAt: now - (20 - i) * DAY,
    });
    uid[u.nickname] = Number(r.lastInsertRowid);
  });
});
seedUsers();

const insertOrg = db.prepare(`
  INSERT INTO orgs (name, description, visibility, owner_id, invite_code, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertMember = db.prepare(`
  INSERT INTO org_members (org_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)
`);
const insertRequest = db.prepare(`
  INSERT INTO join_requests (org_id, user_id, via, status, created_at, handled_at)
  VALUES (?, ?, ?, ?, ?, NULL)
`);

const seedOrgs = db.transaction(() => {
  const productOrg = Number(
    insertOrg.run("产品人互助会", "产品经理和增长同学的互助小圈子，内推、评审、聊行业", "public", uid["陈皮"], "PMHELP66", now - 15 * DAY).lastInsertRowid,
  );
  insertMember.run(productOrg, uid["陈皮"], "owner", now - 15 * DAY);
  insertMember.run(productOrg, uid["小竹"], "member", now - 12 * DAY);
  insertMember.run(productOrg, uid["石头"], "member", now - 10 * DAY);

  const creatorOrg = Number(
    insertOrg.run("上海创作者圈", "上海的摄影、写作、设计同好，线下面基为主", "private", uid["木木"], "SHCHUANG", now - 9 * DAY).lastInsertRowid,
  );
  insertMember.run(creatorOrg, uid["木木"], "owner", now - 9 * DAY);
  insertMember.run(creatorOrg, uid["阿枣"], "member", now - 8 * DAY);
  insertMember.run(creatorOrg, uid["大鱼"], "member", now - 6 * DAY);

  // 待审批：老白广场申请产品会；冬冬凭码申请骑行俱乐部（org 1，若存在）
  insertRequest.run(productOrg, uid["老白"], "plaza", "pending", now - 2 * DAY);
  const ridingOrg = db.prepare("SELECT id FROM orgs WHERE name = ?").get("周末骑行俱乐部");
  if (ridingOrg) {
    insertRequest.run(ridingOrg.id, uid["冬冬"], "code", "pending", now - 5 * HOUR);
  }

  const insertNeed = db.prepare(`
    INSERT INTO needs (user_id, type, title, description, tags, org_id, status, expires_at, created_at, updated_at)
    VALUES (@userId, @type, @title, @description, @tags, @orgId, @status, @expiresAt, @t, @t)
  `);
  const needsData = [
    { by: "陈皮", type: "need", title: "找懂 AARRR 的增长顾问聊一小时", description: "新产品冷启动，想找有实操经验的增长同学付费咨询。", tags: ["产品", "增长"], orgId: null, status: "open", age: 3 * HOUR },
    { by: "小竹", type: "offer", title: "可接 logo 和品牌视觉设计", description: "十年经验，风格偏极简，可看作品集。", tags: ["设计"], orgId: null, status: "open", age: 8 * HOUR },
    { by: "老白", type: "offer", title: "帮看后端架构方案，免费", description: "Go / PostgreSQL / 高并发方向，周末有空。", tags: ["后端", "数据库"], orgId: null, status: "open", age: 1 * DAY },
    { by: "阿枣", type: "need", title: "找科技类约稿渠道", description: "写 AI 和消费电子，有作品，求编辑推荐。", tags: ["写作"], orgId: null, status: "open", age: 2 * DAY },
    { by: "大鱼", type: "offer", title: "创业公司法律咨询半小时", description: "合同审查、股权架构，每周三晚可约。", tags: ["法律", "合同"], orgId: null, status: "open", age: 3 * DAY },
    { by: "冬冬", type: "need", title: "求前端面试模拟", description: "秋招在即，求大佬帮忙模拟面试一轮。", tags: ["前端", "React"], orgId: null, status: "open", age: 4 * DAY },
    { by: "木木", type: "offer", title: "上海免费人像拍摄（作品集互换）", description: "想扩充作品集，互免合作，出片 20 张。", tags: ["摄影"], orgId: null, status: "open", age: 5 * DAY },
    { by: "石头", type: "need", title: "找技术合伙人", description: "AI 工具方向，已有 demo 和种子用户，base 北京。", tags: ["创业", "后端"], orgId: null, status: "open", age: 6 * DAY },
    { by: "小竹", type: "need", title: "找摄影师拍产品图", description: "已找到，感谢大家。", tags: ["摄影"], orgId: null, status: "done", age: 10 * DAY },
    { by: "石头", type: "need", title: "收一台二手显示器", description: null, tags: [], orgId: null, status: "closed", age: 12 * DAY },
    { by: "老白", type: "need", title: "找人一起刷 LeetCode", description: "每天一题，微信群互相监督。", tags: ["后端"], orgId: null, status: "open", age: 40 * DAY },
  ];
  const orgNeedsData = [
    { by: "陈皮", type: "offer", title: "可内推大厂产品岗", description: "组内有 HC，欢迎丢简历。", tags: ["产品"], orgId: productOrg, status: "open", age: 12 * HOUR },
    { by: "石头", type: "offer", title: "分享我的融资 BP 模板", description: "拿过两轮融资的版本，会内自取。", tags: ["创业", "融资"], orgId: productOrg, status: "open", age: 2 * DAY },
    { by: "木木", type: "need", title: "找修图搭子分摊工作量", description: "婚礼旺季忙不过来，按张结算。", tags: ["摄影", "修图"], orgId: creatorOrg, status: "open", age: 1 * DAY },
  ];
  for (const n of [...needsData, ...orgNeedsData]) {
    insertNeed.run({
      userId: uid[n.by],
      type: n.type,
      title: n.title,
      description: n.description,
      tags: JSON.stringify(n.tags),
      orgId: n.orgId,
      status: n.status,
      expiresAt: now - n.age + 30 * DAY,
      t: now - n.age,
    });
  }
});
seedOrgs();

const counts = {
  users: db.prepare("SELECT COUNT(*) n FROM users").get().n,
  orgs: db.prepare("SELECT COUNT(*) n FROM orgs").get().n,
  needs: db.prepare("SELECT COUNT(*) n FROM needs").get().n,
  requests: db.prepare("SELECT COUNT(*) n FROM join_requests").get().n,
};
console.log("种子完成：", counts);
