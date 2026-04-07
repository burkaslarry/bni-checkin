-- ============================================================
-- DB Migration: Persist guest check-in time (restart-safe)
-- Target: bni_anchor_guests
-- ============================================================
--
-- Adds:
--   - check_in_time TIMESTAMP WITH TIME ZONE (nullable)
-- Optional:
--   - index for fast lookup by event_date and check_in_time
--
-- Safe to run multiple times.

ALTER TABLE bni_anchor_guests
  ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP WITH TIME ZONE;

-- Helpful index for:
--   - "current event guests who have checked in"
--   - ordering/retrieval for report/records
CREATE INDEX IF NOT EXISTS ix_bni_anchor_guests_event_date_check_in_time
  ON bni_anchor_guests (event_date, check_in_time);

