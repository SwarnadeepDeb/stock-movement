CREATE TYPE "public"."stock_item_qr_status" AS ENUM('ACTIVE', 'RETIRED');--> statement-breakpoint
CREATE TYPE "public"."print_job_status" AS ENUM('COMPLETED', 'JAMMED', 'QUEUED_OFFLINE', 'COMPLETED_UNVERIFIED');--> statement-breakpoint
CREATE TYPE "public"."print_job_type" AS ENUM('QR_GENERATE', 'REPRINT', 'RACK_BIN_LABEL', 'TOUR_MANIFEST', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."reprint_reason_code" AS ENUM('LOST', 'TORN', 'FADED', 'REBAG', 'JAM', 'PRICE_CHANGE');--> statement-breakpoint
CREATE TYPE "public"."reprint_request_status" AS ENUM('PENDING', 'PRINTED');--> statement-breakpoint
CREATE TYPE "public"."recovery_entry_status" AS ENUM('PENDING', 'ASSIGNED');--> statement-breakpoint
ALTER TYPE "public"."stock_group_type" ADD VALUE 'PIECE';--> statement-breakpoint
ALTER TYPE "public"."stock_history_event_type" ADD VALUE 'SET_BROKEN';--> statement-breakpoint
CREATE TABLE "racks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "racks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" varchar(20) NOT NULL,
	"label" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "racks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "bins" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bins_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rack_id" integer,
	"code" varchar(20) NOT NULL,
	"label" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bins_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "printers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "printers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"model" varchar(100),
	"location" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "print_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"printer_id" integer,
	"job_type" "print_job_type" NOT NULL,
	"status" "print_job_status" NOT NULL,
	"total_count" integer NOT NULL,
	"jammed_at_count" integer,
	"verified_at" timestamp,
	"created_by" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_job_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "print_job_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"print_job_id" integer NOT NULL,
	"stock_item_qr_id" integer NOT NULL,
	"sequence" integer NOT NULL,
	"printed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "reprint_requests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reprint_requests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"stock_item_id" integer NOT NULL,
	"reason_code" "reprint_reason_code" NOT NULL,
	"raised_by" varchar(100) NOT NULL,
	"rack_id" integer,
	"status" "reprint_request_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "recovery_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recovery_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"status" "recovery_entry_status" DEFAULT 'PENDING' NOT NULL,
	"found_location" varchar(255),
	"notes" varchar(500),
	"assigned_stock_item_id" integer,
	"supervisor_name" varchar(100),
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tag_presets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tag_presets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"design_id" integer NOT NULL,
	"preset_name" varchar(100) NOT NULL,
	"media_size" varchar(50) NOT NULL,
	"default_printer_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tag_presets_design_id_unique" UNIQUE("design_id")
);
--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "rack_id" integer;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "bin_id" integer;--> statement-breakpoint
ALTER TABLE "stock_items" ADD COLUMN "origin_set_stock_item_id" integer;--> statement-breakpoint
ALTER TABLE "stock_item_qr" ADD COLUMN "short_code" varchar(12);--> statement-breakpoint
-- Backfill existing rows (pre-dates shortCode) with a random 6-char code before enforcing NOT NULL.
UPDATE "stock_item_qr" SET "short_code" = upper(substr(md5(random()::text || "id"::text || clock_timestamp()::text), 1, 6)) WHERE "short_code" IS NULL;--> statement-breakpoint
ALTER TABLE "stock_item_qr" ALTER COLUMN "short_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_item_qr" ADD COLUMN "status" "stock_item_qr_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_item_qr" ADD COLUMN "retired_at" timestamp;--> statement-breakpoint
ALTER TABLE "stock_item_qr" ADD COLUMN "retired_reason" varchar(50);--> statement-breakpoint
ALTER TABLE "stock_item_qr" ADD COLUMN "price_snapshot" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "stock_item_qr" ADD COLUMN "price_accepted_at" timestamp;--> statement-breakpoint
ALTER TABLE "bins" ADD CONSTRAINT "bins_rack_id_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."racks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_job_items" ADD CONSTRAINT "print_job_items_print_job_id_print_jobs_id_fk" FOREIGN KEY ("print_job_id") REFERENCES "public"."print_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_job_items" ADD CONSTRAINT "print_job_items_stock_item_qr_id_stock_item_qr_id_fk" FOREIGN KEY ("stock_item_qr_id") REFERENCES "public"."stock_item_qr"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reprint_requests" ADD CONSTRAINT "reprint_requests_stock_item_id_stock_items_id_fk" FOREIGN KEY ("stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reprint_requests" ADD CONSTRAINT "reprint_requests_rack_id_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."racks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_entries" ADD CONSTRAINT "recovery_entries_assigned_stock_item_id_stock_items_id_fk" FOREIGN KEY ("assigned_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_presets" ADD CONSTRAINT "tag_presets_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_presets" ADD CONSTRAINT "tag_presets_default_printer_id_printers_id_fk" FOREIGN KEY ("default_printer_id") REFERENCES "public"."printers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bins_rack_id_idx" ON "bins" USING btree ("rack_id");--> statement-breakpoint
CREATE INDEX "print_job_items_print_job_id_idx" ON "print_job_items" USING btree ("print_job_id");--> statement-breakpoint
CREATE INDEX "print_job_items_stock_item_qr_id_idx" ON "print_job_items" USING btree ("stock_item_qr_id");--> statement-breakpoint
CREATE INDEX "reprint_requests_status_idx" ON "reprint_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reprint_requests_stock_item_id_idx" ON "reprint_requests" USING btree ("stock_item_id");--> statement-breakpoint
CREATE INDEX "recovery_entries_status_idx" ON "recovery_entries" USING btree ("status");--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_rack_id_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."racks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_bin_id_bins_id_fk" FOREIGN KEY ("bin_id") REFERENCES "public"."bins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_origin_set_stock_item_id_stock_items_id_fk" FOREIGN KEY ("origin_set_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_items_rack_id_idx" ON "stock_items" USING btree ("rack_id");--> statement-breakpoint
CREATE INDEX "stock_items_origin_set_stock_item_id_idx" ON "stock_items" USING btree ("origin_set_stock_item_id");--> statement-breakpoint
CREATE INDEX "stock_item_qr_short_code_idx" ON "stock_item_qr" USING btree ("short_code");--> statement-breakpoint
CREATE INDEX "stock_item_qr_status_idx" ON "stock_item_qr" USING btree ("status");