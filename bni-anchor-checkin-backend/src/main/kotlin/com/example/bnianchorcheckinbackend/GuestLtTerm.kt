package com.example.bnianchorcheckinbackend

/**
 * [F003][S302]
 * Feature: Guest Registration
 * Step: Match Leadership Team term
 * Description: Integer stored in bni_eventxp_guests.lt_term.
 * Dates before 2026-10-01 are term 2.
 * 2026-10-01 through 2027-03-31 is term 3, then each following six months increments.
 */
object GuestLtTerm {
    fun number(eventDate: String?): Int? {
        val raw = eventDate?.trim()?.take(10) ?: return null
        if (!Regex("""^\d{4}-\d{2}-\d{2}$""").matches(raw)) return null
        val year = raw.substring(0, 4).toIntOrNull() ?: return null
        val month = raw.substring(5, 7).toIntOrNull() ?: return null
        val day = raw.substring(8, 10).toIntOrNull() ?: return null
        if (month !in 1..12 || day !in 1..31) return null
        if (raw < "2026-10-01") return 2
        val monthsSinceOct2026 = (year - 2026) * 12 + (month - 10)
        return 3 + monthsSinceOct2026 / 6
    }
}
