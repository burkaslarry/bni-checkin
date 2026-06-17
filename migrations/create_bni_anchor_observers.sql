-- Observer registry + attendance flag (no check-in time). Run in Supabase / Render Postgres SQL editor.

CREATE TABLE IF NOT EXISTS public.bni_anchor_observers (
    id serial PRIMARY KEY,
    name text NOT NULL,
    profession text NOT NULL DEFAULT '',
    event_date text NOT NULL,
    attended boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (name, event_date)
);

CREATE INDEX IF NOT EXISTS idx_bni_anchor_observers_event_date
    ON public.bni_anchor_observers (event_date);
