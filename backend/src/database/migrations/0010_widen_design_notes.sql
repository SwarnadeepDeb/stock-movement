-- Design notes may now be up to 300 characters (validated in design.validator.js). Widening a
-- varchar keeps every existing value as-is.
ALTER TABLE "designs" ALTER COLUMN "notes" SET DATA TYPE varchar(300);
