-- Item Name becomes a lookup table, like qualities: the Register/Edit Design dropdown reads from
-- it, and a new name typed on a design is added on save (ItemNameRepository.findOrCreate).
-- designs.item_name stays as the denormalized display copy; designs.item_name_id links the row.
-- Item names are stored in capitals (see design.validator.js), so existing ones are upper-cased too.

CREATE TABLE "item_names" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "item_names_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX "item_names_normalized_name_unique_idx" ON "item_names" USING btree ("normalized_name");--> statement-breakpoint

-- Defaults, inserted one by one so their ids (and so the dropdown order) follow this list.
INSERT INTO "item_names" ("name", "normalized_name") VALUES ('KURTI PANT', 'kurti pant');--> statement-breakpoint
INSERT INTO "item_names" ("name", "normalized_name") VALUES ('KURTI PANT DUPATTA', 'kurti pant dupatta');--> statement-breakpoint
INSERT INTO "item_names" ("name", "normalized_name") VALUES ('TUNIC', 'tunic');--> statement-breakpoint
INSERT INTO "item_names" ("name", "normalized_name") VALUES ('CO-ORD SET', 'co-ord set');--> statement-breakpoint
INSERT INTO "item_names" ("name", "normalized_name") VALUES ('SAMPLE DESIGN', 'sample design');--> statement-breakpoint
INSERT INTO "item_names" ("name", "normalized_name") VALUES ('SHORT TOPS', 'short tops');--> statement-breakpoint
INSERT INTO "item_names" ("name", "normalized_name") VALUES ('FROCK', 'frock');--> statement-breakpoint

-- Item names already typed on existing designs, in capitals (one row per normalized name).
INSERT INTO "item_names" ("name", "normalized_name")
SELECT DISTINCT ON (normalized) trimmed, normalized
FROM (
	SELECT
		upper(regexp_replace(trim("item_name"), '\s+', ' ', 'g')) AS trimmed,
		lower(regexp_replace(trim("item_name"), '\s+', ' ', 'g')) AS normalized,
		"id"
	FROM "designs"
	WHERE "item_name" IS NOT NULL AND trim("item_name") <> ''
) existing
ORDER BY normalized, "id"
ON CONFLICT ("normalized_name") DO NOTHING;--> statement-breakpoint

ALTER TABLE "designs" ADD COLUMN "item_name_id" integer;--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_item_name_id_item_names_id_fk" FOREIGN KEY ("item_name_id") REFERENCES "public"."item_names"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

UPDATE "designs" d
SET "item_name_id" = i."id"
FROM "item_names" i
WHERE i."normalized_name" = lower(regexp_replace(trim(d."item_name"), '\s+', ' ', 'g'));--> statement-breakpoint

-- Keep the denormalized copy in step with the (capitalised) lookup row.
UPDATE "designs" d
SET "item_name" = i."name"
FROM "item_names" i
WHERE d."item_name_id" = i."id";
