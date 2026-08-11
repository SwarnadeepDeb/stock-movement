CREATE TYPE "public"."stock_group_type" AS ENUM('SET', 'BUNDLE', 'LOOSE_PIECE');--> statement-breakpoint
CREATE TYPE "public"."stock_item_status" AS ENUM('AVAILABLE', 'UNSET', 'CONSUMED');--> statement-breakpoint
CREATE TABLE "stock_groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"color_variant_id" integer,
	"type" "stock_group_type" NOT NULL,
	"composition_signature" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"stock_group_id" integer NOT NULL,
	"color_variant_id" integer NOT NULL,
	"design_size_id" integer,
	"stock_in_transaction_id" integer,
	"bundle_id" integer,
	"type" "stock_group_type" NOT NULL,
	"status" "stock_item_status" DEFAULT 'AVAILABLE' NOT NULL,
	"unset_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_item_lineage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_item_lineage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"result_stock_item_id" integer NOT NULL,
	"source_stock_item_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_item_lineage_source_stock_item_id_unique" UNIQUE("source_stock_item_id")
);
--> statement-breakpoint
CREATE TABLE "stock_item_qr" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_item_qr_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"stock_item_id" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_sizes" ADD COLUMN "included_in_set" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_groups" ADD CONSTRAINT "stock_groups_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_stock_group_id_stock_groups_id_fk" FOREIGN KEY ("stock_group_id") REFERENCES "public"."stock_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_design_size_id_design_sizes_id_fk" FOREIGN KEY ("design_size_id") REFERENCES "public"."design_sizes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_stock_in_transaction_id_stock_in_transactions_id_fk" FOREIGN KEY ("stock_in_transaction_id") REFERENCES "public"."stock_in_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_bundle_id_stock_in_bundle_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."stock_in_bundle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_item_lineage" ADD CONSTRAINT "stock_item_lineage_result_stock_item_id_stock_items_id_fk" FOREIGN KEY ("result_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_item_lineage" ADD CONSTRAINT "stock_item_lineage_source_stock_item_id_stock_items_id_fk" FOREIGN KEY ("source_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_item_qr" ADD CONSTRAINT "stock_item_qr_stock_item_id_stock_items_id_fk" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_groups_color_variant_id_idx" ON "stock_groups" USING btree ("color_variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_groups_set_unique_idx" ON "stock_groups" USING btree ("color_variant_id") WHERE "stock_groups"."type" = 'SET';--> statement-breakpoint
CREATE UNIQUE INDEX "stock_groups_bundle_unique_idx" ON "stock_groups" USING btree ("color_variant_id","composition_signature") WHERE "stock_groups"."type" = 'BUNDLE';--> statement-breakpoint
CREATE UNIQUE INDEX "stock_groups_loose_piece_unique_idx" ON "stock_groups" USING btree ("color_variant_id","composition_signature") WHERE "stock_groups"."type" = 'LOOSE_PIECE';--> statement-breakpoint
CREATE INDEX "stock_items_stock_group_id_idx" ON "stock_items" USING btree ("stock_group_id");--> statement-breakpoint
CREATE INDEX "stock_items_stock_in_transaction_id_idx" ON "stock_items" USING btree ("stock_in_transaction_id");--> statement-breakpoint
CREATE INDEX "stock_items_status_idx" ON "stock_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stock_item_lineage_result_stock_item_id_idx" ON "stock_item_lineage" USING btree ("result_stock_item_id");--> statement-breakpoint
CREATE INDEX "stock_item_qr_stock_item_id_idx" ON "stock_item_qr" USING btree ("stock_item_id");