-- D262 Customer fulfillment document preference (sales order vs direct invoice).
-- Default = SALES_ORDER (bon de commande). Invoice drawer may override per document.

CREATE TYPE "CusFulfillmentDoc" AS ENUM ('SALES_ORDER', 'INVOICE');

ALTER TABLE "cus_customer"
  ADD COLUMN "fulfillment_doc" "CusFulfillmentDoc" NOT NULL DEFAULT 'SALES_ORDER';
