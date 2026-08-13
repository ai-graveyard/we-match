-- 删除需求后保留连接与联系方式揭示台账，避免重置额度或抹掉调查证据。
ALTER TABLE `needs` ADD `deleted_at` integer;--> statement-breakpoint
CREATE INDEX `needs_deleted_idx` ON `needs` (`deleted_at`);
