-- Guests: whether they later joined. Observers: visiting BNI chapter, blank when none.
-- Apply on Render Postgres only:
--   render psql dpg-d6iok5q4d50c738643c0-a --confirm -c "$(grep -v '^--' migrations/guest_became_member_observer_chapter.sql | tr '\n' ' ')"

ALTER TABLE public.bni_eventxp_guests
    ADD COLUMN IF NOT EXISTS became_member boolean NOT NULL DEFAULT false;

ALTER TABLE public.bni_eventxp_observers
    ADD COLUMN IF NOT EXISTS bni_chapter text NOT NULL DEFAULT '';

UPDATE public.bni_eventxp_observers
SET bni_chapter = 'Ambition',
    name = regexp_replace(name, '\s*\(Ambition\)\s*$', '')
WHERE chapter_id = 1
  AND name ~* '\(Ambition\)\s*$'
  AND btrim(bni_chapter) = '';
