package com.example.bnianchorcheckinbackend

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Next weekly meeting date/name from a finished event.
 * [jsWeekday] matches JS Date.getDay(): 0=Sunday … 6=Saturday (same as [Chapter.meetingWeekday]).
 */
object NextMeetingPlanner {
    /** Convert JS `Date.getDay()` (0=Sunday) to [DayOfWeek]. */
    fun jsWeekdayToDayOfWeek(jsWeekday: Int): DayOfWeek {
        val n = ((jsWeekday % 7) + 7) % 7
        return if (n == 0) DayOfWeek.SUNDAY else DayOfWeek.of(n)
    }

    /** First occurrence of [jsWeekday] strictly after [from]. */
    fun nextDateAfter(from: LocalDate, jsWeekday: Int): LocalDate {
        val target = jsWeekdayToDayOfWeek(jsWeekday)
        var d = from.plusDays(1)
        while (d.dayOfWeek != target) {
            d = d.plusDays(1)
        }
        return d
    }

    /** `{displayName} Business Meeting YYYY-MM-DD` (e.g. `BNI Anchor Business Meeting 2026-09-03`). */
    fun defaultMeetingName(displayName: String, date: LocalDate): String {
        val chapter = displayName.trim().ifEmpty { "BNI Chapter" }
        return "$chapter Business Meeting $date"
    }
}
