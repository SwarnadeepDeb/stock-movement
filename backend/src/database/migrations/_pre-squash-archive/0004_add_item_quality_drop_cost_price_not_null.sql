ALTER TABLE "designs" ALTER COLUMN "default_cost_price_per_piece" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "item_name" varchar(255);--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "quality" varchar(255);