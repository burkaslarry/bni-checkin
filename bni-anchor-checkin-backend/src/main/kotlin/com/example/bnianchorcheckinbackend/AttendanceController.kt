package com.example.bnianchorcheckinbackend

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import com.example.bnianchorcheckinbackend.repositories.EventRepository
import java.io.ByteArrayOutputStream
import java.io.PrintWriter

/** Request body for POST /api/attendance/scan: QR payload JSON string. */
data class QrScanRequest(val qrPayload: String)

/**
 * Request body for POST /api/attendance/log: direct attendance log (member or guest).
 * @param attendeeId Null for guests; member ID when type is member.
 * @param attendeeType "member" | "guest" | "vip" | "speaker"
 * @param eventDate YYYY-MM-DD
 * @param checkedInAt ISO or time string
 * @param status e.g. "on-time" | "late"
 */
data class AttendanceLogRequest(
    val attendeeId: Int?,
    val attendeeType: String,
    val attendeeName: String,
    val attendeeProfession: String? = null,
    val eventDate: String,
    val checkedInAt: String,
    val status: String
)

data class EventActiveRequest(
    val exclusive: Boolean = false
)

/**
 * REST controller for attendance, members, guests, events, records, export, report, and AI insights.
 * Uses in-memory [AttendanceService] and optional DB ([DatabaseMemberService], [EventDbService]). No auth enforced.
 * Side effects: DB read/write when DB services present; in-memory state; WebSocket not used here (handled elsewhere).
 *
 * Endpoints: POST /api/attendance/scan, GET /api/members, GET /api/guests, POST /api/checkin, GET/DELETE /api/records,
 * POST /api/events, GET /api/report, GET /api/events/current, GET /api/events/check, GET /api/events/check-this-week,
 * GET /api/events/for-date, POST /api/attendance/log, DELETE /api/events/clear-all, GET /api/export,
 * GET /api/attendance/member, GET /api/attendance/event, POST and GET /api/insights (generate, list, data-export).
 */
