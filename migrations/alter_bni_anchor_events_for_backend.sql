-- Migration: Add columns required by bni-anchor-checkin-backend
-- Run this in Supabase SQL Editor if your bni_anchor_events table was created
-- before these columns existed.
--
-- Adds: created_at, registration_start_time, on_time_cutoff_time, late_cutoff_time

ALTER TABLE public.bni_anchor_events ADD COLUMN IF NOT EXISTS created_at TEXT;
ALTER TABLE public.bni_anchor_events ADD COLUMN IF NOT EXISTS registration_start_time TIME;
ALTER TABLE public.bni_anchor_events ADD COLUMN IF NOT EXISTS on_time_cutoff_time TIME;
ALTER TABLE public.bni_anchor_events ADD COLUMN IF NOT EXISTS late_cutoff_time TIME;
