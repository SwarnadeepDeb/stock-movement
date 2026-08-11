-- Running QR serial numbers per colour variant. A variant's sets/semi sets share one run and its
-- individually-tagged pieces (child + loose) share another, so a later inward of the same variant
-- continues after the last printed number instead of restarting at 1.

CREATE TABLE "variant_serial_counters" (
	"color_variant_id" integer PRIMARY KEY NOT NULL REFERENCES "color_variants"("id") ON DELETE CASCADE,
	"last_set_serial" integer DEFAULT 0 NOT NULL,
	"last_piece_serial" integer DEFAULT 0 NOT NULL
);

ALTER TABLE "stock_items" ADD COLUMN "serial_no" integer;
