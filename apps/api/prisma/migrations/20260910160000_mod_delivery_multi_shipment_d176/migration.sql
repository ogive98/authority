-- D176: allow multiple shipments per order (remaining delivery)
DROP INDEX IF EXISTS "dlv_shipment_company_id_order_id_key";

CREATE INDEX "dlv_shipment_company_id_order_id_idx"
  ON "dlv_shipment"("company_id", "order_id");
