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
import org.mockito.ArgumentCaptor
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.Mockito.verify
import org.mockito.junit.jupiter.MockitoExtension
import java.time.LocalDate
import java.time.LocalTime
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class EventDbServiceUpdateEventTest {

    @Mock
    lateinit var eventRepository: EventRepository

    @Mock
    lateinit var attendanceRepository: AttendanceRepository

    @Mock
    lateinit var memberRepository: MemberRepository

    @Mock
    lateinit var guestRepository: GuestRepository

    @Mock
    lateinit var databaseMemberService: DatabaseMemberService

    private lateinit var eventDbService: EventDbService

    @BeforeEach
    fun setUp() {
        eventDbService = EventDbService(
            eventRepository = eventRepository,
            attendanceRepository = attendanceRepository,
            memberRepository = memberRepository,
            guestRepository = guestRepository,
            databaseMemberService = databaseMemberService
        )
    }

    @Test
    fun `updateEvent changes name and start time`() {
        val event = Event(
            id = 7L,
            name = "Old Name",
            createDate = LocalDate.of(2026, 7, 1),
            eventDate = LocalDate.of(2026, 7, 17),
            registrationStartTime = LocalTime.of(6, 30),
            startTime = LocalTime.of(7, 0),
            endTime = LocalTime.of(9, 0),
            onTimeCutoffTime = LocalTime.of(7, 5),
            status = "ACTIVE",
            isActive = true
        )
        `when`(eventRepository.findById(7L)).thenReturn(Optional.of(event))

        val result = eventDbService.updateEvent(
            7,
            EventUpdateRequest(name = "New Name", startTime = "08:15")
        )

        assertEquals("New Name", result?.name)
        assertEquals("08:15", result?.startTime)
        val captor = ArgumentCaptor.forClass(Event::class.java)
        verify(eventRepository).save(captor.capture())
        assertEquals("New Name", captor.value.name)
        assertEquals(LocalTime.of(8, 15), captor.value.startTime)
    }
}
