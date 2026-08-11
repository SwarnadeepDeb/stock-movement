CREATE TABLE "stock_in_challans" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_in_challans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"serial" integer NOT NULL,
	"jobber_name" varchar(150),
	"challan_no" varchar(100) NOT NULL,
	"issued_challan_no" varchar(100),
	"stock_date" date NOT NULL,
	"remarks" text,
	"defect_action" varchar(20),
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"void_reason" text,
	"voided_at" timestamp,
	"entered_by" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_in_challans_serial_unique" UNIQUE("serial")
);
--> statement-breakpoint
CREATE TABLE "stock_in_challan_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_in_challan_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"challan_id" integer NOT NULL,
	"kind" varchar(20) NOT NULL,
	"note" text,
	"changes" jsonb,
	"actor" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_in_challan_events" ADD CONSTRAINT "stock_in_challan_events_challan_id_stock_in_challans_id_fk" FOREIGN KEY ("challan_id") REFERENCES "public"."stock_in_challans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_in_challans_stock_date_idx" ON "stock_in_challans" USING btree ("stock_date");--> statement-breakpoint
CREATE INDEX "stock_in_challans_jobber_name_idx" ON "stock_in_challans" USING btree ("jobber_name");--> statement-breakpoint
CREATE INDEX "stock_in_challan_events_challan_id_idx" ON "stock_in_challan_events" USING btree ("challan_id");--> statement-breakpoint
ALTER TABLE "stock_in_transactions" ADD COLUMN "challan_id" integer;--> statement-breakpoint
ALTER TABLE "stock_in_transactions" ADD COLUMN "defective_pieces" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_in_transactions" ADD COLUMN "defect_category" text;--> statement-breakpoint
ALTER TABLE "stock_in_transactions" ADD CONSTRAINT "stock_in_transactions_challan_id_stock_in_challans_id_fk" FOREIGN KEY ("challan_id") REFERENCES "public"."stock_in_challans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_in_transactions_challan_id_idx" ON "stock_in_transactions" USING btree ("challan_id");--> statement-breakpoint
-- Back-fill: every pre-existing registration becomes a challan. Rows sharing a challan no. and
-- date were one delivery; rows with no challan no. each stand alone. Serials follow the order
-- the deliveries were first entered, so history reads SF-0001 onward.
INSERT INTO "stock_in_challans" ("serial", "challan_no", "stock_date", "created_at")
SELECT row_number() OVER (ORDER BY first_created, first_id), challan_key, stock_date, first_created
FROM (
	SELECT coalesce("challan_no", 'NA-' || "id"::text) AS challan_key,
	       "stock_date",
	       min("created_at") AS first_created,
	       min("id") AS first_id
	FROM "stock_in_transactions"
	GROUP BY coalesce("challan_no", 'NA-' || "id"::text), "stock_date"
) AS grouped;--> statement-breakpoint
UPDATE "stock_in_transactions" AS t
SET "challan_id" = c."id"
FROM "stock_in_challans" AS c
WHERE c."challan_no" = coalesce(t."challan_no", 'NA-' || t."id"::text)
  AND c."stock_date" = t."stock_date";
