CREATE TABLE "order_form_photos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_form_photos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_form_id" integer NOT NULL,
	"image_url" text NOT NULL,
	"image_public_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_form_photos" ADD CONSTRAINT "order_form_photos_order_form_id_order_forms_id_fk" FOREIGN KEY ("order_form_id") REFERENCES "public"."order_forms"("id") ON DELETE cascade ON UPDATE no action;