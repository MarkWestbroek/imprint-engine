CREATE TABLE "member_values" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_name" varchar(64) NOT NULL,
	"scope" varchar(32) NOT NULL,
	"item_key" varchar(128) NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_member_values" ON "member_values" USING btree ("user_name","scope","item_key");