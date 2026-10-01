CREATE TABLE "attendances" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_slug" varchar(128) NOT NULL,
	"user_name" varchar(64) NOT NULL,
	"status" varchar(16) NOT NULL,
	"created_at" timestamp (3) with time zone NOT NULL,
	"updated_at" timestamp (3) with time zone NOT NULL,
	"consent_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_attendances" ON "attendances" USING btree ("event_slug","user_name");--> statement-breakpoint
CREATE INDEX "idx_attendances_user" ON "attendances" USING btree ("user_name");