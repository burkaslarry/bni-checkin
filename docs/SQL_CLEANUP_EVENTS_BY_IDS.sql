-- One-off cleanup: remove attendances + guests (by event date) + events for given IDs.
-- Edit the ID list in the CTE if needed.
-- Safe order: attendances → guests → events (FK).

BEGIN;

WITH target_events AS (
  SELECT id, event_date
  FROM bni_anchor_events
  WHERE id IN (13, 14, 15)
),
del_att AS (
  DELETE FROM bni_anchor_attendances a
  USING target_events t
  WHERE a.event_id = t.id
  RETURNING a.id
),
del_guests AS (
  DELETE FROM bni_anchor_guests g
  USING target_events t
  WHERE g.event_date IS NOT NULL
    AND g.event_date <> ''
    AND g.event_date = t.event_date::text
  RETURNING g.id
),
del_ev AS (
  DELETE FROM bni_anchor_events e
  USING target_events t
  WHERE e.id = t.id
  RETURNING e.id
)
SELECT
  (SELECT COUNT(*) FROM del_att)   AS deleted_attendance_rows,
  (SELECT COUNT(*) FROM del_guests) AS deleted_guest_rows,
  (SELECT COUNT(*) FROM del_ev)    AS deleted_event_rows;

COMMIT;

-- Optional: refresh reporting MV if present (ignore errors if view missing)
-- REFRESH MATERIALIZED VIEW bni_anchor_member_attendance_summary;
