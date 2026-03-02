-- ============================================================
-- RLS: Allow SELECT for BNI Anchor tables (Supabase)
-- ============================================================
-- Run this in Supabase SQL Editor if Row Level Security (RLS) is
-- enabled and your app role (anon/authenticated or service role)
-- needs to read these tables.
--
-- If using the backend (Spring Boot) with the database password
-- (postgres user), RLS may not block you. Use this if you see
-- "permission denied" or empty results when querying from the API.

-- Enable RLS on tables (only if you want to enforce policies)
-- ALTER TABLE bni_anchor_profession_groups ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bni_anchor_members ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bni_anchor_guests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bni_anchor_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bni_anchor_attendances ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bni_anchor_attendance_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow SELECT for anon and authenticated (e.g. for API reads)
-- Uncomment and run the block below if RLS is enabled and you need read access.

/*
CREATE POLICY "Allow read profession_groups"
ON bni_anchor_profession_groups FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow read members"
ON bni_anchor_members FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow read guests"
ON bni_anchor_guests FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow read events"
ON bni_anchor_events FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow read attendances"
ON bni_anchor_attendances FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow read attendance_logs"
ON bni_anchor_attendance_logs FOR SELECT TO anon, authenticated USING (true);
*/

-- For backend (service role / postgres) full access, use a policy with TO public
-- or ensure your connection uses a role that bypasses RLS (e.g. postgres superuser).
