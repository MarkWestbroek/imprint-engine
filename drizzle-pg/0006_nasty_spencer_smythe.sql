CREATE TABLE "search_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"query" varchar(200) NOT NULL,
	"hits" integer NOT NULL,
	"automated" integer DEFAULT 0 NOT NULL,
	"at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_search_log_at" ON "search_log" USING btree ("at");