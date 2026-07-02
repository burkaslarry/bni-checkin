package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.Attendance
import com.example.bnianchorcheckinbackend.entities.Event
import com.example.bnianchorcheckinbackend.entities.Guest
import com.example.bnianchorcheckinbackend.entities.Member
import com.example.bnianchorcheckinbackend.repositories.AttendanceRepository
import com.example.bnianchorcheckinbackend.repositories.EventRepository
import com.example.bnianchorcheckinbackend.repositories.GuestRepository
import com.example.bnianchorcheckinbackend.repositories.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentMatchers.any
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import java.time.LocalDate
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class EventDbServiceAttendanceCorrectionsTest {

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
    fun `applyAttendanceCorrections clears guest and sets member check-in`() {
        val eventDate = LocalDate.of(2026, 7, 2)
        val event = Event(
            id = 9L,
            name = "Test",
            createDate = eventDate,
            eventDate = eventDate,
            startTime = LocalTime.of(7, 0),
            endTime = LocalTime.of(9, 0),
            registrationStartTime = LocalTime.of(6, 30),
            onTimeCutoffTime = LocalTime.of(7, 5),
            lateCutoffTime = null,
            status = "ACTIVE",
            isActive = true
        )
        `when`(eventRepository.findByEventDateAndDeletedAtIsNull(eventDate)).thenReturn(event)
        `when`(memberRepository.findByNameIgnoreCase("Hayes Lam")).thenReturn(
            Optional.of(Member(id = 1L, name = "Hayes Lam", profession = "IT"))
        )
        `when`(memberRepository.findByNameIgnoreCase("Zoe Wu")).thenReturn(Optional.empty())
        `when`(attendanceRepository.findByEventIdAndMemberId(9, 1)).thenReturn(null)
        `when`(attendanceRepository.save(any(Attendance::class.java))).thenAnswer { it.arguments[0] }

        val guest = Guest(id = 2L, name = "Zoe Wu", profession = "Guest", eventDate = "2026-07-02")
        guest.checkInTime = OffsetDateTime.of(eventDate, LocalTime.of(6, 1), ZoneOffset.ofHours(8))
        `when`(guestRepository.findByNameIgnoreCaseAndEventDateTrimmed("Zoe Wu", "2026-07-02"))
            .thenReturn(Optional.of(guest))
        `when`(guestRepository.save(any(Guest::class.java))).thenAnswer { it.arguments[0] }

        val result = eventDbService.applyAttendanceCorrections(
            AttendanceCorrectionsRequest(
                eventDate = "2026-07-02",
                removeCheckIns = listOf("Zoe Wu"),
                addCheckIns = listOf(AttendanceCheckInEntry("Hayes Lam", "08:45:00"))
            )
        )

        assertEquals(1, result["removed"])
        assertEquals(1, result["added"])
        assertNull(guest.checkInTime)
    }
}
