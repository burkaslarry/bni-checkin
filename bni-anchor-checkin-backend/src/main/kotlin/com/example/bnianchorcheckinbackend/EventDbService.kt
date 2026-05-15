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
    private val databaseMemberService: DatabaseMemberService
) {
    private val hkt = ZoneId.of("Asia/Hong_Kong")
    private val activeStatus = "ACTIVE"

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

    private fun resolveMemberId(name: String): Int? {
        return memberRepository.findByNameIgnoreCase(name).orElse(null)?.id?.toInt()
    }

    /** Create a new event in DB and seed [bni_anchor_attendances] with one absent row per member when members exist. */
    @Transactional
    fun createEvent(request: EventRequest): EventData {
        val eventDate = LocalDate.parse(request.date)
        val startTime = parseTime(request.startTime)
        val endTime = parseTime(request.endTime)
        val regStartTime = parseTime(request.registrationStartTime)
        val onTimeCutoff = parseTime(request.onTimeCutoff)

        val event = Event(
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
        val allMembers = databaseMemberService.getAllMembers()
        if (allMembers.isNotEmpty()) {
            val defaultAbsentTs =
                OffsetDateTime.of(saved.eventDate, saved.startTime, hkt.rules.getOffset(Instant.now()))
            val absentRows = allMembers.map { m ->
                Attendance(
                    memberId = m["id"] as Int,
                    eventId = eventId,
                    checkInTime = defaultAbsentTs,
                    status = "absent"
                )
            }
            attendanceRepository.saveAll(absentRows)
        }

        return toEventData(saved)
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
            createdAt = event.createDate.toString()
        )
    }

    fun getReportData(eventId: Int? = null): ReportData? {
        val event = if (eventId != null) {
            eventRepository.findById(eventId.toLong()).orElse(null)?.takeIf { it.deletedAt == null }
        } else {
            resolveActiveEvent()
        } ?: return null
        val eventDateStr = event.eventDate.toString()
        val resolvedEventId = event.id!!.toInt()

        val allMembers = databaseMemberService.getAllMembers()
        val memberIdToName = allMembers.associate { (it["id"] as Int) to (it["name"] as String) }
        val attendances = attendanceRepository.findByEventId(resolvedEventId)

        // Treat "absent" rows as absentees (not checked-in). This allows us to store a row per member.
        val checkedInMemberIds = attendances.filter { it.status != "absent" }.map { it.memberId }.toSet()
        val memberAttendees = attendances
            .filter { it.status != "absent" }
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
                    role = "MEMBER"
                )
            }
            .sortedByDescending { it.checkInTime ?: "" }

        val guestArrivals = loadGuestAttendanceRecords(eventDateStr, event.onTimeCutoffTime)

        val attendees = (memberAttendees + guestArrivals).sortedByDescending { it.checkInTime ?: "" }

        // If DB already has explicit absent rows, use them; otherwise derive absentees by missing checked-ins.
        val absentFromDb = attendances
            .filter { it.status == "absent" }
            .map { att ->
                val memberName = memberIdToName[att.memberId] ?: "Unknown (ID=${att.memberId})"
                AttendanceRecord(memberName = memberName, status = "absent", role = "MEMBER")
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

        val guestAbsentees = loadGuestAbsentRecords(eventDateStr)

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
     * registered for that date (`event_date`) **or** first check-in local day (HKT) equals that date
     * (fixes mismatched `event_date` vs actual meeting day).
     */
    fun listGuestsCheckedInForReport(eventDateStr: String): List<Guest> =
        guestsCheckedInForEventCalendarDay(eventDateStr)

    private fun guestsCheckedInForEventCalendarDay(eventDateStr: String): List<Guest> {
        val norm = eventDateStr.trim()
        val eventLd = try {
            LocalDate.parse(norm)
        } catch (_: Exception) {
            return emptyList()
        }
        val withCi = try {
            guestRepository.findAllByCheckInTimeIsNotNull()
        } catch (_: Exception) {
            emptyList()
        }
        return withCi
            .filter { g ->
                val ci = g.checkInTime ?: return@filter false
                val checkInDay = ci.atZoneSameInstant(hkt).toLocalDate()
                val ed = g.eventDate?.trim().orEmpty()
                ed.equals(norm, ignoreCase = true) || checkInDay == eventLd
            }
            .distinctBy { it.id ?: 0L }
    }

    /** Pre-registered guests for [eventDateStr] with no `check_in_time` → absent on report. */
    private fun loadGuestAbsentRecords(eventDateStr: String): List<AttendanceRecord> {
        return try {
            guestRepository.findGuestsByEventDateTrimmed(eventDateStr)
                .filter { it.checkInTime == null }
                .map { AttendanceRecord(memberName = it.name, status = "absent", role = "GUEST") }
                .sortedBy { it.memberName }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /** Guests registered for [eventDateStr] with `check_in_time` set → live-report attendee rows. */
    private fun loadGuestAttendanceRecords(eventDateStr: String, onTimeCutoff: LocalTime): List<AttendanceRecord> {
        val timeFmt = DateTimeFormatter.ofPattern("HH:mm:ss")
        return try {
            guestsCheckedInForEventCalendarDay(eventDateStr).map { g ->
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
    fun resolveActiveEvent(now: ZonedDateTime = ZonedDateTime.now(hkt)): Event? {
        val manual = eventRepository
            .findTopByStatusAndIsActiveTrueAndDeletedAtIsNullOrderByEventDateAscStartTimeAsc(activeStatus)
        if (manual != null) return manual

        val candidates = eventRepository.findAllByStatusAndDeletedAtIsNullOrderByEventDateAscStartTimeAsc(activeStatus)
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

    fun getCurrentEvent(): EventData? {
        val event = resolveActiveEvent() ?: return null
        return toEventData(event)
    }

    fun listEvents(): List<EventData> {
        return eventRepository.findAllByDeletedAtIsNullOrderByIdDesc().map { toEventData(it) }
    }

    fun hasEventThisWeek(): Boolean {
        val now = LocalDate.now(hkt)
        val startOfWeek = now.minusDays(now.dayOfWeek.value.toLong() - 1)
        val endOfWeek = startOfWeek.plusDays(6)
        return eventRepository.existsByEventDateBetweenAndDeletedAtIsNull(startOfWeek, endOfWeek)
    }

    fun hasEventForDate(eventDate: String): Boolean {
        return try {
            val date = LocalDate.parse(eventDate)
            eventRepository.findByEventDateAndDeletedAtIsNull(date) != null
        } catch (_: Exception) {
            false
        }
    }

    fun getEventForDate(eventDate: String): EventData? {
        return try {
            val date = LocalDate.parse(eventDate)
            val event = eventRepository.findByEventDateAndDeletedAtIsNull(date) ?: return null
            toEventData(event)
        } catch (_: Exception) {
            null
        }
    }

    @Transactional
    fun setEventActive(eventId: Int, exclusive: Boolean): EventData? {
        val event = eventRepository.findById(eventId.toLong()).orElse(null)?.takeIf { it.deletedAt == null } ?: return null
        event.status = activeStatus
        event.isActive = true
        eventRepository.save(event)
        if (exclusive) {
            val others = eventRepository.findAllByStatusAndDeletedAtIsNullOrderByEventDateAscStartTimeAsc(activeStatus)
                .filter { it.id != event.id }
            others.forEach { it.isActive = false }
            eventRepository.saveAll(others)
        }
        return toEventData(event)
    }

    @Transactional
    fun softDeleteEvent(eventId: Int, force: Boolean): Boolean {
        val event = eventRepository.findById(eventId.toLong()).orElse(null)?.takeIf { it.deletedAt == null } ?: return false
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
    fun logAttendance(request: AttendanceLogRequest) {
        val eventDate = try { LocalDate.parse(request.eventDate) } catch (_: Exception) { return }
        val event = eventRepository.findByEventDate(eventDate) ?: return
        val eventId = event.id!!.toInt()

        val memberId = resolveMemberId(request.attendeeName) ?: return
        val checkInTime = parseCheckInTimeToOffset(request.checkedInAt, eventDate)
            ?: OffsetDateTime.now(hkt)

        val existing = attendanceRepository.findByEventIdAndMemberId(eventId, memberId)
        if (existing != null) {
            existing.status = normalizeStatus(request.status)
            existing.checkInTime = checkInTime
            attendanceRepository.save(existing)
        } else {
            attendanceRepository.save(
                Attendance(
                    memberId = memberId,
                    eventId = eventId,
                    checkInTime = checkInTime,
                    status = normalizeStatus(request.status)
                )
            )
        }
    }

    @Transactional
    fun clearAllEventsAndAttendance() {
        attendanceRepository.deleteAll()
        eventRepository.deleteAll()
    }

    @Transactional
    fun batchUpsertCurrentEventAttendancesForExport(
        reportData: ReportData?,
        records: List<CheckInRecord>
    ) {
        val event = eventRepository.findTopByOrderByEventDateDesc() ?: return
        val eventId = event.id!!.toInt()
        val defaultAbsentTs = OffsetDateTime.of(event.eventDate, event.startTime, hkt.rules.getOffset(Instant.now()))

        val allMembers = databaseMemberService.getAllMembers()
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

    /** Split one exported attendance CSV row: 姓名,專業領域,類別,出席狀態,簽到時間 */
    private fun splitExportAttendanceRow(line: String): List<String>? {
        val indices = mutableListOf<Int>()
        var i = 0
        while (i < line.length && indices.size < 4) {
            if (line[i] == ',') indices.add(i)
            i++
        }
        if (indices.size < 4) return null
        return listOf(
            line.substring(0, indices[0]).trim(),
            line.substring(indices[0] + 1, indices[1]).trim(),
            line.substring(indices[1] + 1, indices[2]).trim(),
            line.substring(indices[2] + 1, indices[3]).trim(),
            line.substring(indices[3] + 1).trim()
        )
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
    fun importAttendanceFromExportCsv(eventDateStr: String, csvText: String): Map<String, Any> {
        val eventDate = LocalDate.parse(eventDateStr.trim())
        val event = eventRepository.findByEventDateAndDeletedAtIsNull(eventDate)
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
        if (header[0] != "姓名" || header.size != 5) {
            throw IllegalArgumentException("Expected header 姓名,專業領域,類別,出席狀態,簽到時間")
        }

        val byMemberId = attendanceRepository.findByEventId(eventId).associateBy { it.memberId }.toMutableMap()

        fun upsertMember(name: String, statusRaw: String, timeCol: String) {
            val memberId = resolveMemberId(name) ?: run {
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
            } else {
                byMemberId[memberId] = Attendance(
                    memberId = memberId,
                    eventId = eventId,
                    checkInTime = ts,
                    status = normalized
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
            val timeCol = parts[4]
            if (name.isBlank()) continue
            val cat = category.lowercase()
            when {
                cat == "member" -> upsertMember(name, statusRaw, timeCol)
                cat == "guest" || cat == "vip" || cat == "speaker" -> {
                    val guest = guestRepository.findByNameIgnoreCaseAndEventDate(name, eventDateStr).orElse(null)
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
