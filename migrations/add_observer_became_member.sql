-- Track whether an observer later joined as a member.
-- Apply on Render Postgres only:
--   render psql dpg-d6iok5q4d50c738643c0-a --confirm -c "$(grep -v '^--' migrations/add_observer_became_member.sql | tr '\n' ' ')"

ALTER TABLE public.bni_eventxp_observers
    ADD COLUMN IF NOT EXISTS became_member boolean NOT NULL DEFAULT false;
