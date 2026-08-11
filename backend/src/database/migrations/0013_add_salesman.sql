-- Who took the order. Entered on the order form; the invoice stores its own copy when it is
-- generated, so a printed invoice keeps the name it was printed with.

ALTER TABLE "order_forms_v2" ADD COLUMN "salesman" varchar(60);
ALTER TABLE "invoices" ADD COLUMN "salesman" varchar(60);

UPDATE "invoices" SET "salesman" = "order_forms_v2"."salesman"
FROM "order_forms_v2" WHERE "invoices"."order_form_id" = "order_forms_v2"."id";
