CREATE TABLE "api_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_name" varchar(64) NOT NULL,
	"name" varchar(64) NOT NULL,
	"prefix" varchar(16) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"scopes" varchar(255) NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"expires_at" timestamp (3) with time zone,
	"last_used_at" timestamp (3) with time zone,
	"revoked_at" timestamp (3) with time zone,
	CONSTRAINT "api_tokens_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE INDEX "idx_tokens_user" ON "api_tokens" USING btree ("user_name");