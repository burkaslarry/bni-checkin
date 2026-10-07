-- Remove the 9 repeat observers (visit-count prefix in the name) from 2026-10-08.
-- Keeps Helen Lam, Kimmy Law, Mary, and Ryan Yu.
-- Apply on Render Postgres:
--   render psql dpg-d6iok5q4d50c738643c0-a --confirm -c "$(grep -v '^--' migrations/remove_20261008_repeat_observers.sql | tr '\n' ' ')"

DELETE FROM public.bni_eventxp_observers
WHERE event_date = '2026-10-08'
  AND id IN (15, 16, 17, 19, 20, 21, 22, 23, 24);
