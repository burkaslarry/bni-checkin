-- Soft-delete Anchor 2026-09-24 (created after 17 Sep email). No 24 Sep / 1 Oct meetings.
-- Cron on 1 Oct will open 8 Oct once backend skip/defer logic is deployed.
-- Apply:
--   render psql dpg-d6iok5q4d50c738643c0-a --confirm -c "$(grep -v '^--' migrations/skip_anchor_sep24_oct1_meetings.sql | tr '\n' ' ')"

UPDATE public.bni_eventxp_events
SET status = 'DELETED',
    is_active = false,
    deleted_at = NOW()
WHERE id = 57
  AND chapter_id = 1
  AND event_date = DATE '2026-09-24'
  AND deleted_at IS NULL;

UPDATE public.bni_eventxp_events
SET is_active = true
WHERE id = 56
  AND chapter_id = 1
  AND event_date = DATE '2026-09-17'
  AND deleted_at IS NULL;
