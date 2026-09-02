-- Anchor Member Traffic Light snapshots (Excel upload).
-- Apply via Render psql (see .cursor/rules/release-workflow.mdc). Do not use Supabase.
-- green_goal / yellow_goal store Excel chapter KPI banners (e.g. 60 / 40), not per-member cutoffs
-- (row green is ≥ 70 pts; see TrafficLightScoring).
-- rows_json: JSON array of member metrics + light colour.
CREATE TABLE IF NOT EXISTS bni_traffic_light_reports (
    id SERIAL PRIMARY KEY,
    chapter_id INTEGER NOT NULL DEFAULT 1,
    period_label TEXT NOT NULL,
    period_start DATE,
    period_end DATE,
    green_goal INTEGER NOT NULL DEFAULT 60,
    yellow_goal INTEGER NOT NULL DEFAULT 40,
    filename TEXT,
    rows_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traffic_light_reports_chapter_created
    ON bni_traffic_light_reports (chapter_id, created_at DESC);
