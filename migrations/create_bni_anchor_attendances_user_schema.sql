-- Migration: bni_anchor_attendances table (user schema with member_name)
-- Run this if your table has member_id and you need member_name schema

-- Drop old table if exists (backup first if needed)
-- DROP TABLE IF EXISTS bni_anchor_attendances CASCADE;

CREATE TABLE IF NOT EXISTS bni_anchor_attendances (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES bni_anchor_events(id) ON DELETE CASCADE,
    event_date DATE NOT NULL,
    member_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'absent' CHECK (
        status = ANY (ARRAY['on-time', 'late', 'absent', 'late_with_code'])
    ),
    check_in_time TIME WITHOUT TIME ZONE NULL,
    role TEXT NULL DEFAULT 'MEMBER',
    CONSTRAINT bni_anchor_attendances_name_event_unique UNIQUE (member_name, event_id)
);

CREATE INDEX IF NOT EXISTS idx_bni_attendance_event_id ON bni_anchor_attendances (event_id);
CREATE INDEX IF NOT EXISTS idx_bni_attendance_date ON bni_anchor_attendances (event_date);
