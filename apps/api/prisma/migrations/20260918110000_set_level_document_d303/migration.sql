-- D303 Settings DOCUMENT scope (document-type prefs, not per-instance)
ALTER TYPE "SetLevel" ADD VALUE IF NOT EXISTS 'DOCUMENT' AFTER 'SITE';
