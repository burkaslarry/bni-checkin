-- Track whether attendance CSV was emailed after event end.
-- Apply on Render Postgres:
--   render psql dpg-d6iok5q4d50c738643c0-a --confirm -c "$(grep -v '^--' migrations/add_attendance_email_sent_at.sql | tr '\n' ' ')"

ALTER TABLE public.bni_anchor_events
    ADD COLUMN IF NOT EXISTS attendance_email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bni_anchor_events_attendance_email_pending
    ON public.bni_anchor_events (status, attendance_email_sent_at)
    WHERE deleted_at IS NULL AND attendance_email_sent_at IS NULL;
