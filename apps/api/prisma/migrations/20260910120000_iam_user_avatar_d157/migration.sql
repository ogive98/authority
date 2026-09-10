-- D157: profile photo URL on iam_user
ALTER TABLE "iam_user" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
