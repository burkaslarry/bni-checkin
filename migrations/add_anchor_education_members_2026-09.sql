-- BNI Anchor: keep 教育及培訓 (J) and add poster members from BNI Member List_NEW.pdf (Sep 2026).
-- Apply on Render Postgres:
--   render psql dpg-d6iok5q4d50c738643c0-a --confirm -f migrations/add_anchor_education_members_2026-09.sql

BEGIN;

INSERT INTO public.bni_eventxp_profession_groups (code, name, chapter_id)
VALUES ('J', '教育及培訓', 1)
ON CONFLICT (chapter_id, code) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO public.bni_eventxp_members (
    chapter_id, name, profession, profession_code, position, membership_id, standing, created_at, updated_at
)
SELECT 1, 'Rebecca Hung', '兒童英語', 'J', 'Member', 'ANCHOR-049', 'GREEN', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.bni_eventxp_members
    WHERE chapter_id = 1 AND lower(name) = lower('Rebecca Hung')
);

INSERT INTO public.bni_eventxp_members (
    chapter_id, name, profession, profession_code, position, membership_id, standing, created_at, updated_at
)
SELECT 1, 'Dr. Ronnie Chan', '心臟科專科醫生', 'H', 'Member', 'ANCHOR-050', 'GREEN', NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.bni_eventxp_members
    WHERE chapter_id = 1
      AND lower(replace(name, '.', '')) = lower('Dr Ronnie Chan')
);

COMMIT;
