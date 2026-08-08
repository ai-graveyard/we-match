-- 登录身份从手机号换成邮箱（docs/PRD.md 3.1）。
-- 手写而非 drizzle-kit 生成：自动生成会重建表、丢掉数据，这里用 RENAME COLUMN 原地改。
--
-- 存量账号：手机号不再是有效身份，改写为 RFC 2606 保留域下的占位值，
-- 保留行与外键关系（需求、举手、组织成员都挂在 user_id 上），但从此无法登录，
-- 需要用户以邮箱重新注册。上线前项目，存量只有种子和测试号。

ALTER TABLE `users` RENAME COLUMN `phone` TO `login_email`;--> statement-breakpoint
UPDATE `users` SET `login_email` = 'legacy-' || `id` || '@we-match.invalid';--> statement-breakpoint
DROP INDEX IF EXISTS `users_phone_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_email_unique` ON `users` (`login_email`);--> statement-breakpoint

-- 在途验证码是发给手机号的，换通道后一律作废
DELETE FROM `verification_codes`;--> statement-breakpoint
ALTER TABLE `verification_codes` RENAME COLUMN `phone` TO `email`;--> statement-breakpoint
DROP INDEX IF EXISTS `verification_codes_phone_idx`;--> statement-breakpoint
CREATE INDEX `verification_codes_email_idx` ON `verification_codes` (`email`);
