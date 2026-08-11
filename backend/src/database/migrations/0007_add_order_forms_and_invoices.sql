-- Slices 2 and 3 of the Stock Out rebuild: the rewritten order form, and the invoice that
-- dispatches stock by scanned tag.
--
-- The _v2 table names exist because 0006 kept the old tables as legacy_order_forms; the v2
-- suffix avoids ever colliding with them if someone restores one to compare.

CREATE TYPE "order_form_status_v2" AS ENUM ('OPEN', 'INVOICED', 'CANCELLED');

CREATE TABLE "order_forms_v2" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY NOT NULL,
    "form_number" varchar(50) NOT NULL,
    "normalized_form_number" varchar(50) NOT NULL,
    "form_date" date NOT NULL,
    "party_id" integer REFERENCES "parties"("id") ON DELETE SET NULL,
    "party_name" varchar(200) NOT NULL,
    "party_mobile" varchar(20),
    "party_city" varchar(100),
    "party_gst" varchar(20),
    "party_transport" varchar(200),
    "party_agent" varchar(100),
    "notes" text,
    "status" "order_form_status_v2" DEFAULT 'OPEN' NOT NULL,
    "prepared_by" varchar(20) NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX "order_forms_v2_normalized_form_number_unique_idx" ON "order_forms_v2" ("normalized_form_number");
CREATE INDEX "order_forms_v2_party_id_idx" ON "order_forms_v2" ("party_id");
CREATE INDEX "order_forms_v2_status_idx" ON "order_forms_v2" ("status");

CREATE TABLE "order_form_items_v2" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY NOT NULL,
    "order_form_id" integer NOT NULL REFERENCES "order_forms_v2"("id") ON DELETE CASCADE,
    "color_variant_id" integer NOT NULL REFERENCES "color_variants"("id") ON DELETE CASCADE,
    "quantity_pcs" integer NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "order_form_items_v2_form_variant_unique_idx" ON "order_form_items_v2" ("order_form_id", "color_variant_id");

CREATE TABLE "invoices" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY NOT NULL,
    "invoice_number" varchar(50) NOT NULL,
    "normalized_invoice_number" varchar(50) NOT NULL,
    "invoice_date" date NOT NULL,
    "order_form_id" integer NOT NULL REFERENCES "order_forms_v2"("id"),
    "party_id" integer REFERENCES "parties"("id") ON DELETE SET NULL,
    "party_name" varchar(200) NOT NULL,
    "party_mobile" varchar(20),
    "party_city" varchar(100),
    "party_gst" varchar(20),
    "party_transport" varchar(200),
    "party_agent" varchar(100),
    "ticks" jsonb,
    "stock_out_transaction_id" integer REFERENCES "stock_out_transactions"("id") ON DELETE SET NULL,
    "prepared_by" varchar(20) NOT NULL,
    "edited_by" varchar(20),
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX "invoices_normalized_invoice_number_unique_idx" ON "invoices" ("normalized_invoice_number");
CREATE INDEX "invoices_order_form_id_idx" ON "invoices" ("order_form_id");
CREATE INDEX "invoices_party_id_idx" ON "invoices" ("party_id");
CREATE INDEX "invoices_invoice_date_idx" ON "invoices" ("invoice_date");

CREATE TABLE "invoice_entries" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY NOT NULL,
    "invoice_id" integer NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
    "stock_item_id" integer NOT NULL REFERENCES "stock_items"("id"),
    "color_variant_id" integer NOT NULL REFERENCES "color_variants"("id"),
    "kind" "stock_group_type" NOT NULL,
    "scan_code" varchar(32) NOT NULL,
    "pieces" integer NOT NULL,
    "size_breakdown" jsonb NOT NULL,
    "unit_price" numeric(10, 2) NOT NULL,
    "method" varchar(20) NOT NULL,
    "scanned_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "invoice_entries_invoice_stock_item_unique_idx" ON "invoice_entries" ("invoice_id", "stock_item_id");
CREATE INDEX "invoice_entries_invoice_id_idx" ON "invoice_entries" ("invoice_id");
CREATE INDEX "invoice_entries_stock_item_id_idx" ON "invoice_entries" ("stock_item_id");
