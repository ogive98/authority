-- D107 customer salubrité notify channels
ALTER TABLE "cus_customer" ADD COLUMN "salubrita_email" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cus_customer" ADD COLUMN "salubrita_whatsapp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cus_customer" ADD COLUMN "salubrita_portal" BOOLEAN NOT NULL DEFAULT true;
