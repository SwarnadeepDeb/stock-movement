-- Slice 1 of the Stock Out rebuild: introduces the party master, migrates retailer identities
-- off the old order-form tables, and retires those tables by rename (not drop) so the change is
-- reversible.

CREATE TABLE "parties" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name" varchar(200) NOT NULL,
    "normalized_name" varchar(200) NOT NULL,
    "mobile" varchar(20),
    "city" varchar(100),
    "gst" varchar(20),
    "transport" varchar(200),
    "agent" varchar(100),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX "parties_normalized_name_unique_idx" ON "parties" ("normalized_name");

-- Back-fill one party per distinct normalized retailer name. DISTINCT ON picks that retailer's
-- most recent order form as the source of the display name and city, so the newest spelling and
-- location win. Runs before the rename below because the data is only reachable while the table
-- is still called order_forms. A no-op when order_forms is empty.
INSERT INTO "parties" ("name", "normalized_name", "city")
SELECT DISTINCT ON (lower(trim("retailer_name")))
    trim("retailer_name"),
    lower(trim("retailer_name")),
    nullif(trim(coalesce("location", '')), '')
FROM "order_forms"
WHERE trim(coalesce("retailer_name", '')) <> ''
ORDER BY lower(trim("retailer_name")), "created_at" DESC;

-- Retire the old order-form module's tables. Renamed rather than dropped: the application stops
-- referencing them the moment schema.js drops its exports, so this is equivalent from the code's
-- point of view, but recoverable. A later migration drops them once the rebuild is trusted.
ALTER TABLE "order_form_photos" RENAME TO "legacy_order_form_photos";
ALTER TABLE "order_form_items" RENAME TO "legacy_order_form_items";
ALTER TABLE "order_forms" RENAME TO "legacy_order_forms";
