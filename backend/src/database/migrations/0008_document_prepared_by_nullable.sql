-- The Staff/Owner switch was a stand-in for authentication and has been removed until real RBAC
-- is built. Without it there is no truthful value for "who prepared this document", and writing
-- "staff" on every document would be a fabrication — the same reason stock_history.performed_by
-- stays null (see stockHistory.schema.js).
--
-- These columns become nullable and stay null until there are real users to name.

ALTER TABLE "order_forms_v2" ALTER COLUMN "prepared_by" DROP NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "prepared_by" DROP NOT NULL;
