-- Remove departed Anchor members Charlotte Kamta and Cherry Xu from Traffic Light snapshots.
-- Member roster rows were already deleted. Apply on Render Postgres:
--   render psql dpg-d6iok5q4d50c738643c0-a --confirm -c "$(grep -v '^--' migrations/remove_charlotte_kamta_cherry_xu.sql | tr '\n' ' ')"

UPDATE public.bni_traffic_light_reports r
SET rows_json = (
    SELECT coalesce(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)::text
    FROM jsonb_array_elements(r.rows_json::jsonb) WITH ORDINALITY AS t(elem, ord)
    WHERE lower(btrim(elem->>'name')) NOT IN ('charlotte kamta', 'cherry xu')
);
