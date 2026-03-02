import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Table name constants
export const TABLES = {
  MEMBERS: "bni_anchor_members",
  GUESTS: "bni_anchor_guests",
  EVENTS: "bni_anchor_events",
  ATTENDANCES: "bni_anchor_attendances",
  ATTENDANCE_LOGS: "bni_anchor_attendance_logs",
  PROFESSION_GROUPS: "bni_anchor_profession_groups",
} as const;
