CREATE TABLE `notifications` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_name` varchar(64) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`href` varchar(512) NOT NULL,
	`actor` varchar(64),
	`created_at` datetime(3) NOT NULL,
	`read_at` datetime(3),
	`mailed_at` datetime(3),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user` ON `notifications` (`user_name`,`created_at`);