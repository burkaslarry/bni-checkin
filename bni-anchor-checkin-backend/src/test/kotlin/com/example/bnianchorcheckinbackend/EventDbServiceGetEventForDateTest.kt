package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.Event
import com.example.bnianchorcheckinbackend.repositories.AttendanceRepository
import com.example.bnianchorcheckinbackend.repositories.EventRepository
import com.example.bnianchorcheckinbackend.repositories.GuestRepository
import com.example.bnianchorcheckinbackend.repositories.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import java.time.LocalDate
import java.time.LocalTime

@ExtendWith(MockitoExtension::class)
class EventDbServiceGetEventForDateTest {

    @Mock lateinit var eventRepository: EventRepository
    @Mock lateinit var attendanceRepository: AttendanceRepository
    @Mock lateinit var guestRepository: GuestRepository
    @Mock lateinit var memberRepository: MemberRepository
    @Mock lateinit var databaseMemberService: DatabaseMemberService

    private lateinit var eventDbService: EventDbService

    @BeforeEach
    fun setUp() {
        eventDbService = EventDbService(
            eventRepository,
            attendanceRepository,
            memberRepository,
            guestRepository,
            databaseMemberService
        )
    }

    @Test
    fun `getEventForDate prefers the active event when duplicates exist`() {
        val date = LocalDate.of(2026, 9, 3)
        val stale = Event(
            id = 10L,
            name = "BNI Anchor Regular Meeting 2026-09-03",
            createDate = date,
            eventDate = date,
            startTime = LocalTime.of(7, 0),
            endTime = LocalTime.of(9, 0),
            registrationStartTime = LocalTime.of(6, 30),
            onTimeCutoffTime = LocalTime.of(7, 5),
            status = "ACTIVE",
            isActive = false
        )
        val current = Event(
            id = 21L,
            name = "BNI Anchor Business Meeting 2026-09-03",
            createDate = date,
            eventDate = date,
            startTime = LocalTime.of(7, 0),
            endTime = LocalTime.of(9, 0),
            registrationStartTime = LocalTime.of(6, 30),
            onTimeCutoffTime = LocalTime.of(7, 5),
            status = "ACTIVE",
            isActive = true
        )
        `when`(eventRepository.findAllByChapterIdAndEventDateAndDeletedAtIsNullOrderByIdDesc(1, date))
            .thenReturn(listOf(current, stale))

        val found = eventDbService.getEventForDate("2026-09-03")
        assertEquals(21, found?.id)
        assertEquals("BNI Anchor Business Meeting 2026-09-03", found?.name)
    }

    @Test
    fun `createEvent returns existing event for the same date`() {
        val date = LocalDate.of(2026, 9, 3)
        val existing = Event(
            id = 21L,
            name = "BNI Anchor Business Meeting 2026-09-03",
            createDate = date,
            eventDate = date,
            startTime = LocalTime.of(7, 0),
            endTime = LocalTime.of(9, 0),
            registrationStartTime = LocalTime.of(6, 30),
            onTimeCutoffTime = LocalTime.of(7, 5),
            status = "ACTIVE",
            isActive = true
        )
        `when`(eventRepository.findAllByChapterIdAndEventDateAndDeletedAtIsNullOrderByIdDesc(1, date))
            .thenReturn(listOf(existing))

        val created = eventDbService.createEvent(
            EventRequest(
                name = "BNI Anchor Regular Meeting 2026-09-03",
                date = "2026-09-03",
                startTime = "07:00",
                endTime = "09:00",
                registrationStartTime = "06:30",
                onTimeCutoff = "07:05"
            ),
            "anchor"
        )
        assertEquals(21, created.id)
        assertEquals("BNI Anchor Business Meeting 2026-09-03", created.name)
    }
}
