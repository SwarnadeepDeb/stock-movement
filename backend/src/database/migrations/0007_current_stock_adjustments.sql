CREATE TYPE "public"."stock_adjustment_type" AS ENUM('ADD', 'REMOVE', 'LEVEL', 'REVERSE');--> statement-breakpoint
ALTER TYPE "public"."stock_history_event_type" ADD VALUE 'STOCK_ADJUSTED_IN';--> statement-breakpoint
ALTER TYPE "public"."stock_history_event_type" ADD VALUE 'STOCK_ADJUSTED_OUT';--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_adjustments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"color_variant_id" integer NOT NULL,
	"type" "stock_adjustment_type" NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"reason" varchar(100) NOT NULL,
	"note" text,
	"from_level" integer,
	"to_level" integer,
	"target_adjustment_id" integer,
	"reversed_at" timestamp,
	"metadata" jsonb,
	"created_by" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "color_variants" ADD COLUMN "low_stock_level" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_target_adjustment_id_stock_adjustments_id_fk" FOREIGN KEY ("target_adjustment_id") REFERENCES "public"."stock_adjustments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_adjustments_color_variant_id_idx" ON "stock_adjustments" USING btree ("color_variant_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_created_at_idx" ON "stock_adjustments" USING btree ("created_at");