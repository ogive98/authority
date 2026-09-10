-- D175: Delivery partial complete — delivered qty on lines + shipment AR snapshot
ALTER TABLE "sal_order_line" ADD COLUMN "delivered_qty" DECIMAL(18,3);

ALTER TABLE "dlv_shipment" ADD COLUMN "amount_delivered" DECIMAL(18,3);
