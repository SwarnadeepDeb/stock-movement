CREATE TABLE "patterns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "patterns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "pattern_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "patterns_normalized_name_unique_idx" ON "patterns" USING btree ("normalized_name");--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_pattern_id_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."patterns"("id") ON DELETE no action ON UPDATE no action;
