-- Guest Leadership Team term, derived from event_date.
-- Before 2026-10-01 = 2. From 2026-10-01, each six months increments (3, 4, ...).
-- Apply on Render Postgres before deploying a backend that writes lt_term.

ALTER TABLE public.bni_eventxp_guests
    ADD COLUMN IF NOT EXISTS lt_term integer;

UPDATE public.bni_eventxp_guests AS g
SET lt_term = CASE
    WHEN left(btrim(g.event_date), 10) < '2026-10-01' THEN 2
    ELSE 3 + floor((
        (substring(btrim(g.event_date) from 1 for 4)::int - 2026) * 12
        + (substring(btrim(g.event_date) from 6 for 2)::int - 10)
    ) / 6.0)::int
END
WHERE g.event_date IS NOT NULL
  AND btrim(g.event_date) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}';

CREATE INDEX IF NOT EXISTS idx_bni_eventxp_guests_chapter_lt_term
    ON public.bni_eventxp_guests (chapter_id, lt_term);