@RestController
@Tag(name = "Attendance", description = "Endpoints for scanning and querying attendance records.")
class AttendanceController(
    private val attendanceService: AttendanceService,
    private val guestService: GuestService,
    @Autowired(required = false) private val databaseMemberService: DatabaseMemberService?,
    @Autowired(required = false) private val eventDbService: EventDbService?,
    @Autowired(required = false) private val eventRepository: EventRepository?,
    @Autowired(required = false) private val guestRepository: com.example.bnianchorcheckinbackend.repositories.GuestRepository?,
    @Autowired(required = false) private val attendanceWebSocketHandler: AttendanceWebSocketHandler?,
) {
    private val log = org.slf4j.LoggerFactory.getLogger(AttendanceController::class.java)
    private val hkt: java.time.ZoneId = java.time.ZoneId.of("Asia/Hong_Kong")

    private fun parseClientTimeToHktOffset(raw: String): java.time.OffsetDateTime {
        val fallbackNow = java.time.OffsetDateTime.now(hkt)
        val offset = hkt.rules.getOffset(java.time.Instant.now())
        return try {
            java.time.OffsetDateTime.parse(raw).withOffsetSameInstant(offset)
        } catch (_: Exception) {
            try {
                java.time.ZonedDateTime.parse(raw).withZoneSameInstant(hkt).toOffsetDateTime()
            } catch (_: Exception) {
                try {
                    java.time.Instant.parse(raw).atZone(hkt).toOffsetDateTime()
                } catch (_: Exception) {
                    try {
                        java.time.LocalDateTime.parse(raw.replace("Z", ""))
                            .atZone(hkt)
                            .toOffsetDateTime()
                    } catch (_: Exception) {
                        fallbackNow
                    }
                }
            }
        }
    }

    /** CSV 簽到時間 column: match Excel samples (e.g. 6:23), strip seconds when present. */
    private fun formatCsvCheckInTime(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        val trimmed = raw.trim()
        val lt = try {
            when (trimmed.count { it == ':' }) {
                2 -> {
                    val p = trimmed.split(":")
                    java.time.LocalTime.of(p[0].toInt(), p[1].toInt(), p.getOrElse(2) { "0" }.take(2).toInt())
                }
                1 -> {
                    val p = trimmed.split(":")
                    java.time.LocalTime.of(p[0].toInt(), p[1].toInt())
                }
                else -> return trimmed
            }
        } catch (_: Exception) {
            return trimmed
        }
        return lt.format(java.time.format.DateTimeFormatter.ofPattern("H:mm"))
    }

    /**
     * Same merge as GET /api/report: DB member attendance + guest rows ([GuestRepository]) +
     * in-memory check-ins for [reportData.eventDate], deduped by name.
     */
    private fun mergeReportWithGuestsAndInMemory(reportData: ReportData): ReportData {
        val timeFmt = java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss")

        val dbGuestExtras = try {
            val repo = guestRepository
            if (repo != null) {
                repo.findByEventDate(reportData.eventDate)
                    .filter { it.checkInTime != null }
                    .map { g ->
                        val checkInLocal = g.checkInTime
                            ?.atZoneSameInstant(hkt)
                            ?.toLocalTime()
                            ?.format(timeFmt)
                        val status = try {
                            val cutoff = java.time.LocalTime.parse(reportData.onTimeCutoff)
                            val checkIn = if (checkInLocal != null) java.time.LocalTime.parse(checkInLocal) else null
                            if (checkIn != null && checkIn.isBefore(cutoff)) "on-time" else "late"
                        } catch (_: Exception) {
                            "on-time"
                        }
                        AttendanceRecord(
                            memberName = g.name,
                            status = status,
                            checkInTime = checkInLocal,
                            role = "GUEST"
                        )
                    }
            } else {
                emptyList()
            }
        } catch (_: Exception) {
            emptyList()
        }

        val allInMemory = attendanceService.getAllRecords().filter { r ->
            isTimestampOnEventDate(r.timestamp, reportData.eventDate)
        }

        val dbAttendeeNames = reportData.attendees.map { it.memberName.lowercase() }.toSet()

        val extraAttendees = allInMemory
            .filter { r -> r.name.lowercase() !in dbAttendeeNames }
            .map { r ->
                val role = when {
                    r.role.uppercase() in listOf("VIP", "SPEAKER") -> r.role.uppercase()
                    r.type.equals("member", ignoreCase = true) -> "MEMBER"
                    else -> "GUEST"
                }
                val timeStr = toHktLocalTime(r.timestamp)?.format(timeFmt) ?: r.timestamp

                val status = try {
                    val cutoff = java.time.LocalTime.parse(reportData.onTimeCutoff)
                    val checkIn = java.time.LocalTime.parse(timeStr)
                    if (checkIn.isBefore(cutoff)) "on-time" else "late"
                } catch (_: Exception) {
                    "on-time"
                }

                AttendanceRecord(memberName = r.name, status = status, checkInTime = timeStr, role = role)
            }

        if (dbGuestExtras.isEmpty() && extraAttendees.isEmpty()) {
            return reportData
        }

        val memberExtra = extraAttendees.filter { it.role == "MEMBER" }
        val absentNames = memberExtra.map { it.memberName.lowercase() }.toSet()
        val updatedAbsentees = reportData.absentees.filter { ab -> ab.memberName.lowercase() !in absentNames }

        val mergedRaw = reportData.attendees + dbGuestExtras + extraAttendees
        val seen = mutableSetOf<String>()
        val mergedAttendees = mergedRaw.filter { a ->
            val k = a.memberName.lowercase()
            if (seen.contains(k)) false else {
                seen.add(k); true
            }
        }

        return reportData.copy(
            attendees = mergedAttendees,
            absentees = updatedAbsentees,
            stats = reportData.stats.copy(
                totalAttendees = mergedAttendees.size,
                absentCount = updatedAbsentees.size,
                guestCount = mergedAttendees.count { it.role == "GUEST" },
                vipCount = mergedAttendees.count { it.role == "VIP" || it.role == "SPEAKER" },
                vipArrivedCount = mergedAttendees.count { it.role == "VIP" || it.role == "SPEAKER" },
                speakerCount = mergedAttendees.count { it.role == "SPEAKER" },
                onTimeCount = mergedAttendees.count { it.status == "on-time" },
                lateCount = mergedAttendees.count { it.status == "late" || it.status == "late_with_code" }
            )
        )
    }

    /**
     * Run a DB operation with retries (delays 0, 1s, 3s + jitter). Side effect: [block] may perform DB I/O.
     * @param operation Name for logging
     * @param maxAttempts Retry count
     * @param block DB operation (e.g. eventDbService.getReportData())
     * @return Result of [block]
     * @throws Exception Last exception after retries, or [InterruptedException] if interrupted
     */
    private fun <T> withDbRetry(
        operation: String,
        maxAttempts: Int = 3,
        block: () -> T
    ): T {
        val delays = listOf(0L, 1000L, 3000L)
        var lastError: Exception? = null
        for (attempt in 1..maxAttempts) {
            val delay = delays.getOrElse(attempt - 1) { 3000L } + kotlin.random.Random.nextLong(0, 300)
            if (delay > 0) {
                try {
                    Thread.sleep(delay)
                } catch (ie: InterruptedException) {
                    Thread.currentThread().interrupt()
                    throw RuntimeException("Retry interrupted for $operation", ie)
                }
            }
            try {
                return block()
            } catch (e: Exception) {
                lastError = e
                if (attempt < maxAttempts) {
                    log.warn("DB {} failed (attempt {}/{}): {}", operation, attempt, maxAttempts, e.message)
                }
            }
        }
        throw lastError ?: RuntimeException("DB $operation failed after retries")
    }

    /**
     * Record attendance from QR scan. POST /api/attendance/scan. Validates payload (member or guest); no DB write for scan itself.
     * @param request Body: { "qrPayload": "..." } (JSON of MemberQRData or GuestQRData)
     * @return 200 { "message": "..." } | 400 { "message": "Invalid ..." }
     */
    @PostMapping("/api/attendance/scan")
    @Operation(summary = "Record attendance using a QR payload.")
    fun recordAttendance(@RequestBody request: QrScanRequest): ResponseEntity<Map<String, String>> {
        return try {
            val message = attendanceService.recordAttendance(request.qrPayload)
            ResponseEntity.ok(mapOf("message" to message))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("message" to e.message!!))
        }
    }

    /**
     * Get list of members (DB if available, else CSV fallback). GET /api/members. Side effect: DB read or CSV read.
     * @return { "members": [ { "id", "name", "domain", ... } ] }
     */
    @GetMapping("/api/members")
    @Operation(summary = "Get list of members with domain info and standing")
    fun getMembers(): Map<String, List<Map<String, Any>>> {
        val csvFallback: List<Map<String, Any>> = attendanceService.getMembersWithDomain()
            .mapIndexed { idx, m -> m + ("id" to (m["id"] ?: (idx + 1))) }
        return try {
            if (databaseMemberService != null) {
                try {
                    val dbMembers = withDbRetry("getMembers") { databaseMemberService.getAllMembers() }
                    if (dbMembers.isNotEmpty()) mapOf("members" to dbMembers)
                    else mapOf("members" to csvFallback)
                } catch (e: Exception) {
                    log.warn("DB getMembers failed ({}), using CSV fallback", e.message)
                    mapOf("members" to csvFallback)
                }
            } else {
                mapOf("members" to csvFallback)
            }
        } catch (e: Exception) {
            log.error("getMembers failed", e)
            mapOf("members" to csvFallback)
        }
    }

    /**
     * Get list of guests. GET /api/guests. Optional ?eventDate=YYYY-MM-DD: return only guests for that event (onsite support).
     * When eventDate is provided, only guests for that date are returned (DB or CSV filtered). When omitted, returns all guests.
     * Side effect: DB or CSV read.
     * @param eventDate Optional; when set, return only guests for this event date (e.g. latest event for check-in form).
     * @return { "guests": [ { "name", "profession", "referrer", "eventDate" } ] }
     */
    @GetMapping("/api/guests")
    @Operation(summary = "Get list of pre-registered guests with profession info")
    fun getGuests(@RequestParam(required = false) eventDate: String?): Map<String, List<Map<String, String>>> {
        val filterByDate = eventDate?.trim()?.takeIf { it.isNotEmpty() }

        return if (databaseMemberService != null) {
            try {
                val dbGuests = if (filterByDate != null) {
                    withDbRetry("getGuestsForEventDate") { databaseMemberService.getGuestsForEventDate(filterByDate) }
                } else {
                    withDbRetry("getGuests") { databaseMemberService.getAllGuests() }
                }
                if (dbGuests.isNotEmpty()) {
                    mapOf("guests" to dbGuests)
                } else if (filterByDate == null) {
                    mapOf("guests" to guestService.getAllGuestsWithDomain())
                } else {
                    val allCsv = guestService.getAllGuestsWithDomain()
                    val filtered = allCsv.filter { (it["eventDate"] as? String).orEmpty() == filterByDate }
                    mapOf("guests" to filtered)
                }
            } catch (e: Exception) {
                if (filterByDate != null) {
                    val allCsv = guestService.getAllGuestsWithDomain()
                    val filtered = allCsv.filter { (it["eventDate"] as? String).orEmpty() == filterByDate }
                    mapOf("guests" to filtered)
                } else {
                    mapOf("guests" to guestService.getAllGuestsWithDomain())
                }
            }
        } else {
            val allCsv = guestService.getAllGuestsWithDomain()
            val list = if (filterByDate != null) {
                allCsv.filter { (it["eventDate"] as? String).orEmpty() == filterByDate }
            } else allCsv
            mapOf("guests" to list)
        }
    }

    /**
     * Manual check-in. POST /api/checkin. In-memory always; member type also persisted to DB when [EventDbService] present.
     * Side effects: in-memory add; DB write for members; WebSocket broadcast (via service).
     * @param request name, type (member/guest/vip/speaker), currentTime, domain, role, tags, referrer
     * @return 200 { "status", "message" } | 400 duplicate or invalid type
     */
    @PostMapping("/api/checkin")
    @Operation(summary = "Record check-in (in-memory + DB for members)")
    fun checkIn(@RequestBody request: CheckInRequest): ResponseEntity<Map<String, String>> {
        return try {
            val message = attendanceService.recordCheckIn(request)

            // Also persist member check-ins to DB so they appear in /api/report
            if (request.type.equals("member", ignoreCase = true) && eventDbService != null) {
                try {
                    val activeEventDate = eventDbService.getCurrentEvent()?.date
                        ?: java.time.LocalDate.now(java.time.ZoneId.of("Asia/Hong_Kong")).toString()
                    val logReq = AttendanceLogRequest(
                        attendeeId = null,
                        attendeeType = "member",
                        attendeeName = request.name,
                        attendeeProfession = request.domain,
                        eventDate = activeEventDate,
                        checkedInAt = request.currentTime,
                        status = "on-time"
                    )
                    withDbRetry("checkIn-logAttendance") { eventDbService.logAttendance(logReq) }
                } catch (e: Exception) {
                    log.warn("DB persist for /api/checkin member '{}' failed: {}", request.name, e.message)
                }
            }

            // Persist guest check-ins to DB (bni_anchor_guests.check_in_time) so restart won't lose them.
            if (request.type.equals("guest", ignoreCase = true) && guestRepository != null) {
                try {
                    val eventDate = try {
                        eventDbService?.getCurrentEvent()?.date ?: attendanceService.getCurrentEvent()?.date
                    } catch (_: Exception) { null }
                    if (!eventDate.isNullOrBlank()) {
                        val guest = guestRepository.findByNameIgnoreCaseAndEventDate(request.name.trim(), eventDate).orElse(null)
                        if (guest != null) {
                            guest.checkInTime = parseClientTimeToHktOffset(request.currentTime)
                            guestRepository.save(guest)
                        }
                    }
                } catch (e: Exception) {
                    log.warn("DB persist for /api/checkin guest '{}' failed: {}", request.name, e.message)
                }
            }

            ResponseEntity.ok(mapOf("status" to "success", "message" to message))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf("status" to "error", "message" to e.message!!))
        }
    }

    /**
     * Get all check-in records: DB members (from report) + in-memory, merged and deduped by name. GET /api/records.
     * Side effect: DB read when [EventDbService] present.
     * @return { "records": [ CheckInRecord ] } sorted by timestamp desc
     */
    @GetMapping("/api/records")
    @Operation(summary = "Get all records (DB members + in-memory guests merged)")
    fun getRecords(): Map<String, List<CheckInRecord>> {
        val hkt = java.time.ZoneId.of("Asia/Hong_Kong")
        val hktFmt = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX")

        val normalizedInMemory = attendanceService.getAllRecords().map { r ->
            val hktTimestamp = try {
                java.time.ZonedDateTime.parse(r.timestamp).withZoneSameInstant(hkt).format(hktFmt)
            } catch (_: Exception) {
                try { java.time.Instant.parse(r.timestamp).atZone(hkt).format(hktFmt) }
                catch (_: Exception) { r.timestamp }
            }
            r.copy(timestamp = hktTimestamp, receivedAt = hktTimestamp)
        }

        val dbRecords = try {
            val reportData = eventDbService?.getReportData()
            if (reportData != null) {
                val allMembers = try {
                    databaseMemberService?.getAllMembers() ?: emptyList()
                } catch (_: Exception) { emptyList() }
                val memberDomainMap = allMembers.associate { (it["name"] as String) to (it["domain"] as? String ?: "") }
                val eventDate = reportData.eventDate

                reportData.attendees.filter { it.role == "MEMBER" }.map { att ->
                    val isoTimestamp = if (att.checkInTime != null && !att.checkInTime.contains("T"))
                        "${eventDate}T${att.checkInTime}+08:00" else (att.checkInTime ?: "")
                    CheckInRecord(
                        name = att.memberName,
                        domain = memberDomainMap[att.memberName] ?: "",
                        type = "member",
                        timestamp = isoTimestamp,
                        receivedAt = isoTimestamp,
                        role = "MEMBER"
                    )
                }
            } else emptyList()
        } catch (_: Exception) { emptyList<CheckInRecord>() }

        // Guest records from DB (persisted check-in time)
        val dbGuestRecords = try {
            val eventDate = eventDbService?.getCurrentEvent()?.date
            if (!eventDate.isNullOrBlank() && guestRepository != null) {
                guestRepository.findByEventDate(eventDate)
                    .filter { it.checkInTime != null }
                    .map { g ->
                        val isoTimestamp = g.checkInTime?.withOffsetSameInstant(hkt.rules.getOffset(java.time.Instant.now()))?.format(hktFmt) ?: ""
                        CheckInRecord(
                            name = g.name,
                            domain = g.profession,
                            type = "guest",
                            timestamp = isoTimestamp,
                            receivedAt = isoTimestamp,
                            role = "GUEST"
                        )
                    }
            } else emptyList()
        } catch (_: Exception) { emptyList<CheckInRecord>() }

        val inMemoryNames = normalizedInMemory.map { it.name.lowercase() }.toSet()
        val dedupedMembers = dbRecords.filter { it.name.lowercase() !in inMemoryNames }
        val dedupedGuests = dbGuestRecords.filter { it.name.lowercase() !in inMemoryNames }

        val merged = (dedupedMembers + dedupedGuests + normalizedInMemory).sortedByDescending { it.timestamp }
        return mapOf("records" to merged)
    }

    /** Clear all in-memory records. DELETE /api/records. Side effect: in-memory clear; WebSocket broadcast. */
    @DeleteMapping("/api/records")
    @Operation(summary = "Clear all records")
    fun clearRecords(): Map<String, String> {
        attendanceService.clearAllRecords()
        return mapOf("status" to "success", "message" to "All records cleared")
    }

    /**
     * Delete one record by index. DELETE /api/records/{index}. Side effect: in-memory remove; WebSocket broadcast.
     * @param index 0-based index in current records list
     * @return 200 | 404 if index out of bounds
     */
    @DeleteMapping("/api/records/{index}")
    @Operation(summary = "Delete a specific record by index")
    fun deleteRecord(@PathVariable index: Int): ResponseEntity<Map<String, String>> {
        return try {
            attendanceService.deleteRecord(index)
            ResponseEntity.ok(mapOf("status" to "success", "message" to "Record deleted"))
        } catch (e: IndexOutOfBoundsException) {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("status" to "error", "message" to "Record not found"))
        }
    }

    /**
     * Create event (DB if available, else in-memory). POST /api/events. All members initialized as absent.
     * Does NOT delete old events; existing events are kept. Latest event is used for attendance, guest list, CSV export.
     * Side effects: DB write or in-memory; WebSocket broadcast. Date YYYY-MM-DD; times HH:mm or HH:mm:ss.
     * @param request name, date, startTime, endTime, registrationStartTime, onTimeCutoff
     * @return 200 { "status", "message", "event" } | 400 invalid format | 500 on DB error
     */
    @PostMapping("/api/events")
    @Operation(summary = "Create event with time settings, initializes all members as absent")
    fun createEvent(@RequestBody request: EventRequest): ResponseEntity<Map<String, Any>> {
        return try {
            val eventData = if (eventDbService != null) {
                try {
                    val created = withDbRetry("createEvent") { eventDbService.createEvent(request) }
                    attendanceWebSocketHandler?.broadcast(
                        mapOf("type" to "event_created", "data" to created)
                    )
                    created
                } catch (dbEx: Exception) {
                    log.warn("DB createEvent failed ({}), falling back to in-memory", dbEx.message)
                    attendanceService.createEvent(request)
                }
            } else {
                attendanceService.createEvent(request)
            }
            ResponseEntity.ok(mapOf(
                "status" to "success",
                "message" to "Event created with all members set to absent",
                "event" to eventData
            ))
        } catch (e: java.time.format.DateTimeParseException) {
            val msg = "Invalid date or time format. Use date YYYY-MM-DD and times HH:mm or HH:mm:ss. ${e.message}"
            log.warn("Create event failed: {}", msg)
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf(
                "status" to "error",
                "message" to msg
            ))
        } catch (e: IllegalArgumentException) {
            log.warn("Create event failed: {}", e.message)
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(mapOf(
                "status" to "error",
                "message" to (e.message ?: "Invalid request"))
            )
        } catch (e: Exception) {
            log.error("Create event failed", e)
            ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf(
                "status" to "error",
                "message" to (e.message ?: "Event creation failed. Check server logs for details.")
            ))
        }
    }
    
    /**
     * Get report for current event: DB report merged with in-memory check-ins (guests + members not in DB). GET /api/report.
     * Side effect: DB read when [EventDbService] present.
     * @return 200 ReportData | 404 if no current event
     */
    @GetMapping("/api/report")
    @Operation(summary = "Get report data for an event (DB members + in-memory guests). Omit eventId for active/current event.")
    fun getReportData(@RequestParam(name = "eventId", required = false) eventId: Int?): ResponseEntity<ReportData> {
        val fromDb: ReportData? = try {
            if (eventDbService != null) {
                withDbRetry("getReportData") { eventDbService.getReportData(eventId) }
            } else null
        } catch (e: Exception) {
            log.warn("DB getReportData failed for eventId={}: {}", eventId, e.message, e)
            null
        }
        val fromMemory: ReportData? = if (eventDbService == null) {
            if (eventId != null) attendanceService.getReportDataForEventId(eventId) else attendanceService.getReportData()
        } else null
        val reportData = fromDb ?: fromMemory ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).build()
        return ResponseEntity.ok(mergeReportWithGuestsAndInMemory(reportData))
    }
    
    /** Get current event (DB or in-memory). GET /api/events/current. Side effect: DB read when present. @return 200 | 404 */
    @GetMapping("/api/events/current")
    @Operation(summary = "Get current event (DB only, no attendance data)")
    fun getCurrentEvent(): ResponseEntity<EventData> {
        val event = try {
            if (eventDbService != null) withDbRetry("getCurrentEvent") { eventDbService.getCurrentEvent() } else null
        } catch (e: Exception) {
            log.warn("DB getCurrentEvent failed: {}", e.message)
            null
        }
        return if (event != null) {
            ResponseEntity.ok(event)
        } else {
            ResponseEntity.status(HttpStatus.NOT_FOUND).build()
        }
    }

    @GetMapping("/api/events")
    @Operation(summary = "List events (latest first)")
    fun listEvents(): ResponseEntity<List<EventData>> {
        val events = try {
            if (eventDbService != null) withDbRetry("listEvents") { eventDbService.listEvents() } else emptyList()
        } catch (e: Exception) {
            log.warn("DB listEvents failed: {}", e.message)
            emptyList()
        }
        return ResponseEntity.ok(events)
    }

    @PostMapping("/api/events/{eventId}/activate")
    @Operation(summary = "Manually activate one event; optional exclusive mode")
    fun activateEvent(
        @PathVariable eventId: Int,
        @RequestBody(required = false) request: EventActiveRequest?
    ): ResponseEntity<Map<String, Any>> {
        val service = eventDbService ?: return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
            .body(mapOf("status" to "error", "message" to "DB mode required"))
        val exclusive = request?.exclusive ?: false
        val updated = try { withDbRetry("setEventActive") { service.setEventActive(eventId, exclusive) } }
        catch (e: Exception) {
            log.warn("activateEvent failed: {}", e.message)
            null
        }
        return if (updated != null) {
            attendanceWebSocketHandler?.broadcast(
                mapOf("type" to "current_event_changed", "event" to updated, "exclusive" to exclusive)
            )
            ResponseEntity.ok(mapOf("status" to "success", "event" to updated, "exclusive" to exclusive))
        } else {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("status" to "error", "message" to "Event not found"))
        }
    }

    @DeleteMapping("/api/events/{eventId}")
    @Operation(summary = "Soft delete an event; force=true cascades attendance delete")
    fun deleteEvent(
        @PathVariable eventId: Int,
        @RequestParam(required = false, defaultValue = "false") force: Boolean
    ): ResponseEntity<Map<String, String>> {
        val service = eventDbService ?: return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
            .body(mapOf("status" to "error", "message" to "DB mode required"))
        return try {
            val ok = withDbRetry("softDeleteEvent") { service.softDeleteEvent(eventId, force) }
            if (ok) {
                attendanceWebSocketHandler?.broadcast(mapOf("type" to "current_event_changed", "eventId" to eventId))
                ResponseEntity.ok(mapOf("status" to "success", "message" to "Event soft-deleted"))
            } else {
                ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("status" to "error", "message" to "Event not found"))
            }
        } catch (e: IllegalStateException) {
            ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf("status" to "error", "message" to (e.message ?: "Delete blocked")))
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(mapOf("status" to "error", "message" to (e.message ?: "Delete failed")))
        }
    }

    @GetMapping("/api/events/{eventId}")
    @Operation(summary = "Get event by id")
    fun getEventById(@PathVariable eventId: Int): ResponseEntity<EventData> {
        val repo = eventRepository ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).build()
        val ev = try { repo.findById(eventId.toLong()).orElse(null) } catch (_: Exception) { null }
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).build()

        return ResponseEntity.ok(
            EventData(
                id = ev.id!!.toInt(),
                name = ev.name,
                date = ev.eventDate.toString(),
                startTime = ev.startTime.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")),
                endTime = ev.endTime?.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")) ?: "09:00",
                registrationStartTime = ev.registrationStartTime.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")),
                onTimeCutoff = ev.onTimeCutoffTime.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")),
                createdAt = ev.createDate.toString()
            )
        )
    }
    
    /** Check if event exists for date. GET /api/events/check?date=YYYY-MM-DD. @return { "exists": true|false } */
    @GetMapping("/api/events/check")
    @Operation(summary = "Check if event exists for a given date")
    fun checkEventExists(@RequestParam date: String): Map<String, Any> {
        val exists = try {
            if (eventDbService != null) withDbRetry("checkEventExists") { eventDbService.hasEventForDate(date) } else null
        } catch (e: Exception) { null } ?: (attendanceService.getCurrentEvent()?.date == date)
        return mapOf("exists" to exists)
    }
    
    /** Check if event exists in current week (Mon–Sun). GET /api/events/check-this-week. @return { "exists": true|false } */
    @GetMapping("/api/events/check-this-week")
    @Operation(summary = "Check if event exists in the current week")
    fun checkEventThisWeek(): Map<String, Any> {
        val exists = try {
            if (eventDbService != null) withDbRetry("checkEventThisWeek") { eventDbService.hasEventThisWeek() } else null
        } catch (e: Exception) { null } ?: run {
            val memEvent = attendanceService.getCurrentEvent()
            if (memEvent != null) {
                val eventDate = java.time.LocalDate.parse(memEvent.date)
                val today = java.time.LocalDate.now()
                val weekStart = today.with(java.time.DayOfWeek.MONDAY)
                val weekEnd = today.with(java.time.DayOfWeek.SUNDAY)
                !eventDate.isBefore(weekStart) && !eventDate.isAfter(weekEnd)
            } else false
        }
        return mapOf("exists" to exists)
    }
    
    /** Get event for date (DB then in-memory). GET /api/events/for-date?date=YYYY-MM-DD. @return 200 { "id", "name" } | 404 */
    @GetMapping("/api/events/for-date")
    @Operation(summary = "Get event details for a specific date")
    fun getEventForDate(@RequestParam date: String): ResponseEntity<Map<String, Any>> {
        val dbEvent = try {
            if (eventDbService != null) withDbRetry("getEventForDate") { eventDbService.getEventForDate(date) } else null
        } catch (e: Exception) { null }
        if (dbEvent != null) {
            return ResponseEntity.ok(mapOf("id" to dbEvent.id, "name" to dbEvent.name))
        }
        // Fallback: check in-memory
        val memEvent = attendanceService.getCurrentEvent()
        return if (memEvent != null && memEvent.date == date) {
            ResponseEntity.ok(mapOf("id" to memEvent.id, "name" to memEvent.name))
        } else {
            ResponseEntity.status(HttpStatus.NOT_FOUND).build()
        }
    }
    
    /**
     * Log attendance directly. POST /api/attendance/log. Members → DB (or in-memory fallback); guests → in-memory.
     * Side effects: DB write for members when [EventDbService] present; in-memory add for guests/fallback.
     * @return 200 | 409 already checked in | 500 on failure
     */
    @PostMapping("/api/attendance/log")
    @Operation(summary = "Log attendance record directly")
    fun logAttendance(@RequestBody request: AttendanceLogRequest): ResponseEntity<Map<String, String>> {
        val isGuestType = request.attendeeType.lowercase() in listOf("guest", "vip", "speaker")

        // Members → DB (bni_anchor_attendances uses member_id FK)
        if (!isGuestType) {
            val dbError: Exception? = try {
                if (eventDbService != null) withDbRetry("logAttendance") { eventDbService.logAttendance(request) }
                null
            } catch (e: Exception) {
                log.warn("DB logAttendance failed ({}), falling back to in-memory", e.message)
                e
            }
            if (dbError == null) {
                attendanceWebSocketHandler?.broadcast(mapOf("type" to "attendance_updated"))
                return ResponseEntity.ok(mapOf("status" to "success", "message" to "Attendance logged successfully"))
            }
        }

        // Guests / fallback → in-memory (so they appear in report via getAllRecords)
        return try {
            val normalizedType = if (request.attendeeType.lowercase() in listOf("vip", "speaker")) "guest" else request.attendeeType
            val role = when (request.attendeeType.lowercase()) {
                "vip" -> "VIP"
                "speaker" -> "SPEAKER"
                "guest" -> "GUEST"
                else -> "MEMBER"
            }
            val fallbackRequest = CheckInRequest(
                name = request.attendeeName,
                type = normalizedType,
                currentTime = request.checkedInAt,
                domain = request.attendeeProfession ?: "",
                role = role
            )
            attendanceService.recordCheckIn(fallbackRequest)
            ResponseEntity.ok(mapOf("status" to "success", "message" to "Attendance logged"))
        } catch (e2: Exception) {
            if (e2.message?.contains("已經簽到") == true) {
                ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(mapOf("status" to "already_checked", "message" to (e2.message ?: "Already checked in")))
            } else {
                log.error("In-memory logAttendance also failed", e2)
                ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(mapOf("status" to "error", "message" to (e2.message ?: "Failed to log attendance")))
            }
        }
    }
    
    /** Clear all events and attendance (DB when present, then in-memory). DELETE /api/events/clear-all. Side effect: DB + memory clear. */
    @DeleteMapping("/api/events/clear-all")
    @Operation(summary = "Clear all events and attendance records")
    fun clearAllEventsAndAttendance(): Map<String, String> {
        try {
            if (eventDbService != null) withDbRetry("clearAllEventsAndAttendance") { eventDbService.clearAllEventsAndAttendance() }
        } catch (e: Exception) {
            log.warn("DB clearAllEventsAndAttendance failed: {}", e.message)
        }
        attendanceService.clearAllEventsAndAttendance()
        return mapOf("status" to "success", "message" to "All events and attendance records cleared")
    }

    /**
     * Export current event report as CSV (UTF-8 BOM). GET /api/export. Members + absent + guests. After export, batch upsert to DB.
     * Side effects: DB read for report/members/guests; optional batch upsert to [EventDbService].
     * @return 200 CSV body, Content-Disposition: attachment; filename=attendance.csv
     */
    @GetMapping("/api/export")
    @Operation(summary = "Export records as CSV with attendance status (current event, all 47 members including absent)")
    fun exportRecords(@RequestParam(name = "eventId", required = false) eventId: Int?): ResponseEntity<ByteArray> {
        val out = ByteArrayOutputStream()
        // Add UTF-8 BOM for Excel compatibility
        out.write(byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()))
        val writer = PrintWriter(out)
        writer.println("姓名,專業領域,類別,出席狀態,簽到時間")

        // Same attendee list as GET /api/report (DB members + persisted guests + in-memory for event date)
        val rawReport = try {
            eventDbService?.getReportData(eventId)
        } catch (e: Exception) {
            log.warn("DB getReportData failed ({}), using in-memory", e.message)
            null
        } ?: if (eventDbService == null && eventId != null) {
            attendanceService.getReportDataForEventId(eventId)
        } else {
            attendanceService.getReportData()
        }

        val reportData = rawReport?.let { mergeReportWithGuestsAndInMemory(it) }

        val records = attendanceService.getAllRecords()

        if (reportData != null) {
            // Members: prefer DB (47 from bni_anchor_members), fallback to CSV
            val membersWithDomain = try {
                databaseMemberService?.getAllMembers()?.map { m ->
                    mapOf("name" to (m["name"] as String), "domain" to (m["domain"] as? String ?: ""))
                } ?: attendanceService.getMembersWithDomain()
            } catch (_: Exception) {
                attendanceService.getMembersWithDomain()
            }
            val memberDomainMap = membersWithDomain.associate { (it["name"] as String) to (it["domain"] as? String ?: "") }

            // Export all members who attended (from reportData.attendees where role=MEMBER)
            for (attendee in reportData.attendees) {
                if (attendee.role != "MEMBER") continue
                val domain = (memberDomainMap[attendee.memberName] ?: "").replace(",", "，")
                val statusText = when (attendee.status) {
                    "on-time" -> "準時"
                    "late" -> "遲到"
                    "late_with_code" -> "遲到(有代碼)"
                    else -> attendee.status
                }
                writer.println("${attendee.memberName},${domain},member,${statusText},${formatCsvCheckInTime(attendee.checkInTime)}")
            }

            // Export all absent members (HARD RULE: include remaining absent members)
            for (absentee in reportData.absentees) {
                val domain = (memberDomainMap[absentee.memberName] ?: "").replace(",", "，")
                writer.println("${absentee.memberName},${domain},member,缺席,")
            }

            // Export guests with profession (prefer DB bni_anchor_guests, fallback to CSV/in-memory)
            val guestDomainMap = try {
                databaseMemberService?.getAllGuests()
                    ?.associate { g -> (g["name"] ?: "") to (g["profession"] ?: "") }
                    ?.filterKeys { it.isNotBlank() }
                    ?: guestService.getAllGuestsWithDomain().associate {
                        (it["name"] as String) to (it["profession"] as? String ?: "")
                    }
            } catch (_: Exception) {
                guestService.getAllGuestsWithDomain().associate {
                    (it["name"] as String) to (it["profession"] as? String ?: "")
                }
            }

            // Track which guest names have been exported as "arrived"
            val exportedGuestNames = mutableSetOf<String>()
            for (attendee in reportData.attendees) {
                if (attendee.role !in listOf("GUEST", "VIP", "SPEAKER")) continue
                val domain = (guestDomainMap[attendee.memberName] ?: "").replace(",", "，")
                val roleLabel = attendee.role.lowercase()
                val statusText = when (attendee.status) {
                    "on-time" -> "準時"
                    "late" -> "遲到"
                    else -> attendee.status
                }
                writer.println("${attendee.memberName},${domain},${roleLabel},${statusText},${formatCsvCheckInTime(attendee.checkInTime)}")
                exportedGuestNames.add(attendee.memberName)
            }
            // If DB report has no guest records, fallback to in-memory check-in records
            if (reportData.attendees.none { it.role in listOf("GUEST", "VIP", "SPEAKER") }) {
                for (guest in records.filter {
                    it.type.equals("guest", ignoreCase = true) &&
                        isTimestampOnEventDate(it.timestamp, reportData.eventDate)
                }) {
                    val domain = guest.domain.replace(",", "，")
                    val roleLabel = guest.role.lowercase().ifEmpty { "guest" }
                    val guestStatus = determineGuestStatus(guest.timestamp, reportData.onTimeCutoff)
                    val hktTime = toHktLocalTime(guest.timestamp)?.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss")) ?: guest.timestamp
                    writer.println("${guest.name},${domain},${roleLabel},${guestStatus},${formatCsvCheckInTime(hktTime)}")
                    exportedGuestNames.add(guest.name)
                }
            }

            // Also include ALL guests registered for this event date, even if they did not check in (mark as absent).
            // This matches "嘉賓名單 + 出席狀態" expectation for onsite support.
            val allGuestsForEvent = try {
                databaseMemberService?.getGuestsForEventDate(reportData.eventDate) ?: emptyList()
            } catch (_: Exception) {
                emptyList()
            }
            for (g in allGuestsForEvent) {
                val guestName = (g["name"] ?: "").trim()
                if (guestName.isBlank() || exportedGuestNames.contains(guestName)) continue
                val domain = ((g["profession"] ?: "") as String).replace(",", "，")
                writer.println("${guestName},${domain},guest,缺席,")
            }
        } else {
            // Fallback: export raw records if no event exists
            for (record in records) {
                val domain = record.domain.replace(",", "，")
                val t = toHktLocalTime(record.timestamp)?.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss")) ?: record.timestamp
                writer.println("${record.name},${domain},${record.type},已簽到,${formatCsvCheckInTime(t)}")
            }
        }

        writer.flush()
        writer.close()

        // After successful CSV export: take batch records (reportData + records),
        // insert/upsert into bni_anchor_attendances via EventDbService (AttendanceRepository).
        try {
            if (eventDbService != null) {
                withDbRetry("batchUpsertCurrentEventAttendancesForExport") {
                    eventDbService.batchUpsertCurrentEventAttendancesForExport(reportData, records)
                }
            }
        } catch (e: Exception) {
            log.warn("Post-export attendance batch upsert failed: {}", e.message)
        }

        val yyyymmdd = try {
            (reportData?.eventDate ?: java.time.LocalDate.now().toString()).replace("-", "")
        } catch (_: Exception) {
            java.time.LocalDate.now().toString().replace("-", "")
        }
        val filename = "attendance_${yyyymmdd}.csv"

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=${filename}")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(out.toByteArray())
    }
    
    /** Parse timestamp to HKT LocalTime (ZonedDateTime, Instant, or HH:mm:ss regex). No side effects. */
    private fun toHktLocalTime(timestamp: String): java.time.LocalTime? {
        val hkt = java.time.ZoneId.of("Asia/Hong_Kong")
        return try {
            java.time.ZonedDateTime.parse(timestamp).withZoneSameInstant(hkt).toLocalTime()
        } catch (_: Exception) {
            try {
                java.time.Instant.parse(timestamp).atZone(hkt).toLocalTime()
            } catch (_: Exception) {
                val m = Regex("(\\d{2}:\\d{2}:\\d{2})").find(timestamp)
                if (m != null) java.time.LocalTime.parse(m.groupValues[1]) else null
            }
        }
    }

    /** Check if a timestamp belongs to eventDate in HKT. */
    private fun isTimestampOnEventDate(timestamp: String, eventDate: String): Boolean {
        val hkt = java.time.ZoneId.of("Asia/Hong_Kong")
        val target = try { java.time.LocalDate.parse(eventDate) } catch (_: Exception) { return true }
        return try {
            java.time.ZonedDateTime.parse(timestamp).withZoneSameInstant(hkt).toLocalDate() == target
        } catch (_: Exception) {
            try {
                java.time.Instant.parse(timestamp).atZone(hkt).toLocalDate() == target
            } catch (_: Exception) {
                // For plain HH:mm[:ss] fallback, treat as event date.
                true
            }
        }
    }

    /** Classify guest status as 準時 or 遲到 from timestamp and onTimeCutoff. Returns "已簽到" on parse error. */
    private fun determineGuestStatus(timestamp: String, onTimeCutoff: String): String {
        return try {
            val cutoffTime = java.time.LocalTime.parse(onTimeCutoff)
            val checkInTime = toHktLocalTime(timestamp) ?: return "已簽到"
            if (checkInTime.isBefore(cutoffTime)) "準時" else "遲到"
        } catch (e: Exception) {
            "已簽到"
        }
    }

    /** Search member attendance history by name (case-insensitive partial). GET /api/attendance/member?name= */
    @GetMapping("/api/attendance/member")
    @Operation(summary = "Fetch attendance history for a specific member.")
    fun searchMemberAttendance(@RequestParam name: String): List<MemberAttendance> {
        return attendanceService.searchMemberAttendance(name)
    }

    /** Get attendance roster for event date. GET /api/attendance/event?date=YYYY-MM-DD. In-memory only. */
    @GetMapping("/api/attendance/event")
    @Operation(summary = "Get attendance roster for a given event date.")
    fun searchEventAttendance(@RequestParam date: String): List<EventAttendance> {
        return attendanceService.searchEventAttendance(date)
    }
    
    // ===== AI Insights Endpoints (Phase 2 - For Future AI Integration) =====
    
    /** Generate AI insights for event. POST /api/insights/generate. Uses [AttendanceService] + DeepSeek for retention. Side effect: AI API call; cache write. */
    @PostMapping("/api/insights/generate")
    @Operation(summary = "Generate AI insights report for an event (stub for future AI integration)")
    fun generateAIInsights(@RequestBody request: AIInsightRequest): ResponseEntity<AIInsightResponse> {
        val insights = attendanceService.generateInsights(request)
        return ResponseEntity.ok(insights)
    }
    
    /** Get cached AI insights for event. GET /api/insights/{eventId}. No side effects. */
    @GetMapping("/api/insights/{eventId}")
    @Operation(summary = "Get previously generated AI insights for an event")
    fun getEventInsights(@PathVariable eventId: Int): ResponseEntity<List<AIInsightResponse>> {
        val insights = attendanceService.getEventInsights(eventId)
        return if (insights.isNotEmpty()) {
            ResponseEntity.ok(insights)
        } else {
            ResponseEntity.ok(emptyList())
        }
    }
    
    /** Export event data for AI (attendance records + summary). GET /api/insights/data-export/{eventId}. @return 200 | 404 */
    @GetMapping("/api/insights/data-export/{eventId}")
    @Operation(summary = "Export event data in AI-ready format for external processing")
    fun exportAIReadyData(@PathVariable eventId: Int): ResponseEntity<Map<String, Any>> {
        val exportData = attendanceService.exportAIReadyData(eventId)
        return if (exportData != null) {
            ResponseEntity.ok(exportData)
        } else {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "Event not found"))
        }
    }
}
