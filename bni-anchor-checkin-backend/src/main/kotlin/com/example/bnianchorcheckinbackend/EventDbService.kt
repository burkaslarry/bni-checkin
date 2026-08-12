package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.Attendance
import com.example.bnianchorcheckinbackend.entities.Event
import com.example.bnianchorcheckinbackend.entities.Guest
import com.example.bnianchorcheckinbackend.repositories.AttendanceRepository
import com.example.bnianchorcheckinbackend.repositories.EventRepository
import com.example.bnianchorcheckinbackend.repositories.GuestRepository
import com.example.bnianchorcheckinbackend.repositories.MemberRepository
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.*
import java.time.format.DateTimeFormatter

@Service
@ConditionalOnProperty(name = ["spring.datasource.url"])
class EventDbService(
    private val eventRepository: EventRepository,
    private val attendanceRepository: AttendanceRepository,
    private val memberRepository: MemberRepository,
    private val guestRepository: GuestRepository,
    private val databaseMemberService: DatabaseMemberService,
    private val chapterService: ChapterService? = null
) {
    private val hkt = ZoneId.of("Asia/Hong_Kong")
    private val activeStatus = "ACTIVE"
    private fun resolveChapterId(chapterTag: String? = null, chapterId: Int? = null): Int =
        chapterService?.resolveChapterId(chapterId, chapterTag) ?: (chapterId?.takeIf { it > 0 } ?: 1)
    private fun findScopedEventById(eventId: Int, chapterId: Int): Event? =
        if (chapterService == null) eventRepository.findById(eventId.toLong()).orElse(null)
        else eventRepository.findByChapterIdAndId(chapterId, eventId.toLong())

    private fun normalizeStatus(status: String?): String {
        val s = (status ?: "").trim()
        return when (s) {
            "on-time", "late", "absent", "late_with_code" -> s
            "準時" -> "on-time"
            "遲到" -> "late"
            "缺席" -> "absent"
            "遲到(有代碼)" -> "late_with_code"
            else -> "absent"
        }
    }

    /*
     * F02 -- Manual check-in datetime without timezone --- EventDbService.parseCheckInTimeToOffset
     */
    private fun parseCheckInTimeToOffset(value: String?, baseDate: LocalDate? = null): OffsetDateTime? {
        if (value.isNullOrBlank()) return null
        val v = value.trim()
        return try {
            when {
                v.contains("T") -> {
                    try {
                        OffsetDateTime.parse(v).withOffsetSameInstant(hkt.rules.getOffset(Instant.now()))
                    } catch (_: Exception) {
                        try {
                            Instant.parse(v).atZone(hkt).toOffsetDateTime()
                        } catch (_: Exception) {
                            LocalDateTime.parse(v.replace("Z", ""))
                                .atZone(hkt)
                                .toOffsetDateTime()
                        }
                    }
                }
                Regex("^\\d{1,2}:\\d{2}:\\d{2}$").matches(v) -> {
                    val lt = LocalTime.parse(v, DateTimeFormatter.ofPattern("H:mm:ss"))
                    OffsetDateTime.of(baseDate ?: LocalDate.now(hkt), lt, hkt.rules.getOffset(Instant.now()))
                }
                Regex("^\\d{1,2}:\\d{2}$").matches(v) -> {
                    val lt = LocalTime.parse(v, DateTimeFormatter.ofPattern("H:mm"))
                    OffsetDateTime.of(baseDate ?: LocalDate.now(hkt), lt, hkt.rules.getOffset(Instant.now()))
                }
                else -> null
            }
        } catch (_: Exception) {
            try {
                Instant.parse(v).atZone(hkt).toOffsetDateTime()
            } catch (_: Exception) {
                null
            }
        }
    }

    private fun parseTime(s: String): LocalTime {
        val trimmed = s.trim()
        if (trimmed.isEmpty()) return LocalTime.of(9, 0)
        return when {
            trimmed.matches(Regex("^\\d{1,2}:\\d{2}$")) -> {
                val parts = trimmed.split(":")
                LocalTime.of(parts[0].toInt(), parts[1].toInt())
            }
            trimmed.matches(Regex("^\\d{1,2}:\\d{2}:\\d{2}$")) -> {
                val parts = trimmed.split(":")
                LocalTime.of(parts[0].toInt(), parts[1].toInt(), parts[2].toInt())
            }
            else -> LocalTime.parse(trimmed)
        }
    }

    private fun resolveMemberId(name: String, chapterId: Int): Int? {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return null
        memberRepository.findByChapterIdAndNameIgnoreCase(chapterId, trimmed).orElse(null)?.id?.toInt()?.let { return it }
        return resolveMemberIdByPartialName(trimmed, chapterId)
    }

    /** Match WhatsApp shorthand (e.g. "Zoe") to a unique full member name (e.g. "Zoe Wu"). */
    internal fun resolveMemberIdByPartialName(query: String, chapterId: Int): Int? {
        val q = query.trim().lowercase()
        if (q.isEmpty()) return null
        val members = memberRepository.findAllByChapterIdOrderByNameAsc(chapterId)
        val matches = members.filter { member ->
            val n = member.name.trim().lowercase()
            n == q ||
                n.startsWith("$q ") ||
                n.endsWith(" $q") ||
                n.split(Regex("\\s+")).any { token -> token == q || token.startsWith(q) }
        }
        return if (matches.size == 1) matches[0].id!!.toInt() else null
    }

    /** Create a new event in DB and seed [bni_anchor_attendances] with one absent row per member when members exist. */
    @Transactional
    fun createEvent(request: EventRequest, chapterTag: String? = null): EventData {
        val chapterId = resolveChapterId(chapterTag)
        val eventDate = LocalDate.parse(request.date)
        val startTime = parseTime(request.startTime)
        val endTime = parseTime(request.endTime)
        val regStartTime = parseTime(request.registrationStartTime)
        val onTimeCutoff = parseTime(request.onTimeCutoff)

        val event = Event(
            chapterId = chapterId,
            name = request.name,
            createDate = LocalDate.now(hkt),
            eventDate = eventDate,
            startTime = startTime,
            endTime = endTime,
            registrationStartTime = regStartTime,
            onTimeCutoffTime = onTimeCutoff,
            lateCutoffTime = null,
            status = activeStatus,
            isActive = false
        )
        val saved = eventRepository.save(event)
        val eventId = saved.id!!.toInt()
        val allMembers = databaseMemberService.getAllMembers(chapterTag)
        if (allMembers.isNotEmpty()) {
            val defaultAbsentTs =
                OffsetDateTime.of(saved.eventDate, saved.startTime, hkt.rules.getOffset(Instant.now()))
            val absentRows = allMembers.map { m ->
                Attendance(
                    chapterId = chapterId,
                    memberId = m["id"] as Int,
                    eventId = eventId,
                    checkInTime = defaultAbsentTs,
                    status = "absent"
                )
            }
            attendanceRepository.saveAll(absentRows)
        }

        resetGuestCheckInsForEventDate(request.date, chapterTag)

        return toEventData(saved)
    }

    /** Clear guest `check_in_time` for every row on [eventDateStr] (reload guest list for a new event day). */
    @Transactional
    fun resetGuestCheckInsForEventDate(eventDateStr: String, chapterTag: String? = null): Int {
        val chapterId = resolveChapterId(chapterTag)
        val guests = guestRepository.findGuestsByChapterIdAndEventDateTrimmed(chapterId, eventDateStr.trim())
        var cleared = 0
        for (guest in guests) {
            if (guest.checkInTime != null) {
                guest.checkInTime = null
                guestRepository.save(guest)
                cleared++
            }
        }
        return cleared
    }

    /** Reset every member attendance row for [eventId] to absent (used when (re)seeding an event day). */
    @Transactional
    fun resetAllMembersAbsentForEvent(eventId: Int, eventDate: LocalDate, startTime: LocalTime, chapterTag: String? = null): Int {
        val defaultAbsentTs = OffsetDateTime.of(eventDate, startTime, hkt.rules.getOffset(Instant.now()))
        val allMembers = databaseMemberService.getAllMembers(chapterTag)
        val byMemberId = attendanceRepository.findByEventId(eventId).associateBy { it.memberId }.toMutableMap()
        for (m in allMembers) {
            val memberId = m["id"] as Int
            val existing = byMemberId[memberId]
            if (existing != null) {
                existing.status = "absent"
                existing.checkInTime = defaultAbsentTs
            } else {
                byMemberId[memberId] = Attendance(
                    chapterId = resolveChapterId(chapterTag),
                    memberId = memberId,
                    eventId = eventId,
                    checkInTime = defaultAbsentTs,
                    status = "absent"
                )
            }
        }
        attendanceRepository.saveAll(byMemberId.values.toList())
        return byMemberId.size
    }

    private fun resolveEventForDate(eventDateStr: String, chapterId: Int): Event {
        val eventDate = LocalDate.parse(eventDateStr.trim())
        return eventRepository.findByChapterIdAndEventDateAndDeletedAtIsNull(chapterId, eventDate)
            ?: throw IllegalArgumentException("No non-deleted event for date $eventDateStr")
    }

    /** Remove a member or guest check-in for [eventDateStr]; returns false when name not found in either registry. */
    @Transactional
    fun clearAttendeeCheckIn(eventDateStr: String, name: String, chapterTag: String? = null): Boolean {
        val chapterId = resolveChapterId(chapterTag)
        val event = resolveEventForDate(eventDateStr, chapterId)
        val eventId = event.id!!.toInt()
        val defaultAbsentTs = OffsetDateTime.of(event.eventDate, event.startTime, hkt.rules.getOffset(Instant.now()))
        val memberId = resolveMemberId(name.trim(), chapterId)
        if (memberId != null) {
            val existing = attendanceRepository.findByEventIdAndMemberId(eventId, memberId)
            if (existing != null) {
                existing.status = "absent"
                existing.checkInTime = defaultAbsentTs
                existing.substituteFor = null
                attendanceRepository.save(existing)
                return true
            }
        }
        val guest = guestRepository.findByChapterIdAndNameIgnoreCaseAndEventDateTrimmed(chapterId, name.trim(), eventDateStr.trim()).orElse(null)
        if (guest != null) {
            guest.checkInTime = null
            guestRepository.save(guest)
            return true
        }
        return false
    }

    /** Set member or guest check-in time for [eventDateStr]; guest must already exist on that date. */
    @Transactional
    fun setAttendeeCheckIn(eventDateStr: String, name: String, timeCol: String, chapterTag: String? = null): Boolean {
        val chapterId = resolveChapterId(chapterTag)
        val event = resolveEventForDate(eventDateStr, chapterId)
        val eventId = event.id!!.toInt()
        val memberId = resolveMemberId(name.trim(), chapterId)
        val checkInTime = parseCheckInTimeToOffset(timeCol.trim(), event.eventDate)
            ?: throw IllegalArgumentException("Invalid check-in time for ${name.trim()}: $timeCol")
        val checkInLocalTime = checkInTime.atZoneSameInstant(hkt).toLocalTime()
        val status = if (checkInLocalTime.isBefore(event.onTimeCutoffTime)) "on-time" else "late"

        if (memberId != null) {
            val existing = attendanceRepository.findByEventIdAndMemberId(eventId, memberId)
            if (existing != null) {
                existing.status = status
                existing.checkInTime = checkInTime
                attendanceRepository.save(existing)
            } else {
                attendanceRepository.save(
                    Attendance(
                        chapterId = chapterId,
                        memberId = memberId,
                        eventId = eventId,
                        checkInTime = checkInTime,
                        status = status
                    )
                )
            }
            return true
        }

        val guest = guestRepository.findByChapterIdAndNameIgnoreCaseAndEventDateTrimmed(chapterId, name.trim(), eventDateStr.trim()).orElse(null)
            ?: return false
        guest.checkInTime = checkInTime
        guestRepository.save(guest)
        return true
    }

    @Transactional
    fun applyAttendanceCorrections(request: AttendanceCorrectionsRequest, chapterTag: String? = null): Map<String, Any> {
        val warnings = mutableListOf<String>()
        var removed = 0
        var added = 0
        for (name in request.removeCheckIns) {
            if (name.isBlank()) continue
            if (clearAttendeeCheckIn(request.eventDate, name, chapterTag)) removed++ else warnings.add("remove not found: $name")
        }
        for (entry in request.addCheckIns) {
            if (entry.name.isBlank()) continue
            try {
                if (setAttendeeCheckIn(request.eventDate, entry.name, entry.time, chapterTag)) added++
                else warnings.add("add not found: ${entry.name}")
            } catch (e: Exception) {
                warnings.add("add failed for ${entry.name}: ${e.message}")
            }
        }
        return mapOf(
            "eventDate" to request.eventDate,
            "removed" to removed,
            "added" to added,
            "warnings" to warnings
        )
    }

    private fun toEventData(event: Event): EventData {
        return EventData(
            id = event.id!!.toInt(),
            name = event.name,
            date = event.eventDate.toString(),
            startTime = event.startTime.format(DateTimeFormatter.ofPattern("HH:mm")),
            endTime = event.endTime?.format(DateTimeFormatter.ofPattern("HH:mm")) ?: "09:00",
            registrationStartTime = event.registrationStartTime.format(DateTimeFormatter.ofPattern("HH:mm")),
            onTimeCutoff = event.onTimeCutoffTime.format(DateTimeFormatter.ofPattern("HH:mm")),
            createdAt = event.createDate.toString(),
            attendanceEmailSentAt = event.attendanceEmailSentAt?.toString(),
            chapterId = event.chapterId
        )
    }

    /** True when [checkInTime] falls on the event's calendar day in HKT (ignores stale test check-ins). */
    internal fun checkInOnEventDate(checkInTime: OffsetDateTime, eventDate: LocalDate): Boolean =
        checkInTime.atZoneSameInstant(hkt).toLocalDate() == eventDate

    /** Live report only shows check-ins once the event calendar day has started (HKT). */
    internal fun isReportCheckInVisible(
        checkInTime: OffsetDateTime,
        eventDate: LocalDate,
        today: LocalDate = LocalDate.now(hkt)
    ): Boolean = !today.isBefore(eventDate) && checkInOnEventDate(checkInTime, eventDate)

    fun getReportData(eventId: Int? = null, chapterTag: String? = null, chapterId: Int? = null): ReportData? {
        val chapterId = resolveChapterId(chapterTag, chapterId)
        val event = if (eventId != null) {
            findScopedEventById(eventId, chapterId)?.takeIf { it.deletedAt == null }
        } else {
            resolveActiveEvent(chapterTag = chapterTag, chapterId = chapterId)
        } ?: return null
        val eventDateStr = event.eventDate.toString()
        val eventDate = event.eventDate
        val resolvedEventId = event.id!!.toInt()

        val allMembers = databaseMemberService.getAllMembers(chapterTag)
        val memberIdToName = allMembers.associate { (it["id"] as Int) to (it["name"] as String) }
        val attendances = attendanceRepository.findByEventId(resolvedEventId)

        fun isValidMemberCheckIn(att: Attendance): Boolean =
            att.status != "absent" && isReportCheckInVisible(att.checkInTime, eventDate)

        // Treat "absent" rows as absentees (not checked-in). Ignore check-ins from other calendar days.
        val checkedInMemberIds = attendances.filter { isValidMemberCheckIn(it) }.map { it.memberId }.toSet()
        val memberAttendees = attendances
            .filter { isValidMemberCheckIn(it) }
            .map { att ->
                val memberName = memberIdToName[att.memberId] ?: "Unknown (ID=${att.memberId})"
                val timeStr = try {
                    att.checkInTime.atZoneSameInstant(hkt).toLocalTime()
                        .format(DateTimeFormatter.ofPattern("HH:mm:ss"))
                } catch (_: Exception) {
                    ""
                }
                AttendanceRecord(
                    memberName = memberName,
                    status = att.status,
                    checkInTime = timeStr.ifEmpty { null },
                    role = "MEMBER",
                    substituteFor = att.substituteFor?.trim()?.takeIf { it.isNotEmpty() }
                )
            }
            .sortedByDescending { it.checkInTime ?: "" }

        val guestArrivals = loadGuestAttendanceRecords(eventDateStr, event.onTimeCutoffTime, chapterId)

        val attendees = (memberAttendees + guestArrivals).sortedByDescending { it.checkInTime ?: "" }

        // If DB already has explicit absent rows, use them; otherwise derive absentees by missing checked-ins.
        // Rows marked checked-in on the wrong calendar day count as absent on the live report.
        val absentFromDb = attendances
            .filter { it.status == "absent" || !isReportCheckInVisible(it.checkInTime, eventDate) }
            .map { att ->
                val memberName = memberIdToName[att.memberId] ?: "Unknown (ID=${att.memberId})"
                AttendanceRecord(
                    memberName = memberName,
                    status = "absent",
                    role = "MEMBER",
                    substituteFor = att.substituteFor?.trim()?.takeIf { it.isNotEmpty() }
                )
            }
            .sortedBy { it.memberName }

        val absentMemberRecords = if (absentFromDb.isNotEmpty()) {
            absentFromDb
        } else {
            allMembers
                .filter { (it["id"] as Int) !in checkedInMemberIds }
                .map { AttendanceRecord(memberName = it["name"] as String, status = "absent", role = "MEMBER") }
                .sortedBy { it.memberName }
        }

        val guestAbsentees = loadGuestAbsentRecords(eventDateStr, chapterId)

        val absentees = (absentMemberRecords + guestAbsentees).sortedBy { it.memberName }

        val stats = ReportStats(
            totalAttendees = attendees.size,
            onTimeCount = attendees.count { it.status == "on-time" },
            lateCount = attendees.count { it.status == "late" || it.status == "late_with_code" },
            absentCount = absentees.size,
            guestCount = guestArrivals.size,
            vipCount = 0,
            vipArrivedCount = 0,
            speakerCount = 0
        )

        return ReportData(
            eventId = resolvedEventId,
            eventName = event.name,
            eventDate = eventDateStr,
            onTimeCutoff = event.onTimeCutoffTime.format(DateTimeFormatter.ofPattern("HH:mm")),
            attendees = attendees,
            absentees = absentees,
            stats = stats
        )
    }

    /**
     * Guests who should appear on the live report for [eventDateStr] (`YYYY-MM-DD`):
     * only guests registered for that event date. Do not infer event membership from
     * check-in day, otherwise old event guest rows can leak into a new report.
     */
    fun listGuestsCheckedInForReport(eventDateStr: String, chapterTag: String? = null): List<Guest> {
        val eventDate = try { LocalDate.parse(eventDateStr.trim()) } catch (_: Exception) { return emptyList() }
        val today = LocalDate.now(hkt)
        return guestsCheckedInForEventCalendarDay(eventDateStr, resolveChapterId(chapterTag))
            .filter { g -> g.checkInTime != null && isReportCheckInVisible(g.checkInTime!!, eventDate, today) }
    }

    private fun guestsCheckedInForEventCalendarDay(eventDateStr: String, chapterId: Int): List<Guest> {
        val norm = eventDateStr.trim()
        val withCi = try {
            guestRepository.findAllByChapterIdAndCheckInTimeIsNotNull(chapterId)
        } catch (_: Exception) {
            emptyList()
        }
        return withCi
            .filter { g ->
                val ed = g.eventDate?.trim().orEmpty()
                ed.equals(norm, ignoreCase = true)
            }
            .distinctBy { it.id ?: 0L }
    }

    /** Pre-registered guests for [eventDateStr] with no valid same-day check-in → absent on report. */
    private fun loadGuestAbsentRecords(eventDateStr: String, chapterId: Int): List<AttendanceRecord> {
        val eventDate = try { LocalDate.parse(eventDateStr.trim()) } catch (_: Exception) { return emptyList() }
        val today = LocalDate.now(hkt)
        return try {
            guestRepository.findGuestsByChapterIdAndEventDateTrimmed(chapterId, eventDateStr)
                .filter { g ->
                    g.checkInTime == null || !isReportCheckInVisible(g.checkInTime!!, eventDate, today)
                }
                .map { AttendanceRecord(memberName = it.name, status = "absent", role = "GUEST") }
                .sortedBy { it.memberName }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /** Guests registered for [eventDateStr] with `check_in_time` set → live-report attendee rows. */
    private fun loadGuestAttendanceRecords(eventDateStr: String, onTimeCutoff: LocalTime, chapterId: Int): List<AttendanceRecord> {
        val eventDate = try { LocalDate.parse(eventDateStr.trim()) } catch (_: Exception) { return emptyList() }
        val today = LocalDate.now(hkt)
        val timeFmt = DateTimeFormatter.ofPattern("HH:mm:ss")
        return try {
            guestsCheckedInForEventCalendarDay(eventDateStr, chapterId)
                .filter { g -> g.checkInTime != null && isReportCheckInVisible(g.checkInTime!!, eventDate, today) }
                .map { g ->
                val lt = g.checkInTime!!.atZoneSameInstant(hkt).toLocalTime()
                val status =
                    if (lt.isBefore(onTimeCutoff)) "on-time" else "late"
                AttendanceRecord(
                    memberName = g.name,
                    status = status,
                    checkInTime = lt.format(timeFmt),
                    role = "GUEST"
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Resolve active event with rolling window:
     * 1) manual override (is_active=true) + ACTIVE status
     * 2) ongoing session (supports overnight)
     * 3) upcoming within today..+2 days (inclusive), by date/time ASC
     */
    fun resolveActiveEvent(
        now: ZonedDateTime = ZonedDateTime.now(hkt),
        chapterTag: String? = null,
        chapterId: Int? = null
    ): Event? {
        val chapterId = resolveChapterId(chapterTag, chapterId)
        val manual = eventRepository
            .findTopByChapterIdAndStatusAndIsActiveTrueAndDeletedAtIsNullOrderByEventDateAscStartTimeAsc(chapterId, activeStatus)
        if (manual != null) return manual

        val candidates = eventRepository.findAllByChapterIdAndStatusAndDeletedAtIsNullOrderByEventDateAscStartTimeAsc(chapterId, activeStatus)
        val ongoing = candidates.firstOrNull { e ->
            val start = ZonedDateTime.of(e.eventDate, e.startTime, hkt)
            val endBase = e.endTime ?: e.startTime.plusHours(2)
            val end = ZonedDateTime.of(
                if (!endBase.isAfter(e.startTime)) e.eventDate.plusDays(1) else e.eventDate,
                endBase,
                hkt
            )
            !now.isBefore(start) && now.isBefore(end)
        }
        if (ongoing != null) return ongoing

        val startDate = now.toLocalDate()
        val endDate = startDate.plusDays(2)
        return candidates.firstOrNull { e ->
            !e.eventDate.isBefore(startDate) && !e.eventDate.isAfter(endDate)
        }
    }

    fun getCurrentEvent(chapterTag: String? = null, chapterId: Int? = null): EventData? {
        val event = resolveActiveEvent(chapterTag = chapterTag, chapterId = chapterId) ?: return null
        return toEventData(event)
    }

    fun listEvents(chapterTag: String? = null, chapterId: Int? = null): List<EventData> {
        val chapterId = resolveChapterId(chapterTag, chapterId)
        return eventRepository.findAllByChapterIdAndDeletedAtIsNullOrderByIdDesc(chapterId).map { toEventData(it) }
    }

    fun hasEventThisWeek(chapterTag: String? = null): Boolean {
        val chapterId = resolveChapterId(chapterTag)
        val now = LocalDate.now(hkt)
        val startOfWeek = now.minusDays(now.dayOfWeek.value.toLong() - 1)
        val endOfWeek = startOfWeek.plusDays(6)
        return eventRepository.existsByChapterIdAndEventDateBetweenAndDeletedAtIsNull(chapterId, startOfWeek, endOfWeek)
    }

    fun hasEventForDate(eventDate: String, chapterTag: String? = null): Boolean {
        val chapterId = resolveChapterId(chapterTag)
        return try {
            val date = LocalDate.parse(eventDate)
            eventRepository.findByChapterIdAndEventDateAndDeletedAtIsNull(chapterId, date) != null
        } catch (_: Exception) {
            false
        }
    }

    fun getEventForDate(eventDate: String, chapterTag: String? = null): EventData? {
        val chapterId = resolveChapterId(chapterTag)
        return try {
            val date = LocalDate.parse(eventDate)
            val event = eventRepository.findByChapterIdAndEventDateAndDeletedAtIsNull(chapterId, date) ?: return null
            toEventData(event)
        } catch (_: Exception) {
            null
        }
    }

    @Transactional
    fun setEventActive(eventId: Int, exclusive: Boolean, chapterTag: String? = null): EventData? {
        val chapterId = resolveChapterId(chapterTag)
        val event = findScopedEventById(eventId, chapterId)?.takeIf { it.deletedAt == null } ?: return null
        event.status = activeStatus
        event.isActive = true
        eventRepository.save(event)
        if (exclusive) {
            val others = eventRepository.findAllByChapterIdAndStatusAndDeletedAtIsNullOrderByEventDateAscStartTimeAsc(chapterId, activeStatus)
                .filter { it.id != event.id }
            others.forEach { it.isActive = false }
            eventRepository.saveAll(others)
        }
        return toEventData(event)
    }

    /** Update event name, start time, and/or end time. Returns null if event not found or deleted. */
    @Transactional
    fun updateEvent(eventId: Int, request: EventUpdateRequest, chapterTag: String? = null): EventData? {
        val chapterId = resolveChapterId(chapterTag)
        val event = findScopedEventById(eventId, chapterId)?.takeIf { it.deletedAt == null }
            ?: return null
        val newName = request.name?.trim()?.takeIf { it.isNotEmpty() }
        val newStartTime = request.startTime?.trim()?.takeIf { it.isNotEmpty() }?.let { parseTime(it) }
        val newEndTime = request.endTime?.trim()?.takeIf { it.isNotEmpty() }?.let { parseTime(it) }
        if (newName == null && newStartTime == null && newEndTime == null) {
            throw IllegalArgumentException("At least one of name, startTime, or endTime must be provided")
        }
        if (newName != null) event.name = newName
        if (newStartTime != null) event.startTime = newStartTime
        if (newEndTime != null) event.endTime = newEndTime
        eventRepository.save(event)
        return toEventData(event)
    }

    @Transactional
    fun softDeleteEvent(eventId: Int, force: Boolean, chapterTag: String? = null): Boolean {
        val chapterId = resolveChapterId(chapterTag)
        val event = findScopedEventById(eventId, chapterId)?.takeIf { it.deletedAt == null } ?: return false
        if (force) {
            attendanceRepository.deleteByEventId(eventId)
        } else {
            val count = attendanceRepository.countByEventId(eventId)
            if (count > 0) throw IllegalStateException("Event has attendance records. Use force=true to cascade delete check-ins.")
        }
        event.status = "DELETED"
        event.isActive = false
        event.deletedAt = OffsetDateTime.now(hkt)
        eventRepository.save(event)
        return true
    }

    @Transactional
    fun logAttendance(request: AttendanceLogRequest, chapterTag: String? = null, chapterId: Int? = null) {
        val chapterId = resolveChapterId(chapterTag, chapterId)
        val eventDate = try { LocalDate.parse(request.eventDate) } catch (_: Exception) { return }
        val event = eventRepository.findByChapterIdAndEventDateAndDeletedAtIsNull(chapterId, eventDate) ?: return
        val eventId = event.id!!.toInt()

        val memberId = resolveMemberId(request.attendeeName, chapterId) ?: return
        val checkInTime = parseCheckInTimeToOffset(request.checkedInAt, LocalDate.now(hkt))
            ?: OffsetDateTime.now(hkt)

        val normalized = normalizeStatus(request.status)
        val existing = attendanceRepository.findByEventIdAndMemberId(eventId, memberId)
        if (existing != null && existing.status != "absent" && normalized != "absent") {
            throw IllegalStateException("${request.attendeeName} 已經簽到 (Already checked in)")
        }
        if (existing != null) {
            existing.status = normalized
            existing.checkInTime = checkInTime
            attendanceRepository.save(existing)
        } else {
            attendanceRepository.save(
                Attendance(
                    chapterId = chapterId,
                    memberId = memberId,
                    eventId = eventId,
                    checkInTime = checkInTime,
                    status = normalized
                )
            )
        }
    }

    /** Set or clear substitute attendee name on a member's attendance row for an event date. */
    @Transactional
    fun updateMemberSubstitute(eventDateStr: String, memberName: String, substituteName: String?, chapterTag: String? = null): Boolean {
        val chapterId = resolveChapterId(chapterTag)
        val eventDate = try { LocalDate.parse(eventDateStr.trim()) } catch (_: Exception) { return false }
        val event = eventRepository.findByChapterIdAndEventDateAndDeletedAtIsNull(chapterId, eventDate) ?: return false
        val eventId = event.id!!.toInt()
        val memberId = resolveMemberId(memberName.trim(), chapterId) ?: return false
        val existing = ensureAttendanceRow(event, eventId, memberId, chapterId)
        existing.substituteFor = substituteName?.trim()?.takeIf { it.isNotEmpty() }
        attendanceRepository.save(existing)
        return true
    }

    /** Planned substitutes for an event (member slot → substitute name). */
    fun getPlannedSubstitutes(eventDateStr: String, chapterTag: String? = null): List<Map<String, String>> {
        val chapterId = resolveChapterId(chapterTag)
        val eventDate = try { LocalDate.parse(eventDateStr.trim()) } catch (_: Exception) { return emptyList() }
        val event = eventRepository.findByChapterIdAndEventDateAndDeletedAtIsNull(chapterId, eventDate) ?: return emptyList()
        val eventId = event.id!!.toInt()
        val membersById = memberRepository.findAllByChapterIdOrderByNameAsc(chapterId)
            .associate { it.id!!.toInt() to it.name }
        return attendanceRepository.findByEventId(eventId).mapNotNull { att ->
            val sub = att.substituteFor?.trim()?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
            val memberName = membersById[att.memberId] ?: return@mapNotNull null
            mapOf("memberName" to memberName, "substituteName" to sub)
        }
    }

    /** Bulk-set planned substitutes before check-in (WhatsApp 替代人名單). */
    @Transactional
    fun bulkSetPlannedSubstitutes(
        eventDateStr: String,
        entries: List<PlannedSubstituteEntry>,
        chapterTag: String? = null
    ): ImportResult {
        val chapterId = resolveChapterId(chapterTag)
        val eventDate = try { LocalDate.parse(eventDateStr.trim()) } catch (_: Exception) {
            return ImportResult(
                total = entries.size, inserted = 0, updated = 0, failed = entries.size,
                errors = listOf("Invalid event date: $eventDateStr")
            )
        }
        val event = eventRepository.findByChapterIdAndEventDateAndDeletedAtIsNull(chapterId, eventDate)
            ?: return ImportResult(
                total = entries.size, inserted = 0, updated = 0, failed = entries.size,
                errors = listOf("No event for date $eventDateStr")
            )
        val eventId = event.id!!.toInt()
        var updated = 0
        var failed = 0
        val errors = mutableListOf<String>()
        for (entry in entries) {
            try {
                val memberName = entry.memberName.trim()
                val substituteName = entry.substituteName.trim()
                if (memberName.isBlank() || substituteName.isBlank()) {
                    failed++
                    errors.add("Missing member or substitute name")
                    continue
                }
                val memberId = resolveMemberId(memberName, chapterId)
                if (memberId == null) {
                    failed++
                    errors.add("Member not found: $memberName")
                    continue
                }
                val row = ensureAttendanceRow(event, eventId, memberId, chapterId)
                row.substituteFor = substituteName
                attendanceRepository.save(row)
                updated++
            } catch (e: Exception) {
                failed++
                errors.add("Failed ${entry.memberName}: ${e.message}")
            }
        }
        return ImportResult(
            total = entries.size,
            inserted = 0,
            updated = updated,
            failed = failed,
            errors = errors
        )
    }

    private fun ensureAttendanceRow(event: Event, eventId: Int, memberId: Int, chapterId: Int): Attendance {
        val existing = attendanceRepository.findByEventIdAndMemberId(eventId, memberId)
        if (existing != null) return existing
        val defaultAbsentTs = OffsetDateTime.of(
            event.eventDate,
            event.startTime,
            hkt.rules.getOffset(Instant.now())
        )
        return attendanceRepository.save(
            Attendance(
                chapterId = chapterId,
                memberId = memberId,
                eventId = eventId,
                checkInTime = defaultAbsentTs,
                status = "absent"
            )
        )
    }

    @Transactional
    fun clearAllEventsAndAttendance() {
        attendanceRepository.deleteAll()
        eventRepository.deleteAll()
    }

    @Transactional
    fun batchUpsertCurrentEventAttendancesForExport(
        reportData: ReportData?,
        records: List<CheckInRecord>,
        chapterTag: String? = null
    ) {
        val chapterId = resolveChapterId(chapterTag)
        val event = eventRepository.findTopByChapterIdAndDeletedAtIsNullOrderByEventDateDescStartTimeDesc(chapterId) ?: return
        val eventId = event.id!!.toInt()
        val defaultAbsentTs = OffsetDateTime.of(event.eventDate, event.startTime, hkt.rules.getOffset(Instant.now()))

        val allMembers = databaseMemberService.getAllMembers(chapterTag)
        val memberNameToId = allMembers.associate { (it["name"] as String) to (it["id"] as Int) }
        val byMemberId = attendanceRepository.findByEventId(eventId).associateBy { it.memberId }.toMutableMap()

        fun upsert(name: String, status: String, checkInTime: OffsetDateTime?) {
            val memberId = memberNameToId[name] ?: return
            val normalized = normalizeStatus(status)
            // check_in_time is NOT NULL in schema; for absent rows we use event start time as a stable placeholder.
            val ts = checkInTime ?: if (normalized == "absent") defaultAbsentTs else OffsetDateTime.now(hkt)
            val existing = byMemberId[memberId]
            if (existing != null) {
                existing.status = normalized
                existing.checkInTime = ts
            } else {
                byMemberId[memberId] = Attendance(
                    chapterId = chapterId,
                    memberId = memberId,
                    eventId = eventId,
                    checkInTime = ts,
                    status = normalized
                )
            }
        }

        if (reportData != null) {
            for (a in reportData.attendees) {
                upsert(a.memberName, a.status, parseCheckInTimeToOffset(a.checkInTime, event.eventDate))
            }
            // Ensure absentees are persisted as well
            for (ab in reportData.absentees) {
                upsert(ab.memberName, "absent", null)
            }
        }

        for (r in records) {
            if (r.type.equals("guest", ignoreCase = true)) continue
            upsert(r.name, "on-time", parseCheckInTimeToOffset(r.timestamp, event.eventDate))
        }

        // Final guard: ensure every member has a row for this event (default absent).
        for (m in allMembers) {
            val memberId = m["id"] as Int
            if (!byMemberId.containsKey(memberId)) {
                val memberName = m["name"] as String
                upsert(memberName, "absent", null)
            }
        }

        attendanceRepository.saveAll(byMemberId.values.toList())
    }

    /** Split one exported attendance CSV row (5 or 6 columns). */
    private fun splitExportAttendanceRow(line: String): List<String>? {
        val indices = mutableListOf<Int>()
        var i = 0
        while (i < line.length && indices.size < 5) {
            if (line[i] == ',') indices.add(i)
            i++
        }
        if (indices.size < 4) return null
        val parts = mutableListOf<String>()
        for (j in indices.indices) {
            val start = if (j == 0) 0 else indices[j - 1] + 1
            parts.add(line.substring(start, indices[j]).trim())
        }
        parts.add(line.substring(indices.last() + 1).trim())
        return parts
    }

    private fun isValidAttendanceCsvHeader(header: List<String>): Boolean {
        if (header.isEmpty() || header[0] != "姓名") return false
        return header.size == 5 || (header.size == 6 && header[5] == "替代人")
    }

    private fun normalizeImportStatus(raw: String): String {
        val s = raw.trim()
        if (s == "已簽到") return "on-time"
        return normalizeStatus(s)
    }

    /**
     * Apply rows from an export-format CSV (same columns as GET /api/export).
     * Upserts member rows in [bni_anchor_attendances]; updates guest [check_in_time] for matching [bni_anchor_guests] on this date.
     */
    @Transactional
    fun importAttendanceFromExportCsv(eventDateStr: String, csvText: String, chapterTag: String? = null): Map<String, Any> {
        val chapterId = resolveChapterId(chapterTag)
        val eventDate = LocalDate.parse(eventDateStr.trim())
        val event = eventRepository.findByChapterIdAndEventDateAndDeletedAtIsNull(chapterId, eventDate)
            ?: throw IllegalArgumentException("No non-deleted event for date $eventDateStr")
        val eventId = event.id!!.toInt()
        val defaultAbsentTs = OffsetDateTime.of(event.eventDate, event.startTime, hkt.rules.getOffset(Instant.now()))
        val warnings = mutableListOf<String>()
        var memberUpserts = 0
        var guestUpdates = 0

        val text = csvText.trim().removePrefix("\uFEFF")
        val lines = text.lines().map { it.trim() }.filter { it.isNotEmpty() }
        if (lines.isEmpty()) throw IllegalArgumentException("CSV is empty")
        val header = splitExportAttendanceRow(lines.first())
            ?: throw IllegalArgumentException("Invalid CSV header row")
        if (!isValidAttendanceCsvHeader(header)) {
            throw IllegalArgumentException("Expected header 姓名,專業領域,類別,出席狀態,簽到時間[,替代人]")
        }
        val hasSubstituteColumn = header.size == 6

        val byMemberId = attendanceRepository.findByEventId(eventId).associateBy { it.memberId }.toMutableMap()

        fun upsertMember(name: String, statusRaw: String, timeCol: String, substituteCol: String? = null) {
            val memberId = resolveMemberId(name, chapterId) ?: run {
                warnings.add("member not in DB (skipped): $name")
                return
            }
            val normalized = normalizeImportStatus(statusRaw)
            val ts = when (normalized) {
                "absent" -> defaultAbsentTs
                else -> parseCheckInTimeToOffset(timeCol, event.eventDate)
                    ?: run {
                        warnings.add("bad time for member $name, using event start: '$timeCol'")
                        defaultAbsentTs
                    }
            }
            val existing = byMemberId[memberId]
            if (existing != null) {
                existing.status = normalized
                existing.checkInTime = ts
                if (substituteCol != null) {
                    existing.substituteFor = substituteCol.trim().takeIf { it.isNotEmpty() }
                }
            } else {
                byMemberId[memberId] = Attendance(
                    chapterId = chapterId,
                    memberId = memberId,
                    eventId = eventId,
                    checkInTime = ts,
                    status = normalized,
                    substituteFor = substituteCol?.trim()?.takeIf { it.isNotEmpty() }
                )
            }
            memberUpserts++
        }

        for (lineIdx in 1 until lines.size) {
            val parts = splitExportAttendanceRow(lines[lineIdx])
            if (parts == null) {
                warnings.add("bad row ${lineIdx + 1}: ${lines[lineIdx]}")
                continue
            }
            val name = parts[0]
            val category = parts[2]
            val statusRaw = parts[3]
            val timeCol = parts.getOrNull(4) ?: ""
            val substituteCol = if (hasSubstituteColumn) parts.getOrNull(5)?.trim()?.takeIf { it.isNotEmpty() } else null
            if (name.isBlank()) continue
            val cat = category.lowercase()
            when {
                cat == "member" -> upsertMember(name, statusRaw, timeCol, substituteCol)
                cat == "guest" || cat == "vip" || cat == "speaker" -> {
                    val guest = guestRepository.findByChapterIdAndNameIgnoreCaseAndEventDateTrimmed(chapterId, name, eventDateStr).orElse(null)
                    if (guest == null) {
                        warnings.add("guest not in DB for date (skipped): $name")
                    } else {
                        val normalized = normalizeImportStatus(statusRaw)
                        guest.checkInTime = when (normalized) {
                            "absent" -> null
                            else -> parseCheckInTimeToOffset(timeCol, event.eventDate)
                                ?: defaultAbsentTs.also {
                                    warnings.add("guest time fallback for $name: '$timeCol'")
                                }
                        }
                        guestRepository.save(guest)
                        guestUpdates++
                    }
                }
                else -> warnings.add("unknown category '$category' for $name")
            }
        }

        attendanceRepository.saveAll(byMemberId.values.toList())

        return mapOf(
            "eventId" to eventId,
            "eventDate" to eventDateStr,
            "memberRowsApplied" to memberUpserts,
            "guestRowsApplied" to guestUpdates,
            "warnings" to warnings
        )
    }
}
