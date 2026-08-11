CREATE TYPE "public"."order_form_status" AS ENUM('DRAFT', 'SHARED', 'CONVERTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."order_form_item_type" AS ENUM('SET', 'LOOSE_PIECE');--> statement-breakpoint
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
ALTER TABLE "order_form_items" ADD CONSTRAINT "order_form_items_order_form_id_order_forms_id_fk" FOREIGN KEY ("order_form_id") REFERENCES "public"."order_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_form_items" ADD CONSTRAINT "order_form_items_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE no action ON UPDATE no action;