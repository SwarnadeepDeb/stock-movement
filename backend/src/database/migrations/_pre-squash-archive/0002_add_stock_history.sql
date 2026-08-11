CREATE TYPE "public"."stock_history_event_type" AS ENUM('STOCK_IN', 'SET_ASSEMBLED', 'BUNDLE_ASSEMBLED');--> statement-breakpoint
CREATE TABLE "stock_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_type" "stock_history_event_type" NOT NULL,
	"color_variant_id" integer NOT NULL,
	"stock_group_id" integer,
	"result_stock_item_id" integer,
	"stock_in_transaction_id" integer,
	"quantity" integer NOT NULL,
	"metadata" jsonb,
	"performed_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_stock_group_id_stock_groups_id_fk" FOREIGN KEY ("stock_group_id") REFERENCES "public"."stock_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_result_stock_item_id_stock_items_id_fk" FOREIGN KEY ("result_stock_item_id") REFERENCES "public"."stock_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_stock_in_transaction_id_stock_in_transactions_id_fk" FOREIGN KEY ("stock_in_transaction_id") REFERENCES "public"."stock_in_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_history_event_type_idx" ON "stock_history" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "stock_history_color_variant_id_idx" ON "stock_history" USING btree ("color_variant_id");--> statement-breakpoint
CREATE INDEX "stock_history_created_at_idx" ON "stock_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_history_color_variant_id_created_at_idx" ON "stock_history" USING btree ("color_variant_id","created_at");
