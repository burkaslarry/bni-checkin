package com.example.bnianchorcheckinbackend

import java.time.DayOfWeek
import java.time.LocalDate

/**
 * Next weekly meeting date/name from a finished event.
 * [jsWeekday] matches JS Date.getDay(): 0=Sunday … 6=Saturday (same as [Chapter.meetingWeekday]).
 */
object NextMeetingPlanner {
    /** Anchor closedown: no meeting / no attendance email on these Thursdays. */
    private val skippedDatesByChapter = mapOf(
        "anchor" to setOf(
            LocalDate.of(2026, 9, 24),
            LocalDate.of(2026, 10, 1),
        )
    )

    /** Convert JS `Date.getDay()` (0=Sunday) to [DayOfWeek]. */
    fun jsWeekdayToDayOfWeek(jsWeekday: Int): DayOfWeek {
        val n = ((jsWeekday % 7) + 7) % 7
        return if (n == 0) DayOfWeek.SUNDAY else DayOfWeek.of(n)
    }

    fun isSkipped(chapterTag: String?, date: LocalDate): Boolean {
        val tag = chapterTag?.trim()?.lowercase().orEmpty()
        if (tag.isEmpty()) return false
        return skippedDatesByChapter[tag]?.contains(date) == true
    }

    /**
     * True when [nextDate] is more than [leadDays] after [today].
     * Keeps the usual “create next week after this week’s email” cadence, so a two-week
     * skip (24 Sep / 1 Oct) waits until 1 Oct to open 8 Oct.
     */
    fun shouldDeferOpening(nextDate: LocalDate, today: LocalDate, leadDays: Long = 7): Boolean =
        nextDate.isAfter(today.plusDays(leadDays))

    /** First occurrence of [jsWeekday] strictly after [from], skipping chapter blackout dates. */
    fun nextDateAfter(from: LocalDate, jsWeekday: Int, chapterTag: String? = null): LocalDate {
        var d = firstWeekdayAfter(from, jsWeekday)
        val tag = chapterTag?.trim()?.lowercase()
        if (tag.isNullOrEmpty()) return d
        var guard = 0
        while (isSkipped(tag, d) && guard++ < 60) {
            d = firstWeekdayAfter(d, jsWeekday)
        }
        return d
    }

    private fun firstWeekdayAfter(from: LocalDate, jsWeekday: Int): LocalDate {
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
