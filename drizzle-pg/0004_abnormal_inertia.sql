CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_name" varchar(64) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"title" varchar(255) NOT NULL,
	"href" varchar(512) NOT NULL,
	"actor" varchar(64),
	"created_at" timestamp (3) with time zone NOT NULL,
	"read_at" timestamp (3) with time zone,
	"mailed_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_name","created_at");