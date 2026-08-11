CREATE TABLE "design_semi_sets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "design_semi_sets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"variant_id" integer NOT NULL,
	"label" varchar(100) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_semi_set_sizes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "design_semi_set_sizes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"semi_set_id" integer NOT NULL,
	"design_size_id" integer NOT NULL,
	CONSTRAINT "design_semi_set_sizes_semi_set_id_design_size_id_unique" UNIQUE("semi_set_id","design_size_id")
);
--> statement-breakpoint
ALTER TABLE "design_semi_sets" ADD CONSTRAINT "design_semi_sets_variant_id_color_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."color_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_semi_set_sizes" ADD CONSTRAINT "design_semi_set_sizes_semi_set_id_design_semi_sets_id_fk" FOREIGN KEY ("semi_set_id") REFERENCES "public"."design_semi_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_semi_set_sizes" ADD CONSTRAINT "design_semi_set_sizes_design_size_id_design_sizes_id_fk" FOREIGN KEY ("design_size_id") REFERENCES "public"."design_sizes"("id") ON DELETE cascade ON UPDATE no action;