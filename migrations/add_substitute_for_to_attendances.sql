-- Add optional substitute attendee name for member attendance rows.
ALTER TABLE bni_anchor_attendances
    ADD COLUMN IF NOT EXISTS substitute_for TEXT;
