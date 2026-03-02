-- Add columns required by JPA Guest entity so inserts succeed
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- 1. Add id as primary key (required by JpaRepository<Guest, Long>)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bni_anchor_guests' AND column_name='id') THEN
    ALTER TABLE public.bni_anchor_guests ADD COLUMN id serial PRIMARY KEY;
  END IF;
END $$;

-- 2. Add optional columns used by entity
ALTER TABLE public.bni_anchor_guests ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.bni_anchor_guests ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.bni_anchor_guests ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Entity maps phoneNumber -> column "phone". If your table has phone_number, uncomment:
-- ALTER TABLE public.bni_anchor_guests RENAME COLUMN phone_number TO phone;
