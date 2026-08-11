-- Split from 0001_add_qr_center.sql into its own transaction: Postgres disallows using an
-- enum value added by ALTER TYPE ... ADD VALUE within the same transaction it was added in,
-- and 0001 adds 'PIECE' to stock_group_type.
CREATE UNIQUE INDEX "stock_groups_piece_unique_idx" ON "stock_groups" USING btree ("color_variant_id") WHERE "stock_groups"."type" = 'PIECE';
