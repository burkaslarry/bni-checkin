-- Rename bni_anchor_* tables to bni_eventxp_* and add chapter_id to attendances.
-- Apply on Render Postgres:
--   render psql dpg-d6iok5q4d50c738643c0-a --confirm -f migrations/rename_bni_anchor_to_bni_eventxp.sql
--
-- Prerequisite: migrations/add_chapters_and_member_chapter_id.sql and
--               add_chapter_id_events_guests_observers.sql already applied.

BEGIN;

-- Optional materialized view (drop before rename if present)
DROP MATERIALIZED VIEW IF EXISTS public.bni_anchor_member_attendance_summary;

-- Rename core tables (PostgreSQL updates FK references automatically)
ALTER TABLE IF EXISTS public.bni_anchor_profession_groups RENAME TO bni_eventxp_profession_groups;
ALTER TABLE IF EXISTS public.bni_anchor_members RENAME TO bni_eventxp_members;
ALTER TABLE IF EXISTS public.bni_anchor_events RENAME TO bni_eventxp_events;
ALTER TABLE IF EXISTS public.bni_anchor_attendances RENAME TO bni_eventxp_attendances;
ALTER TABLE IF EXISTS public.bni_anchor_guests RENAME TO bni_eventxp_guests;
ALTER TABLE IF EXISTS public.bni_anchor_observers RENAME TO bni_eventxp_observers;
ALTER TABLE IF EXISTS public.bni_anchor_attendance_logs RENAME TO bni_eventxp_attendance_logs;

-- attendances: add chapter_id (inherits from event; denormalized for direct scope)
ALTER TABLE public.bni_eventxp_attendances
    ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES public.bni_eventxp_chapters(id);

UPDATE public.bni_eventxp_attendances a
SET chapter_id = e.chapter_id
FROM public.bni_eventxp_events e
WHERE a.event_id = e.id
  AND a.chapter_id IS NULL;

UPDATE public.bni_eventxp_attendances
SET chapter_id = (SELECT id FROM public.bni_eventxp_chapters WHERE tag = 'anchor')
WHERE chapter_id IS NULL;

ALTER TABLE public.bni_eventxp_attendances
    ALTER COLUMN chapter_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bni_eventxp_attendances_chapter_id
    ON public.bni_eventxp_attendances (chapter_id);

CREATE INDEX IF NOT EXISTS idx_bni_eventxp_attendances_chapter_event
    ON public.bni_eventxp_attendances (chapter_id, event_id);

-- profession_groups: shared codes; default anchor chapter for legacy rows
ALTER TABLE public.bni_eventxp_profession_groups
    ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES public.bni_eventxp_chapters(id);

UPDATE public.bni_eventxp_profession_groups
SET chapter_id = (SELECT id FROM public.bni_eventxp_chapters WHERE tag = 'anchor')
WHERE chapter_id IS NULL;

ALTER TABLE public.bni_eventxp_profession_groups
    ALTER COLUMN chapter_id SET NOT NULL;

-- attendance_logs (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bni_eventxp_attendance_logs'
  ) THEN
    ALTER TABLE public.bni_eventxp_attendance_logs
      ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES public.bni_eventxp_chapters(id);
    UPDATE public.bni_eventxp_attendance_logs
    SET chapter_id = (SELECT id FROM public.bni_eventxp_chapters WHERE tag = 'anchor')
    WHERE chapter_id IS NULL;
    ALTER TABLE public.bni_eventxp_attendance_logs
      ALTER COLUMN chapter_id SET NOT NULL;
  END IF;
END $$;

COMMIT;
