CREATE TABLE IF NOT EXISTS bni_eventxp_chapter_email_settings (
    chapter_id INTEGER PRIMARY KEY REFERENCES bni_eventxp_chapters(id) ON DELETE CASCADE,
    attendance_email_recipients TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO bni_eventxp_chapter_email_settings (chapter_id, attendance_email_recipients)
SELECT id, 'Raymondkuo88@gmail.com'
FROM bni_eventxp_chapters
WHERE LOWER(tag) = 'anchor'
ON CONFLICT (chapter_id) DO NOTHING;
