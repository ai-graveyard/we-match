-- M6 连接制：举手交换物、揭示台账、额度统计索引。
-- 手写而非 drizzle-kit 生成：只加列和表，不重建。
-- 联系方式缺省档改为 connected 是读路径行为，不改存量 JSON——
-- 未记录的键本来就不在 field_visibility 里，换默认即收紧。

ALTER TABLE `connections` ADD `initiator_contact` text;--> statement-breakpoint
ALTER TABLE `connections` ADD `raise_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE TABLE `contact_reveals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection_id` integer NOT NULL,
	`need_id` integer NOT NULL,
	`from_user_id` integer NOT NULL,
	`to_user_id` integer NOT NULL,
	`field` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`),
	FOREIGN KEY (`need_id`) REFERENCES `needs`(`id`),
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`),
	FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`)
);--> statement-breakpoint
CREATE INDEX `contact_reveals_from_created_idx` ON `contact_reveals` (`from_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `contact_reveals_to_created_idx` ON `contact_reveals` (`to_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `connections_initiator_created_idx` ON `connections` (`initiator_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `connections_initiator_status_idx` ON `connections` (`initiator_id`,`status`);--> statement-breakpoint
CREATE INDEX `connections_need_status_idx` ON `connections` (`need_id`,`status`);--> statement-breakpoint
CREATE INDEX `needs_user_created_idx` ON `needs` (`user_id`,`created_at`);
