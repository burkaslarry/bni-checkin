package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.Event
import com.example.bnianchorcheckinbackend.repositories.EventRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import java.time.LocalDate
import java.time.LocalTime

@ExtendWith(MockitoExtension::class)
class EventAttendanceEmailServiceNextMeetingTest {

    @Mock
    lateinit var eventRepository: EventRepository

    @Mock
    lateinit var csvExportService: AttendanceCsvExportService

    @Mock
    lateinit var resendEmailService: ResendEmailService

    @Mock
    lateinit var eventDbService: EventDbService

    @Mock
    lateinit var chapterService: ChapterService

    private lateinit var service: EventAttendanceEmailService

    private val finished = Event(
        id = 41L,
        chapterId = 1,
        name = "BNI Anchor Business Meeting 2026-08-13",
        createDate = LocalDate.of(2026, 8, 6),
        eventDate = LocalDate.of(2026, 8, 13),
        registrationStartTime = LocalTime.of(6, 30),
        startTime = LocalTime.of(7, 0),
        endTime = LocalTime.of(9, 0),
        onTimeCutoffTime = LocalTime.of(7, 1),
        status = "ACTIVE",
        isActive = true
    )

    private val chapter = ChapterInfo(
        id = 1,
        tag = "anchor",
        displayName = "BNI Anchor",
        timezone = "Asia/Hong_Kong",
        status = "active",
        meetingWeekday = 4
    )

    @BeforeEach
    fun setUp() {
        service = EventAttendanceEmailService(
            eventRepository = eventRepository,
            csvExportService = csvExportService,
            resendEmailService = resendEmailService,
            eventDbService = eventDbService,
            chapterService = chapterService
        )
        `when`(chapterService.findInfoById(1)).thenReturn(chapter)
    }

    @Test
    fun `creates next Thursday meeting and sets it current when none exists`() {
        val created = EventData(
            id = 99,
            name = "BNI Anchor Business Meeting 2026-08-20",
            date = "2026-08-20",
            startTime = "07:00",
            endTime = "09:00",
            registrationStartTime = "06:30",
            onTimeCutoff = "07:01",
            createdAt = "2026-08-13",
            chapterId = 1
        )
        val activated = created.copy()
        `when`(eventDbService.getEventForDate("2026-08-20", "anchor")).thenReturn(null)
        `when`(
            eventDbService.createEvent(
                EventRequest(
                    name = "BNI Anchor Business Meeting 2026-08-20",
                    date = "2026-08-20",
                    startTime = "07:00",
                    endTime = "09:00",
                    registrationStartTime = "06:30",
                    onTimeCutoff = "07:01"
                ),
                "anchor"
            )
        ).thenReturn(created)
        `when`(eventDbService.setEventActive(99, true, "anchor")).thenReturn(activated)

        val result = service.createAndActivateNextMeeting(finished)

        assertEquals(99, result?.id)
        assertEquals("2026-08-20", result?.date)
        verify(eventDbService).setEventActive(99, true, "anchor")
    }

    @Test
    fun `reuses existing next-week event and activates it as current`() {
        val existing = EventData(
            id = 55,
            name = "BNI Anchor Closed Door Meeting 2026-08-20",
            date = "2026-08-20",
            startTime = "07:00",
            endTime = "09:00",
            registrationStartTime = "06:30",
            onTimeCutoff = "07:01",
            createdAt = "2026-08-13",
            chapterId = 1
        )
        `when`(eventDbService.getEventForDate("2026-08-20", "anchor")).thenReturn(existing)
        `when`(eventDbService.setEventActive(55, true, "anchor")).thenReturn(existing)

        val result = service.createAndActivateNextMeeting(finished)

        assertEquals(55, result?.id)
        assertEquals("BNI Anchor Closed Door Meeting 2026-08-20", result?.name)
        verify(eventDbService).setEventActive(55, true, "anchor")
    }
}
