CREATE TABLE "lic_current" (
    "id" UUID NOT NULL,
    "payload_json" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "cached_until" TIMESTAMPTZ(6),
    "last_online_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lic_current_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lic_history" (
    "id" UUID NOT NULL,
    "payload_json" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "activated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lic_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lic_history_activated_at_idx" ON "lic_history"("activated_at" DESC);
