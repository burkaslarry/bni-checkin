import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Supabase client (url + anon key from env). Side effect: none at creation; client used for DB/auth later.
 * @type {ReturnType<typeof createClient>}
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Table name constants for BNI Anchor (members, guests, events, attendances, logs, profession_groups). */
export const TABLES = {
  MEMBERS: "bni_anchor_members",
  GUESTS: "bni_anchor_guests",
  EVENTS: "bni_anchor_events",
  ATTENDANCES: "bni_anchor_attendances",
  ATTENDANCE_LOGS: "bni_anchor_attendance_logs",
  PROFESSION_GROUPS: "bni_anchor_profession_groups",
} as const;
