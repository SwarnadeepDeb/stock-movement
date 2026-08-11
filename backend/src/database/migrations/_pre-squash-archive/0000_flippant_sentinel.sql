CREATE TYPE "public"."variant_status" AS ENUM('SET', 'UNSET');--> statement-breakpoint
CREATE TYPE "public"."variant_status_transition_trigger" AS ENUM('STOCK_IN', 'STOCK_OUT', 'MANUAL_ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "designs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "designs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"code" varchar(255),
	"default_cost_price_per_piece" integer NOT NULL,
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
ALTER TABLE "variant_inventory" ADD CONSTRAINT "variant_inventory_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_inventory" ADD CONSTRAINT "variant_inventory_design_size_id_design_sizes_id_fk" FOREIGN KEY ("design_size_id") REFERENCES "public"."design_sizes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_status_transactions" ADD CONSTRAINT "variant_status_transactions_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_status_transactions" ADD CONSTRAINT "variant_status_transactions_stock_in_transaction_id_stock_in_transactions_id_fk" FOREIGN KEY ("stock_in_transaction_id") REFERENCES "public"."stock_in_transactions"("id") ON DELETE set null ON UPDATE no action;