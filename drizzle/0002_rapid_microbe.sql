CREATE TABLE `email_tokens` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_name` varchar(64) NOT NULL,
	`purpose` varchar(16) NOT NULL,
	`hash` varchar(64) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`used_at` datetime(3),
	CONSTRAINT `email_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_tokens_hash_unique` UNIQUE(`hash`)
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`group_slug` varchar(128) NOT NULL,
	`hash` varchar(64) NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'member',
	`created_by` varchar(64) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`uses` int NOT NULL DEFAULT 0,
	CONSTRAINT `invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `invites_hash_unique` UNIQUE(`hash`)
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`group_slug` varchar(128) NOT NULL,
	`user_name` varchar(64) NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'member',
	`status` varchar(16) NOT NULL DEFAULT 'requested',
	`created_at` datetime(3) NOT NULL,
	`decided_at` datetime(3),
	`decided_by` varchar(64),
	CONSTRAINT `memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_memberships` UNIQUE(`group_slug`,`user_name`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `email` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified_at` datetime(3);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
CREATE INDEX `idx_email_tokens_user` ON `email_tokens` (`user_name`);--> statement-breakpoint
CREATE INDEX `idx_invites_group` ON `invites` (`group_slug`);--> statement-breakpoint
CREATE INDEX `idx_memberships_user` ON `memberships` (`user_name`);