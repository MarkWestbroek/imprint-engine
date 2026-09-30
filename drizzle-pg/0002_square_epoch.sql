CREATE TABLE "email_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_name" varchar(64) NOT NULL,
	"purpose" varchar(16) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"used_at" timestamp (3) with time zone,
	CONSTRAINT "email_tokens_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"role" varchar(16) DEFAULT 'member' NOT NULL,
	"created_by" varchar(64) NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "invites_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"group_slug" varchar(128) NOT NULL,
	"user_name" varchar(64) NOT NULL,
	"role" varchar(16) DEFAULT 'member' NOT NULL,
	"status" varchar(16) DEFAULT 'requested' NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"decided_at" timestamp (3) with time zone,
	"decided_by" varchar(64)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp (3) with time zone;--> statement-breakpoint
CREATE INDEX "idx_email_tokens_user" ON "email_tokens" USING btree ("user_name");--> statement-breakpoint
CREATE INDEX "idx_invites_group" ON "invites" USING btree ("group_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_memberships" ON "memberships" USING btree ("group_slug","user_name");--> statement-breakpoint
CREATE INDEX "idx_memberships_user" ON "memberships" USING btree ("user_name");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");