CREATE TABLE "jobbers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jobbers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "jobber_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "jobbers_normalized_name_unique_idx" ON "jobbers" USING btree ("normalized_name");--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_jobber_id_jobbers_id_fk" FOREIGN KEY ("jobber_id") REFERENCES "public"."jobbers"("id") ON DELETE no action ON UPDATE no action;
