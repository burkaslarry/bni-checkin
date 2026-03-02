-- Migration: Add registration_start_time to bni_anchor_events
-- Run this in Supabase SQL Editor if you get:
--   "Could not find the 'registration_start_time' column of 'bni_anchor_events' in the schema cache"
--
-- After running, you may need to reload the Supabase schema cache (or wait a few seconds)

ALTER TABLE bni_anchor_events ADD COLUMN IF NOT EXISTS registration_start_time TIME;
