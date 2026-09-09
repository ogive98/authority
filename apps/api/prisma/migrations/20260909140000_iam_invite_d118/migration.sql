-- D118: business user invite tokens
CREATE TABLE "iam_invite" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iam_invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "iam_invite_user_id_key" ON "iam_invite"("user_id");
CREATE INDEX "iam_invite_token_hash_idx" ON "iam_invite"("token_hash");

ALTER TABLE "iam_invite" ADD CONSTRAINT "iam_invite_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
