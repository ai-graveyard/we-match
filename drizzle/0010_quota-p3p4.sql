-- QUOTA P3/P4：举手时刻独立成列，赚回与惩罚阶梯所需的统计索引。
-- 手写而非 drizzle-kit 生成：只加列和索引，不重建表。
-- last_raised_at 回填 created_at——存量行的最近一次举手就是它建立的时刻。

ALTER TABLE `connections` ADD `last_raised_at` integer;--> statement-breakpoint
UPDATE `connections` SET `last_raised_at` = `created_at` WHERE `last_raised_at` IS NULL;--> statement-breakpoint
CREATE INDEX `connections_initiator_raised_idx` ON `connections` (`initiator_id`,`last_raised_at`);--> statement-breakpoint
CREATE INDEX `blocks_blocked_created_idx` ON `blocks` (`blocked_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `reports_target_created_idx` ON `reports` (`target_type`,`target_id`,`created_at`);
