CREATE TYPE "public"."stock_group_type" AS ENUM('SET', 'BUNDLE', 'LOOSE_PIECE');--> statement-breakpoint
CREATE TYPE "public"."stock_item_status" AS ENUM('AVAILABLE', 'UNSET', 'CONSUMED');--> statement-breakpoint
CREATE TYPE "public"."variant_status" AS ENUM('SET', 'UNSET');--> statement-breakpoint
CREATE TYPE "public"."variant_status_transition_trigger" AS ENUM('STOCK_IN', 'STOCK_OUT', 'MANUAL_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."stock_history_event_type" AS ENUM('STOCK_IN', 'SET_ASSEMBLED', 'BUNDLE_ASSEMBLED', 'STOCK_OUT');--> statement-breakpoint
CREATE TYPE "public"."order_form_status" AS ENUM('DRAFT', 'SHARED', 'CONVERTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."order_form_item_type" AS ENUM('SET', 'LOOSE_PIECE');--> statement-breakpoint
CREATE TYPE "public"."order_form_photo_source" AS ENUM('UPLOADED', 'DESIGN');--> statement-breakpoint
CREATE TABLE "jobbers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "jobbers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qualities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "qualities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patterns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "patterns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "designs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "designs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"pattern_id" integer,
	"code" varchar(255),
	"item_name" varchar(255),
	"quality" varchar(255),
	"quality_id" integer,
	"jobber_id" integer,
	"default_cost_price_per_piece" integer,
	"default_selling_price_per_piece" integer NOT NULL,
	"notes" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "design_sizes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "design_sizes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"variant_id" integer NOT NULL,
	"size_label" varchar(50) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"unset_price_per_size" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"included_in_set" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "color_variants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "color_variants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"design_id" integer NOT NULL,
	"color_name" varchar(100) NOT NULL,
	"color_hex" varchar(7) NOT NULL,
	"image_url" varchar(500) NOT NULL,
	"image_public_id" varchar(255) NOT NULL,
	"qr_payload" varchar(255) NOT NULL,
	"qr_generated_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_in_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_in_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"variant_id" integer NOT NULL,
	"stock_date" date NOT NULL,
	"challan_no" text,
	"total_sets_received" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_in_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_in_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"stock_in_transaction_id" integer NOT NULL,
	"color_variant_id" integer NOT NULL,
	"design_size_id" integer NOT NULL,
	"quantity_added" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_in_bundle" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_in_bundle_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"stock_in_transaction_id" integer NOT NULL,
	"bundle_number" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_in_bundle_pieces" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_in_bundle_pieces_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bundle_id" integer NOT NULL,
	"design_size_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "stock_in_bundle_pieces_bundle_id_design_size_id_unique" UNIQUE("bundle_id","design_size_id")
);
--> statement-breakpoint
CREATE TABLE "stock_in_loose_pieces" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_in_loose_pieces_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"stock_in_transaction_id" integer NOT NULL,
	"design_size_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "stock_in_loose_pieces_stock_in_transaction_id_design_size_id_unique" UNIQUE("stock_in_transaction_id","design_size_id")
);
--> statement-breakpoint
CREATE TABLE "stock_out_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_out_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"transaction_date" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_out_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_out_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"stock_out_transaction_id" integer NOT NULL,
	"color_variant_id" integer NOT NULL,
	"design_size_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "variant_inventory" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "variant_inventory_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"color_variant_id" integer NOT NULL,
	"design_size_id" integer NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "variant_inventory_color_variant_id_design_size_id_unique" UNIQUE("color_variant_id","design_size_id")
);
--> statement-breakpoint
CREATE TABLE "variant_status_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "variant_status_transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"color_variant_id" integer NOT NULL,
	"stock_in_transaction_id" integer,
	"from_status" "variant_status" NOT NULL,
	"to_status" "variant_status" NOT NULL,
	"trigger_source" "variant_status_transition_trigger" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_item_qr" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_item_qr_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"stock_item_id" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_type" "stock_history_event_type" NOT NULL,
	"color_variant_id" integer NOT NULL,
	"stock_group_id" integer,
	"result_stock_item_id" integer,
	"stock_in_transaction_id" integer,
	"stock_out_transaction_id" integer,
	"quantity" integer NOT NULL,
	"metadata" jsonb,
	"performed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_forms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_forms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"retailer_name" text NOT NULL,
	"contact_person" text,
	"location" text,
	"order_date" date NOT NULL,
	"status" "order_form_status" DEFAULT 'DRAFT' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_form_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_form_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_form_id" integer NOT NULL,
	"color_variant_id" integer NOT NULL,
	"type" "order_form_item_type" NOT NULL,
	"quantity" integer NOT NULL,
	"loose_pieces_breakdown" jsonb,
	"unit_price" numeric(10, 2) NOT NULL,
	"estimated_value" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_form_photos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_form_photos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_form_id" integer NOT NULL,
	"image_url" text NOT NULL,
	"image_public_id" text NOT NULL,
	"source" "order_form_photo_source" DEFAULT 'UPLOADED' NOT NULL,
	"color_variant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_pattern_id_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."patterns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_quality_id_qualities_id_fk" FOREIGN KEY ("quality_id") REFERENCES "public"."qualities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_jobber_id_jobbers_id_fk" FOREIGN KEY ("jobber_id") REFERENCES "public"."jobbers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_sizes" ADD CONSTRAINT "design_sizes_variant_id_color_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "color_variants" ADD CONSTRAINT "color_variants_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_transactions" ADD CONSTRAINT "stock_in_transactions_variant_id_color_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_entries" ADD CONSTRAINT "stock_in_entries_stock_in_transaction_id_stock_in_transactions_id_fk" FOREIGN KEY ("stock_in_transaction_id") REFERENCES "public"."stock_in_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_entries" ADD CONSTRAINT "stock_in_entries_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_entries" ADD CONSTRAINT "stock_in_entries_design_size_id_design_sizes_id_fk" FOREIGN KEY ("design_size_id") REFERENCES "public"."design_sizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_bundle" ADD CONSTRAINT "stock_in_bundle_stock_in_transaction_id_stock_in_transactions_id_fk" FOREIGN KEY ("stock_in_transaction_id") REFERENCES "public"."stock_in_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_bundle_pieces" ADD CONSTRAINT "stock_in_bundle_pieces_bundle_id_stock_in_bundle_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."stock_in_bundle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_bundle_pieces" ADD CONSTRAINT "stock_in_bundle_pieces_design_size_id_design_sizes_id_fk" FOREIGN KEY ("design_size_id") REFERENCES "public"."design_sizes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_loose_pieces" ADD CONSTRAINT "stock_in_loose_pieces_stock_in_transaction_id_stock_in_transactions_id_fk" FOREIGN KEY ("stock_in_transaction_id") REFERENCES "public"."stock_in_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_in_loose_pieces" ADD CONSTRAINT "stock_in_loose_pieces_design_size_id_design_sizes_id_fk" FOREIGN KEY ("design_size_id") REFERENCES "public"."design_sizes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_out_entries" ADD CONSTRAINT "stock_out_entries_stock_out_transaction_id_stock_out_transactions_id_fk" FOREIGN KEY ("stock_out_transaction_id") REFERENCES "public"."stock_out_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_out_entries" ADD CONSTRAINT "stock_out_entries_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_out_entries" ADD CONSTRAINT "stock_out_entries_design_size_id_design_sizes_id_fk" FOREIGN KEY ("design_size_id") REFERENCES "public"."design_sizes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_groups" ADD CONSTRAINT "stock_groups_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_stock_group_id_stock_groups_id_fk" FOREIGN KEY ("stock_group_id") REFERENCES "public"."stock_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_design_size_id_design_sizes_id_fk" FOREIGN KEY ("design_size_id") REFERENCES "public"."design_sizes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_stock_in_transaction_id_stock_in_transactions_id_fk" FOREIGN KEY ("stock_in_transaction_id") REFERENCES "public"."stock_in_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_bundle_id_stock_in_bundle_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."stock_in_bundle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_item_lineage" ADD CONSTRAINT "stock_item_lineage_result_stock_item_id_stock_items_id_fk" FOREIGN KEY ("result_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_item_lineage" ADD CONSTRAINT "stock_item_lineage_source_stock_item_id_stock_items_id_fk" FOREIGN KEY ("source_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_inventory" ADD CONSTRAINT "variant_inventory_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_inventory" ADD CONSTRAINT "variant_inventory_design_size_id_design_sizes_id_fk" FOREIGN KEY ("design_size_id") REFERENCES "public"."design_sizes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_status_transactions" ADD CONSTRAINT "variant_status_transactions_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_status_transactions" ADD CONSTRAINT "variant_status_transactions_stock_in_transaction_id_stock_in_transactions_id_fk" FOREIGN KEY ("stock_in_transaction_id") REFERENCES "public"."stock_in_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_item_qr" ADD CONSTRAINT "stock_item_qr_stock_item_id_stock_items_id_fk" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_stock_group_id_stock_groups_id_fk" FOREIGN KEY ("stock_group_id") REFERENCES "public"."stock_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_result_stock_item_id_stock_items_id_fk" FOREIGN KEY ("result_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_stock_in_transaction_id_stock_in_transactions_id_fk" FOREIGN KEY ("stock_in_transaction_id") REFERENCES "public"."stock_in_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_stock_out_transaction_id_stock_out_transactions_id_fk" FOREIGN KEY ("stock_out_transaction_id") REFERENCES "public"."stock_out_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_form_items" ADD CONSTRAINT "order_form_items_order_form_id_order_forms_id_fk" FOREIGN KEY ("order_form_id") REFERENCES "public"."order_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_form_items" ADD CONSTRAINT "order_form_items_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_form_photos" ADD CONSTRAINT "order_form_photos_order_form_id_order_forms_id_fk" FOREIGN KEY ("order_form_id") REFERENCES "public"."order_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_form_photos" ADD CONSTRAINT "order_form_photos_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "jobbers_normalized_name_unique_idx" ON "jobbers" USING btree ("normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "qualities_normalized_name_unique_idx" ON "qualities" USING btree ("normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "patterns_normalized_name_unique_idx" ON "patterns" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "stock_groups_color_variant_id_idx" ON "stock_groups" USING btree ("color_variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_groups_set_unique_idx" ON "stock_groups" USING btree ("color_variant_id") WHERE "stock_groups"."type" = 'SET';--> statement-breakpoint
CREATE UNIQUE INDEX "stock_groups_bundle_unique_idx" ON "stock_groups" USING btree ("color_variant_id","composition_signature") WHERE "stock_groups"."type" = 'BUNDLE';--> statement-breakpoint
CREATE UNIQUE INDEX "stock_groups_loose_piece_unique_idx" ON "stock_groups" USING btree ("color_variant_id","composition_signature") WHERE "stock_groups"."type" = 'LOOSE_PIECE';--> statement-breakpoint
CREATE INDEX "stock_items_stock_group_id_idx" ON "stock_items" USING btree ("stock_group_id");--> statement-breakpoint
CREATE INDEX "stock_items_stock_in_transaction_id_idx" ON "stock_items" USING btree ("stock_in_transaction_id");--> statement-breakpoint
CREATE INDEX "stock_items_status_idx" ON "stock_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stock_item_lineage_result_stock_item_id_idx" ON "stock_item_lineage" USING btree ("result_stock_item_id");--> statement-breakpoint
CREATE INDEX "stock_item_qr_stock_item_id_idx" ON "stock_item_qr" USING btree ("stock_item_id");--> statement-breakpoint
CREATE INDEX "stock_history_event_type_idx" ON "stock_history" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "stock_history_color_variant_id_idx" ON "stock_history" USING btree ("color_variant_id");--> statement-breakpoint
CREATE INDEX "stock_history_created_at_idx" ON "stock_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_history_color_variant_id_created_at_idx" ON "stock_history" USING btree ("color_variant_id","created_at");