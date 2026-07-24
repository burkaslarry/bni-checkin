package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.Attendance
import com.example.bnianchorcheckinbackend.entities.Event
import com.example.bnianchorcheckinbackend.entities.Member
import com.example.bnianchorcheckinbackend.repositories.AttendanceRepository
import com.example.bnianchorcheckinbackend.repositories.EventRepository
import com.example.bnianchorcheckinbackend.repositories.GuestRepository
import com.example.bnianchorcheckinbackend.repositories.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.ArgumentCaptor
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
class EventDbServiceSubstituteTest {

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
    fun `updateMemberSubstitute saves substitute name on attendance row`() {
        val eventDate = LocalDate.of(2026, 7, 16)
        val event = Event(
            id = 38L,
            name = "BNI Anchor 2026-07-16",
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
        val attendance = Attendance(
            id = 10L,
            chapterId = 1,
            memberId = 3,
            eventId = 38,
            checkInTime = OffsetDateTime.of(eventDate, LocalTime.of(7, 4), ZoneOffset.ofHours(8)),
            status = "on-time"
        )
        `when`(eventRepository.findByChapterIdAndEventDateAndDeletedAtIsNull(1, eventDate)).thenReturn(event)
        `when`(memberRepository.findByChapterIdAndNameIgnoreCase(1, "Max Chan/William Lai")).thenReturn(
            Optional.of(Member(id = 3L, name = "Max Chan/William Lai", profession = "區塊鏈"))
        )
        `when`(attendanceRepository.findByEventIdAndMemberId(38, 3)).thenReturn(attendance)
        `when`(attendanceRepository.save(any(Attendance::class.java))).thenAnswer { it.arguments[0] }

        val updated = eventDbService.updateMemberSubstitute(
            "2026-07-16",
            "Max Chan/William Lai",
            "Larry Lo"
        )

        assertTrue(updated)
        val captor = ArgumentCaptor.forClass(Attendance::class.java)
        org.mockito.Mockito.verify(attendanceRepository).save(captor.capture())
        assertEquals("Larry Lo", captor.value.substituteFor)
    }
}
