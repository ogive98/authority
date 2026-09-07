-- THU-PLAT-04: prune support for core_processed_event

CREATE INDEX IF NOT EXISTS "core_processed_event_processed_at_idx"
  ON "core_processed_event"("processed_at");
