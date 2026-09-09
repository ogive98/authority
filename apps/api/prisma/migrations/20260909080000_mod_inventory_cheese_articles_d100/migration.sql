-- D100 Inventory cheese articles (shelf life → auto DLC)
CREATE TABLE "inv_cheese_article" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "shelf_life_days" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inv_cheese_article_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inv_cheese_article_company_id_product_id_key"
  ON "inv_cheese_article"("company_id", "product_id");

CREATE INDEX "inv_cheese_article_company_id_active_idx"
  ON "inv_cheese_article"("company_id", "active");
