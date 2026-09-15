-- D262 correction: printed title is Facture vs Bon de livraison (same fin_invoice).
-- Replaces SALES_ORDER (bon de commande) — the toggle does not change document type.

CREATE TYPE "CusFulfillmentDoc_new" AS ENUM ('DELIVERY_NOTE', 'INVOICE');

ALTER TABLE "cus_customer" ALTER COLUMN "fulfillment_doc" DROP DEFAULT;

ALTER TABLE "cus_customer"
  ALTER COLUMN "fulfillment_doc" TYPE "CusFulfillmentDoc_new"
  USING (
    CASE
      WHEN "fulfillment_doc"::text = 'SALES_ORDER' THEN 'DELIVERY_NOTE'::"CusFulfillmentDoc_new"
      ELSE "fulfillment_doc"::text::"CusFulfillmentDoc_new"
    END
  );

DROP TYPE "CusFulfillmentDoc";

ALTER TYPE "CusFulfillmentDoc_new" RENAME TO "CusFulfillmentDoc";

ALTER TABLE "cus_customer"
  ALTER COLUMN "fulfillment_doc" SET DEFAULT 'DELIVERY_NOTE';

ALTER TABLE "fin_invoice"
  ADD COLUMN "fulfillment_doc" "CusFulfillmentDoc" NOT NULL DEFAULT 'DELIVERY_NOTE';
