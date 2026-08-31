-- Anchor Member Traffic Light snapshots (Excel upload).
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
