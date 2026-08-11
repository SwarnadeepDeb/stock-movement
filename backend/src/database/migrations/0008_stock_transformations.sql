CREATE TYPE "public"."stock_item_custody" AS ENUM('STOCK', 'DISPLAY', 'SALESPERSON', 'SAMPLE', 'ALTERATION');--> statement-breakpoint
CREATE TYPE "public"."stock_transformation_type" AS ENUM('BREAK', 'FORM', 'MOVE', 'RETURN', 'UNDO');--> statement-breakpoint
CREATE TABLE "stock_transformations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_transformations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" "stock_transformation_type" NOT NULL,
	"color_variant_id" integer NOT NULL,
	"unit_stock_item_id" integer,
	"restored_from_stock_item_id" integer,
	"reason" varchar(150),
	"note" text,
	"metadata" jsonb,
	"snapshot_before" jsonb NOT NULL,
	"snapshot_after" jsonb NOT NULL,
	"target_transformation_id" integer,
	"undone_at" timestamp,
	"created_by" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "parent_stock_item_id" integer;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "custody_type" "stock_item_custody" DEFAULT 'STOCK' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "custody_holder" varchar(150);--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "custody_since" timestamp;--> statement-breakpoint
ALTER TABLE "stock_transformations" ADD CONSTRAINT "stock_transformations_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transformations" ADD CONSTRAINT "stock_transformations_target_transformation_id_stock_transformations_id_fk" FOREIGN KEY ("target_transformation_id") REFERENCES "public"."stock_transformations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_transformations_color_variant_id_idx" ON "stock_transformations" USING btree ("color_variant_id");--> statement-breakpoint
CREATE INDEX "stock_transformations_created_at_idx" ON "stock_transformations" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_parent_stock_item_id_stock_items_id_fk" FOREIGN KEY ("parent_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_items_parent_stock_item_id_idx" ON "stock_items" USING btree ("parent_stock_item_id");--> statement-breakpoint
-- Data backfill: child tags created alongside their set (Stock In Parent+Child tagging) are
-- physically inside that set. Pieces produced by QR Center's old "Break set" are not — they
-- were broken out — so they stay loose.
UPDATE "stock_items" SET "parent_stock_item_id" = "origin_set_stock_item_id"
WHERE "type" = 'PIECE' AND "origin_set_stock_item_id" IS NOT NULL
  AND "origin_set_stock_item_id" NOT IN (
    SELECT ("metadata"->>'sourceStockItemId')::int FROM "stock_history" WHERE "event_type" = 'SET_BROKEN'
  );--> statement-breakpoint
-- A set that was broken is no longer a set in stock: its pieces are counted individually now.
-- (Before this change a broken set stayed AVAILABLE and was still counted — and sellable — as a set.)
UPDATE "stock_items" SET "status" = 'CONSUMED'
WHERE "id" IN (SELECT ("metadata"->>'sourceStockItemId')::int FROM "stock_history" WHERE "event_type" = 'SET_BROKEN')
  AND "status" <> 'CONSUMED';
