CREATE TABLE "content_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" varchar(32) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"lang" varchar(8) DEFAULT 'en' NOT NULL,
	"data" jsonb NOT NULL,
	"valid_from" timestamp (3) with time zone NOT NULL,
	"valid_to" timestamp (3) with time zone,
	"tx_from" timestamp (3) with time zone NOT NULL,
	"tx_to" timestamp (3) with time zone,
	"created_by" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"hashed_password" varchar(255) NOT NULL,
	"role" varchar(16) DEFAULT 'reader' NOT NULL,
	CONSTRAINT "users_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE INDEX "idx_current" ON "content_items" USING btree ("type","slug","lang","tx_to");--> statement-breakpoint
CREATE INDEX "idx_type" ON "content_items" USING btree ("type","tx_to");