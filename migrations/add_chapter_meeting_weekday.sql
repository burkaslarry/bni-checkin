-- Preferred weekly meeting day per chapter (JS Date.getDay(): 0=Sun … 6=Sat).
-- Apply:
--   render psql dpg-d6iok5q4d50c738643c0-a --confirm -c "$(grep -v '^--' migrations/add_chapter_meeting_weekday.sql | tr '\n' ' ')"

BEGIN;

ALTER TABLE public.bni_eventxp_chapters
    ADD COLUMN IF NOT EXISTS meeting_weekday SMALLINT NOT NULL DEFAULT 4;

ALTER TABLE public.bni_eventxp_chapters
    DROP CONSTRAINT IF EXISTS bni_eventxp_chapters_meeting_weekday_check;

ALTER TABLE public.bni_eventxp_chapters
    ADD CONSTRAINT bni_eventxp_chapters_meeting_weekday_check
    CHECK (meeting_weekday BETWEEN 0 AND 6);

-- Anchor = Thursday (4); AMax / Dynasty = Wednesday (3)
UPDATE public.bni_eventxp_chapters SET meeting_weekday = 4 WHERE tag = 'anchor';
UPDATE public.bni_eventxp_chapters SET meeting_weekday = 3 WHERE tag IN ('amax', 'dynasty');

COMMIT;
