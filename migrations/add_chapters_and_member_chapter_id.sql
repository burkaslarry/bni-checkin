-- Multi-chapter foundation: chapters + members.chapter_id
-- Apply:
--   render psql dpg-d6iok5q4d50c738643c0-a --confirm -c "$(grep -v '^--' migrations/add_chapters_and_member_chapter_id.sql | tr '\n' ' ')"

CREATE TABLE IF NOT EXISTS public.bni_eventxp_chapters (
    id SERIAL PRIMARY KEY,
    tag TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    admin_login TEXT NOT NULL UNIQUE,
    admin_password_md5 TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Hong_Kong',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT bni_eventxp_chapters_tag_lowercase CHECK (tag = lower(tag)),
    CONSTRAINT bni_eventxp_chapters_tag_reserved CHECK (
        tag NOT IN ('admin', 'report', 'api', 'root', 'public', 'client')
    )
);

INSERT INTO public.bni_eventxp_chapters (tag, display_name, admin_login, admin_password_md5, status)
VALUES
    ('anchor', 'BNI Anchor', 'anchor', 'aabb2100033f0352fe7458e412495148', 'active'),
    ('amax', 'BNI AMax', 'amax', 'aabb2100033f0352fe7458e412495148', 'active'),
    ('dynasty', 'BNI Dynasty', 'dynasty', 'aabb2100033f0352fe7458e412495148', 'active')
ON CONFLICT (tag) DO NOTHING;

-- password for all seeded chapters is MD5('root1234') = aabb2100033f0352fe7458e412495148

ALTER TABLE public.bni_anchor_members
    ADD COLUMN IF NOT EXISTS chapter_id INTEGER REFERENCES public.bni_eventxp_chapters(id);

UPDATE public.bni_anchor_members
SET chapter_id = (SELECT id FROM public.bni_eventxp_chapters WHERE tag = 'anchor')
WHERE chapter_id IS NULL;

ALTER TABLE public.bni_anchor_members
    ALTER COLUMN chapter_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bni_anchor_members_chapter_id
    ON public.bni_anchor_members (chapter_id);

CREATE INDEX IF NOT EXISTS idx_bni_anchor_members_chapter_name
    ON public.bni_anchor_members (chapter_id, lower(name));

-- Replace global uniques with per-chapter uniques where present
ALTER TABLE public.bni_anchor_members DROP CONSTRAINT IF EXISTS bni_anchor_members_membership_id_key;
ALTER TABLE public.bni_anchor_members DROP CONSTRAINT IF EXISTS bni_anchor_members_email_key;
ALTER TABLE public.bni_anchor_members DROP CONSTRAINT IF EXISTS bni_anchor_members_phone_number_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bni_anchor_members_chapter_membership_uid'
  ) THEN
    ALTER TABLE public.bni_anchor_members
      ADD CONSTRAINT bni_anchor_members_chapter_membership_uid UNIQUE (chapter_id, membership_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bni_anchor_members_chapter_email_uid'
  ) THEN
    ALTER TABLE public.bni_anchor_members
      ADD CONSTRAINT bni_anchor_members_chapter_email_uid UNIQUE (chapter_id, email);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bni_anchor_members_chapter_phone_uid'
  ) THEN
    ALTER TABLE public.bni_anchor_members
      ADD CONSTRAINT bni_anchor_members_chapter_phone_uid UNIQUE (chapter_id, phone_number);
  END IF;
END $$;

-- Optional profession group for Amax section I
INSERT INTO public.bni_anchor_profession_groups (code, name)
VALUES ('I', '金融及投資')
ON CONFLICT (code) DO NOTHING;
