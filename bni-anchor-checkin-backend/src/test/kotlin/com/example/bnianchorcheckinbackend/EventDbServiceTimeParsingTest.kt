package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.Attendance
import com.example.bnianchorcheckinbackend.entities.Event
import com.example.bnianchorcheckinbackend.entities.Member
import com.example.bnianchorcheckinbackend.repositories.AttendanceRepository
import com.example.bnianchorcheckinbackend.repositories.EventRepository
import com.example.bnianchorcheckinbackend.repositories.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.Mockito.verify
import org.mockito.junit.jupiter.MockitoExtension
import java.time.LocalDate
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.Optional

/*
 * F02 -- Regression: yyyy-MM-ddTHH:mm:ss in DB log path --- EventDbServiceTimeParsingTest
 */
@ExtendWith(MockitoExtension::class)
class EventDbServiceTimeParsingTest {

    @Mock
    lateinit var eventRepository: EventRepository

    @Mock
    lateinit var attendanceRepository: AttendanceRepository

    @Mock
    lateinit var memberRepository: MemberRepository

    @Mock
    lateinit var databaseMemberService: DatabaseMemberService

    private lateinit var eventDbService: EventDbService

    @BeforeEach
    fun setUp() {
        eventDbService = EventDbService(
            eventRepository = eventRepository,
            attendanceRepository = attendanceRepository,
            memberRepository = memberRepository,
            databaseMemberService = databaseMemberService
        )
    }

    @Test
    fun `logAttendance accepts local datetime without timezone`() {
        val eventDate = LocalDate.of(2026, 3, 2)
        val event = Event(
            id = 999L,
            name = "BNI Anchor Meeting",
            createDate = eventDate,
            registrationStartTime = LocalTime.of(6, 30),
            eventDate = eventDate,
            startTime = LocalTime.of(7, 0),
            endTime = LocalTime.of(9, 0),
            onTimeCutoffTime = LocalTime.of(7, 5),
            status = "ACTIVE",
            isActive = true
        )

        `when`(eventRepository.findByEventDate(eventDate)).thenReturn(event)
        `when`(memberRepository.findByNameIgnoreCase("Larry Lo"))
            .thenReturn(Optional.of(Member(id = 123L, name = "Larry Lo")))
        `when`(attendanceRepository.findByEventIdAndMemberId(999, 123)).thenReturn(null)

        eventDbService.logAttendance(
            AttendanceLogRequest(
                attendeeId = 123,
                attendeeType = "member",
                attendeeName = "Larry Lo",
                attendeeProfession = "Client Service",
                eventDate = "2026-03-02",
                checkedInAt = "2026-03-02T07:06:00",
                status = "late"
            )
        )

        val captor = ArgumentCaptor.forClass(Attendance::class.java)
        verify(attendanceRepository).save(captor.capture())

        val saved = captor.value
        assertNotNull(saved)
        assertEquals(123, saved.memberId)
        assertEquals(999, saved.eventId)
        assertEquals("late", saved.status)

        val hkt = ZoneId.of("Asia/Hong_Kong")
        val expected = OffsetDateTime.of(
            LocalDate.of(2026, 3, 2),
            LocalTime.of(7, 6, 0),
            hkt.rules.getOffset(OffsetDateTime.now(hkt).toInstant())
        )
        assertEquals(expected.toLocalDateTime(), saved.checkInTime.toLocalDateTime())
    }
}
