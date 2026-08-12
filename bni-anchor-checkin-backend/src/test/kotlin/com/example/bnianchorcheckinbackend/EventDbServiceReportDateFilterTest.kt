package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.Attendance
import com.example.bnianchorcheckinbackend.entities.Event
import com.example.bnianchorcheckinbackend.repositories.AttendanceRepository
import com.example.bnianchorcheckinbackend.repositories.EventRepository
import com.example.bnianchorcheckinbackend.repositories.GuestRepository
import com.example.bnianchorcheckinbackend.repositories.MemberRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.junit.jupiter.MockitoExtension
import java.time.LocalDate
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneOffset

@ExtendWith(MockitoExtension::class)
class EventDbServiceReportDateFilterTest {

    @Mock lateinit var eventRepository: EventRepository
    @Mock lateinit var attendanceRepository: AttendanceRepository
    @Mock lateinit var guestRepository: GuestRepository
    @Mock lateinit var memberRepository: MemberRepository
    @Mock lateinit var databaseMemberService: DatabaseMemberService

    private lateinit var eventDbService: EventDbService

    private val eventDate = LocalDate.of(2026, 8, 13)
    private val hkt = ZoneOffset.ofHours(8)

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
    fun `getReportData excludes member check-ins from other calendar days`() {
        val event = Event(
            id = 49L,
            name = "BNI Anchor Business Meeting 2026-08-13",
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
        `when`(eventRepository.findById(49L)).thenReturn(java.util.Optional.of(event))
        `when`(databaseMemberService.getAllMembers(null)).thenReturn(
            listOf(
                mapOf("id" to 1, "name" to "Vincent Chung"),
                mapOf("id" to 2, "name" to "Larry Lo"),
                mapOf("id" to 3, "name" to "Ace Nau")
            )
        )
        `when`(attendanceRepository.findByEventId(49)).thenReturn(
            listOf(
                Attendance(
                    chapterId = 1,
                    memberId = 1,
                    eventId = 49,
                    status = "on-time",
                    checkInTime = OffsetDateTime.of(LocalDate.of(2026, 8, 12), LocalTime.of(15, 29), hkt)
                ),
                Attendance(
                    chapterId = 1,
                    memberId = 2,
                    eventId = 49,
                    status = "on-time",
                    checkInTime = OffsetDateTime.of(LocalDate.of(2026, 8, 12), LocalTime.of(15, 28, 45), hkt)
                ),
                Attendance(
                    chapterId = 1,
                    memberId = 3,
                    eventId = 49,
                    status = "absent",
                    checkInTime = OffsetDateTime.of(eventDate, LocalTime.of(7, 0), hkt)
                )
            )
        )
        `when`(guestRepository.findAllByChapterIdAndCheckInTimeIsNotNull(1)).thenReturn(emptyList())
        `when`(guestRepository.findGuestsByChapterIdAndEventDateTrimmed(1, "2026-08-13")).thenReturn(emptyList())

        val report = eventDbService.getReportData(eventId = 49)!!

        assertTrue(report.attendees.isEmpty())
        assertEquals(3, report.absentees.count { it.role == "MEMBER" })
        assertEquals(listOf("Ace Nau", "Larry Lo", "Vincent Chung"), report.absentees.map { it.memberName }.sorted())
    }
}
