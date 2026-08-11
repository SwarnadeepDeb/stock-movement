ALTER TABLE "designs" ADD COLUMN "normalized_code" varchar(255);--> statement-breakpoint
ALTER TABLE "color_variants" ADD COLUMN "normalized_color_name" varchar(100);--> statement-breakpoint
UPDATE "designs" SET "normalized_code" = lower(trim("code")) WHERE "code" IS NOT NULL AND trim("code") <> '';--> statement-breakpoint
UPDATE "color_variants" SET "normalized_color_name" = lower(trim("color_name"));--> statement-breakpoint
ALTER TABLE "color_variants" ALTER COLUMN "normalized_color_name" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "designs_pattern_id_normalized_code_unique_idx" ON "designs" USING btree ("pattern_id","normalized_code");--> statement-breakpoint
CREATE UNIQUE INDEX "color_variants_design_id_normalized_color_name_unique_idx" ON "color_variants" USING btree ("design_id","normalized_color_name");