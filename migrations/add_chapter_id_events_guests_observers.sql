-- Scope events, guests, observers by chapter (attendance inherits via event_id).
-- Apply:
--   render psql dpg-d6iok5q4d50c738643c0-a --confirm -c "$(grep -v '^--' migrations/add_chapter_id_events_guests_observers.sql | tr '\n' ' ')"

-- Events
ALTER TABLE public.bni_anchor_events
    ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES public.bni_eventxp_chapters(id);

UPDATE public.bni_anchor_events
SET chapter_id = (SELECT id FROM public.bni_eventxp_chapters WHERE tag = 'anchor')
WHERE chapter_id IS NULL;

ALTER TABLE public.bni_anchor_events
    ALTER COLUMN chapter_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bni_anchor_events_chapter_id
    ON public.bni_anchor_events (chapter_id);

CREATE INDEX IF NOT EXISTS idx_bni_anchor_events_chapter_date
    ON public.bni_anchor_events (chapter_id, event_date);

-- Guests
ALTER TABLE public.bni_anchor_guests
    ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES public.bni_eventxp_chapters(id);

UPDATE public.bni_anchor_guests
SET chapter_id = (SELECT id FROM public.bni_eventxp_chapters WHERE tag = 'anchor')
WHERE chapter_id IS NULL;

ALTER TABLE public.bni_anchor_guests
    ALTER COLUMN chapter_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bni_anchor_guests_chapter_id
    ON public.bni_anchor_guests (chapter_id);

CREATE INDEX IF NOT EXISTS idx_bni_anchor_guests_chapter_event_date
    ON public.bni_anchor_guests (chapter_id, event_date);

ALTER TABLE public.bni_anchor_guests DROP CONSTRAINT IF EXISTS ux_bni_anchor_guests_phone_event_date;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bni_anchor_guests_chapter_phone_event_uid'
  ) THEN
    ALTER TABLE public.bni_anchor_guests
      ADD CONSTRAINT bni_anchor_guests_chapter_phone_event_uid
      UNIQUE (chapter_id, phone_number, event_date);
  END IF;
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Skipping guests phone unique — duplicates exist; resolve manually';
END $$;

-- Observers
ALTER TABLE public.bni_anchor_observers
    ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES public.bni_eventxp_chapters(id);

UPDATE public.bni_anchor_observers
SET chapter_id = (SELECT id FROM public.bni_eventxp_chapters WHERE tag = 'anchor')
WHERE chapter_id IS NULL;

ALTER TABLE public.bni_anchor_observers
    ALTER COLUMN chapter_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bni_anchor_observers_chapter_id
    ON public.bni_anchor_observers (chapter_id);

ALTER TABLE public.bni_anchor_observers DROP CONSTRAINT IF EXISTS bni_anchor_observers_name_event_date_key;
ALTER TABLE public.bni_anchor_observers DROP CONSTRAINT IF EXISTS uk_bni_anchor_observers_name_event_date;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bni_anchor_observers'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%name%'
      AND pg_get_constraintdef(oid) ILIKE '%event_date%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%chapter_id%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.bni_anchor_observers DROP CONSTRAINT ' || quote_ident(conname)
      FROM pg_constraint
      WHERE conrelid = 'public.bni_anchor_observers'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) ILIKE '%name%'
        AND pg_get_constraintdef(oid) ILIKE '%event_date%'
        AND pg_get_constraintdef(oid) NOT ILIKE '%chapter_id%'
      LIMIT 1
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bni_anchor_observers_chapter_name_event_uid'
  ) THEN
    ALTER TABLE public.bni_anchor_observers
      ADD CONSTRAINT bni_anchor_observers_chapter_name_event_uid
      UNIQUE (chapter_id, name, event_date);
  END IF;
END $$;
