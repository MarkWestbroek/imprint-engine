CREATE TABLE `member_values` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_name` varchar(64) NOT NULL,
	`scope` varchar(32) NOT NULL,
	`item_key` varchar(128) NOT NULL,
	`value` text NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `member_values_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_member_values` UNIQUE(`user_name`,`scope`,`item_key`)
);
