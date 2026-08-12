ALTER TABLE `needs` ADD `idempotency_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `needs_user_idempotency_uidx` ON `needs` (`user_id`,`idempotency_key`);