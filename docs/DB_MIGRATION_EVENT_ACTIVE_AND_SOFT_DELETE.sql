-- ============================================================
-- DB Migration: event active-state + soft-delete support
-- Target: bni_anchor_events
-- ============================================================

ALTER TABLE bni_anchor_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE bni_anchor_events
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE bni_anchor_events
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS ix_bni_anchor_events_status_date_time
  ON bni_anchor_events (status, event_date, start_time)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_bni_anchor_events_is_active
  ON bni_anchor_events (is_active)
  WHERE deleted_at IS NULL;

