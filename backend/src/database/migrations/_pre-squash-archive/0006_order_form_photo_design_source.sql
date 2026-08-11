CREATE TYPE "public"."order_form_photo_source" AS ENUM('UPLOADED', 'DESIGN');--> statement-breakpoint
ALTER TABLE "order_form_photos" ADD COLUMN "source" "order_form_photo_source" DEFAULT 'UPLOADED' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_form_photos" ADD COLUMN "color_variant_id" integer;--> statement-breakpoint
ALTER TABLE "order_form_photos" ADD CONSTRAINT "order_form_photos_color_variant_id_color_variants_id_fk" FOREIGN KEY ("color_variant_id") REFERENCES "public"."color_variants"("id") ON DELETE no action ON UPDATE no action;