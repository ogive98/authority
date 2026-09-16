-- D289 — Automation event-driven suggest triggers/actions (ASSISTED only)
ALTER TYPE "AtmTriggerKind" ADD VALUE IF NOT EXISTS 'TAX_TEJ_PACK_PREPARED';
ALTER TYPE "AtmActionKind" ADD VALUE IF NOT EXISTS 'TEJ_IMPORT_HINT';
