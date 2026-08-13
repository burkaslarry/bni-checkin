package com.example.bnianchorcheckinbackend

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.DayOfWeek
import java.time.LocalDate

class NextMeetingPlannerTest {

    @Test
    fun `js weekday 4 is Thursday`() {
        assertEquals(DayOfWeek.THURSDAY, NextMeetingPlanner.jsWeekdayToDayOfWeek(4))
    }

    @Test
    fun `js weekday 0 is Sunday`() {
        assertEquals(DayOfWeek.SUNDAY, NextMeetingPlanner.jsWeekdayToDayOfWeek(0))
    }

    @Test
    fun `js weekday 3 is Wednesday`() {
        assertEquals(DayOfWeek.WEDNESDAY, NextMeetingPlanner.jsWeekdayToDayOfWeek(3))
    }

    @Test
    fun `next Thursday after Thursday 2026-08-13 is 2026-08-20`() {
        assertEquals(
            LocalDate.of(2026, 8, 20),
            NextMeetingPlanner.nextDateAfter(LocalDate.of(2026, 8, 13), 4)
        )
    }

    @Test
    fun `next Wednesday after Wednesday is plus 7 days`() {
        assertEquals(
            LocalDate.of(2026, 8, 19),
            NextMeetingPlanner.nextDateAfter(LocalDate.of(2026, 8, 12), 3)
        )
    }

    @Test
    fun `next Thursday after Monday is that week's Thursday`() {
        assertEquals(
            LocalDate.of(2026, 8, 13),
            NextMeetingPlanner.nextDateAfter(LocalDate.of(2026, 8, 10), 4)
        )
    }

    @Test
    fun `default meeting name matches frontend convention`() {
        assertEquals(
            "BNI Anchor Business Meeting 2026-08-20",
            NextMeetingPlanner.defaultMeetingName("BNI Anchor", LocalDate.of(2026, 8, 20))
        )
    }
}
