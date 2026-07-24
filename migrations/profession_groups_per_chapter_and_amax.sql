-- Make profession groups chapter-scoped, then seed BNI AMax (chapter_id = 2).
-- Apply on Render Postgres:
--   render psql dpg-d6iok5q4d50c738643c0-a --confirm -c "$(grep -v '^--' migrations/profession_groups_per_chapter_and_amax.sql | tr '\n' ' ')"

BEGIN;

-- 1) Drop old members -> profession_groups FK (code-only)
ALTER TABLE public.bni_eventxp_members
    DROP CONSTRAINT IF EXISTS bni_anchor_members_profession_code_fkey;
ALTER TABLE public.bni_eventxp_members
    DROP CONSTRAINT IF EXISTS bni_eventxp_members_chapter_profession_fkey;

-- 2) Switch profession_groups to per-chapter primary key
ALTER TABLE public.bni_eventxp_profession_groups
    DROP CONSTRAINT IF EXISTS bni_anchor_profession_groups_pkey;
ALTER TABLE public.bni_eventxp_profession_groups
    DROP CONSTRAINT IF EXISTS bni_eventxp_profession_groups_pkey;

ALTER TABLE public.bni_eventxp_profession_groups
    DROP CONSTRAINT IF EXISTS bni_anchor_profession_groups_name_key;
ALTER TABLE public.bni_eventxp_profession_groups
    DROP CONSTRAINT IF EXISTS bni_eventxp_profession_groups_chapter_name_uid;

ALTER TABLE public.bni_eventxp_profession_groups
    ADD CONSTRAINT bni_eventxp_profession_groups_pkey PRIMARY KEY (chapter_id, code);

ALTER TABLE public.bni_eventxp_profession_groups
    ADD CONSTRAINT bni_eventxp_profession_groups_chapter_name_uid UNIQUE (chapter_id, name);

-- 3) Insert AMax groups BEFORE restoring the members FK
INSERT INTO public.bni_eventxp_profession_groups (code, name, chapter_id) VALUES
    ('A', '生活品味', 2),
    ('B', '醫療保健', 2),
    ('C', '地產建築及專項工程', 2),
    ('D', '製造及分銷', 2),
    ('E', '推廣及活動', 2),
    ('F', '教育培訓及資訊科技', 2),
    ('G', '食品及餐廳', 2),
    ('H', '企業服務', 2),
    ('I', '金融及投資', 2)
ON CONFLICT (chapter_id, code) DO UPDATE
SET name = EXCLUDED.name;

-- 4) Restore members FK as (chapter_id, profession_code)
ALTER TABLE public.bni_eventxp_members
    ADD CONSTRAINT bni_eventxp_members_chapter_profession_fkey
    FOREIGN KEY (chapter_id, profession_code)
    REFERENCES public.bni_eventxp_profession_groups (chapter_id, code);

COMMIT;
