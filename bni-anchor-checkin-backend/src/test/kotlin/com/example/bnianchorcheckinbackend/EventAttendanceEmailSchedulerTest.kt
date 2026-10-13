package com.example.bnianchorcheckinbackend

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.doThrow
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import java.time.LocalDate
import java.time.ZoneId

@ExtendWith(MockitoExtension::class)
class EventAttendanceEmailSchedulerTest {

    @Mock
    lateinit var emailService: EventAttendanceEmailService

    private val today = LocalDate.now(ZoneId.of("Asia/Hong_Kong"))

    @Test
    fun `meeting maintenance still runs when attendance email processing fails`() {
        `when`(emailService.isReady()).thenReturn(true)
        `when`(emailService.processDueEvents()).thenThrow(IllegalStateException("send failed"))

        EventAttendanceEmailScheduler(emailService, enabled = true).pollFinishedEvents()

        verify(emailService).ensureUpcomingMeetings(today)
    }

    @Test
    fun `attendance email processing completes when meeting maintenance fails`() {
        `when`(emailService.isReady()).thenReturn(true)
        `when`(emailService.processDueEvents()).thenReturn(1)
        doThrow(IllegalStateException("meeting failed"))
            .`when`(emailService).ensureUpcomingMeetings(today)

        EventAttendanceEmailScheduler(emailService, enabled = true).pollFinishedEvents()

        verify(emailService).processDueEvents()
    }
}
