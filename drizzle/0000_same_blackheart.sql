CREATE TABLE `content_items` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`type` varchar(32) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`lang` varchar(8) NOT NULL DEFAULT 'en',
	`data` json NOT NULL,
	`valid_from` datetime(3) NOT NULL,
	`valid_to` datetime(3),
	`tx_from` datetime(3) NOT NULL,
	`tx_to` datetime(3),
	`created_by` varchar(64),
	CONSTRAINT `content_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`hashed_password` varchar(255) NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'reader',
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `idx_current` ON `content_items` (`type`,`slug`,`lang`,`tx_to`);--> statement-breakpoint
CREATE INDEX `idx_type` ON `content_items` (`type`,`tx_to`);