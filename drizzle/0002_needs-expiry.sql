ALTER TABLE `needs` ADD `expires_at` integer;--> statement-breakpoint
UPDATE `needs` SET `expires_at` = `updated_at` + 2592000000;
