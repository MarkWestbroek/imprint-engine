CREATE TABLE `api_tokens` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_name` varchar(64) NOT NULL,
	`name` varchar(64) NOT NULL,
	`prefix` varchar(16) NOT NULL,
	`hash` varchar(64) NOT NULL,
	`scopes` varchar(255) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`expires_at` datetime(3),
	`last_used_at` datetime(3),
	`revoked_at` datetime(3),
	CONSTRAINT `api_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_tokens_hash_unique` UNIQUE(`hash`)
);
--> statement-breakpoint
CREATE INDEX `idx_tokens_user` ON `api_tokens` (`user_name`);