-- D244 Customer 360 — DocLinkType CUSTOMER (direct customer dossier attachment)

DO $$ BEGIN
  ALTER TYPE "DocLinkType" ADD VALUE IF NOT EXISTS 'CUSTOMER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
