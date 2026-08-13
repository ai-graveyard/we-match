import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// 基本资料：public | hidden。
// 社媒：authenticated | orgs | hidden，缺省 authenticated。
// 联系方式：connected | orgs | authenticated | hidden，缺省 connected。
// public 仅为历史敏感字段兼容值：社媒降为 authenticated，联系方式降为 connected。
export type FieldVisibility = Record<
  string,
  "public" | "connected" | "authenticated" | "orgs" | "hidden"
>;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // 登录身份，永不出站（docs/AGENT-SKILL.md 2.2）。与名片上的 email 是两回事：
  // 那个是用户主动填的展示字段，受可见性控制——同 contactPhone 的关系。
  // 统一存小写，唯一性因此大小写不敏感。
  loginEmail: text("login_email").notNull().unique(),
  nickname: text("nickname").notNull(),
  bio: text("bio"),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  city: text("city"),
  wechat: text("wechat"),
  email: text("email"),
  contactPhone: text("contact_phone"),
  weixinMp: text("weixin_mp"),
  weixinChannels: text("weixin_channels"),
  xiaohongshu: text("xiaohongshu"),
  weibo: text("weibo"),
  fieldVisibility: text("field_visibility", { mode: "json" })
    .$type<FieldVisibility>()
    .notNull()
    .default({}),
  // deleted = 用户主动注销：个人资料已清空，登录邮箱保留用于永久禁止再次登录
  status: text("status", { enum: ["active", "suspended", "deleted"] })
    .notNull()
    .default("active"),
  suspendedAt: integer("suspended_at", { mode: "timestamp_ms" }),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const verificationCodes = sqliteTable(
  "verification_codes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    code: text("code").notNull(),
    ip: text("ip").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    failCount: integer("fail_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("verification_codes_email_idx").on(t.email)],
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const needs = sqliteTable(
  "needs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type", { enum: ["need", "offer"] }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    preferredContact: text("preferred_contact", {
      enum: ["wechat", "email", "contactPhone"],
    }),
    orgId: integer("org_id"), // NULL = 广场公开
    status: text("status", { enum: ["open", "done", "closed"] })
      .notNull()
      .default("open"),
    moderationStatus: text("moderation_status", {
      enum: ["visible", "hidden"],
    })
      .notNull()
      .default("visible"),
    // 用户删除采用软删除：页面/API 不再展示，但连接与联系方式揭示台账继续保留，
    // 供配额计算、滥用调查和审计使用。
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    // Agent POST 重试去重。仅 API 写入；网页创建保持 NULL。
    idempotencyKey: text("idempotency_key"),
    // NULL = 永久有效；非空时由用户指定截止时间
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("needs_org_idx").on(t.orgId),
    index("needs_user_idx").on(t.userId),
    index("needs_user_created_idx").on(t.userId, t.createdAt),
    index("needs_deleted_idx").on(t.deletedAt),
    uniqueIndex("needs_user_idempotency_uidx").on(t.userId, t.idempotencyKey),
  ],
);

export const orgs = sqliteTable("orgs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  visibility: text("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const orgMembers = sqliteTable(
  "org_members",
  {
    orgId: integer("org_id")
      .notNull()
      .references(() => orgs.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", { enum: ["owner", "admin", "member"] }).notNull(),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

export const joinRequests = sqliteTable(
  "join_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orgId: integer("org_id")
      .notNull()
      .references(() => orgs.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    via: text("via", { enum: ["code", "plaza"] }).notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    handledAt: integer("handled_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("join_requests_org_idx").on(t.orgId)],
);

// 历史兼容字段；新 Key 固定存 ["read", "write"]，鉴权统一按完整读写处理。
export type ApiScope = "read" | "write";

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    // 仅存 SHA-256 哈希；历史明文 Key 会在首次成功鉴权时原地升级。
    key: text("key").notNull().unique(),
    lastFour: text("last_four"),
    scopes: text("scopes", { mode: "json" }).$type<ApiScope[]>().notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("api_keys_user_idx").on(t.userId)],
);

export const connections = sqliteTable(
  "connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    needId: integer("need_id")
      .notNull()
      .references(() => needs.id),
    initiatorId: integer("initiator_id")
      .notNull()
      .references(() => users.id),
    message: text("message"),
    // 举手方选定的交换物；接受后写入 contact_reveals
    initiatorContact: text("initiator_contact", {
      enum: ["wechat", "email", "contactPhone"],
    }),
    // 含首次在内的举手次数，L4「撤回后重发 ≤ 3」用
    raiseCount: integer("raise_count").notNull().default(1),
    // 最近一次举手时刻。每日举手额度按它算：updatedAt 会被对方的接受/拒绝
    // 改写，拿它计数会把别人的动作记到举手方头上
    lastRaisedAt: integer("last_raised_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    status: text("status", {
      enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
    })
      .notNull()
      .default("pending"),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    ownerConfirmedAt: integer("owner_confirmed_at", { mode: "timestamp_ms" }),
    initiatorConfirmedAt: integer("initiator_confirmed_at", {
      mode: "timestamp_ms",
    }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("connections_need_initiator_uidx").on(t.needId, t.initiatorId),
    index("connections_initiator_idx").on(t.initiatorId),
    index("connections_status_idx").on(t.status),
    index("connections_initiator_created_idx").on(t.initiatorId, t.createdAt),
    index("connections_initiator_raised_idx").on(t.initiatorId, t.lastRaisedAt),
    index("connections_initiator_status_idx").on(t.initiatorId, t.status),
    index("connections_need_status_idx").on(t.needId, t.status),
  ],
);

export const contactReveals = sqliteTable(
  "contact_reveals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    connectionId: integer("connection_id")
      .notNull()
      .references(() => connections.id),
    needId: integer("need_id")
      .notNull()
      .references(() => needs.id),
    fromUserId: integer("from_user_id")
      .notNull()
      .references(() => users.id),
    toUserId: integer("to_user_id")
      .notNull()
      .references(() => users.id),
    field: text("field", {
      enum: ["wechat", "email", "contactPhone"],
    }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("contact_reveals_from_created_idx").on(t.fromUserId, t.createdAt),
    index("contact_reveals_to_created_idx").on(t.toUserId, t.createdAt),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    // title / body 是按默认语言渲染的快照，只作为老数据与未知类型的兜底；
    // params 存在的话按查看者的语言现渲染，见 lib/notifications.ts
    title: text("title").notNull(),
    body: text("body"),
    params: text("params", { mode: "json" }).$type<Record<string, unknown>>(),
    href: text("href"),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt)],
);

export const blocks = sqliteTable(
  "blocks",
  {
    blockerId: integer("blocker_id")
      .notNull()
      .references(() => users.id),
    blockedId: integer("blocked_id")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    index("blocks_blocked_created_idx").on(t.blockedId, t.createdAt),
  ],
);

export const reports = sqliteTable(
  "reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reporterId: integer("reporter_id").references(() => users.id),
    targetType: text("target_type", { enum: ["user", "need"] }).notNull(),
    targetId: integer("target_id").notNull(),
    reason: text("reason", {
      enum: ["spam", "fraud", "harassment", "illegal", "other"],
    }).notNull(),
    details: text("details"),
    status: text("status", { enum: ["pending", "resolved", "dismissed"] })
      .notNull()
      .default("pending"),
    handledBy: integer("handled_by").references(() => users.id),
    handledAt: integer("handled_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("reports_status_created_idx").on(t.status, t.createdAt),
    index("reports_target_created_idx").on(t.targetType, t.targetId, t.createdAt),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorId: integer("actor_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: integer("target_id"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);

export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id),
    name: text("name").notNull(),
    entityType: text("entity_type"),
    entityId: integer("entity_id"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("analytics_events_name_created_idx").on(t.name, t.createdAt)],
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    bucketStart: integer("bucket_start", { mode: "timestamp_ms" }).notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.key, t.bucketStart] })],
);

export type User = typeof users.$inferSelect;
export type Need = typeof needs.$inferSelect;
export type Org = typeof orgs.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type ContactReveal = typeof contactReveals.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
