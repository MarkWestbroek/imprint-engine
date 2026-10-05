CREATE TABLE `search_log` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`query` varchar(200) NOT NULL,
	`hits` int NOT NULL,
	`automated` int NOT NULL DEFAULT 0,
	`at` datetime(3) NOT NULL,
	CONSTRAINT `search_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_search_log_at` ON `search_log` (`at`);