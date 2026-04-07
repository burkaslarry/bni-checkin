-- Enforce duplicate protection for public walk-in guest registration:
-- same phone_number + same event_date should be unique.
--
-- Safe to run multiple times (IF NOT EXISTS).

CREATE UNIQUE INDEX IF NOT EXISTS ux_bni_anchor_guests_phone_event_date
ON bni_anchor_guests (phone_number, event_date)
WHERE phone_number IS NOT NULL AND phone_number <> ''
  AND event_date IS NOT NULL AND event_date <> '';

