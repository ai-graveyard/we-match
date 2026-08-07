import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// 基本资料：public | hidden；联系方式/社媒：authenticated | orgs | hidden。
// public 仅为历史敏感字段兼容值，读取时安全降级为 authenticated。
export type FieldVisibility = Record<
  string,
  "public" | "authenticated" | "orgs" | "hidden"
>;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull().unique(),
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
  // deleted = 用户主动注销：个人资料已清空，手机号保留用于永久禁止再次登录
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
    phone: text("phone").notNull(),
    code: text("code").notNull(),
    ip: text("ip").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    failCount: integer("fail_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("verification_codes_phone_idx").on(t.phone)],
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
    // NULL = 永久有效；非空时由用户指定截止时间
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("needs_org_idx").on(t.orgId), index("needs_user_idx").on(t.userId)],
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
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
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
  (t) => [index("reports_status_created_idx").on(t.status, t.createdAt)],
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
export type Notification = typeof notifications.$inferSelect;
