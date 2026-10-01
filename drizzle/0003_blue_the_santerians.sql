CREATE TABLE `attendances` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`event_slug` varchar(128) NOT NULL,
	`user_name` varchar(64) NOT NULL,
	`status` varchar(16) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	`consent_at` datetime(3) NOT NULL,
	CONSTRAINT `attendances_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_attendances` UNIQUE(`event_slug`,`user_name`)
);
--> statement-breakpoint
CREATE INDEX `idx_attendances_user` ON `attendances` (`user_name`);