-- Preferred driver hint on sales order (Delivery owns real assignment later)

ALTER TABLE "sal_order" ADD COLUMN "preferred_driver" TEXT;
