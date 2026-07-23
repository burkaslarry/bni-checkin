package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.repositories.EventRepository
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

data class AttendanceEmailResult(
    val status: String,
    val message: String,
    val eventId: Int,
    val eventName: String,
    val eventDate: String,
    val filename: String? = null,
    val rowCount: Int? = null,
    val recipient: String? = null
)

/**
 * Builds attendance CSV and emails it via Resend after an event ends (or on admin test).
 */
@Service
@ConditionalOnProperty(name = ["spring.datasource.url"])
class EventAttendanceEmailService(
    private val eventRepository: EventRepository,
    private val csvExportService: AttendanceCsvExportService,
    private val resendEmailService: ResendEmailService,
    @Value("\${attendance.email.from:EventXP <info@innovatexp.co>}") private val fromAddress: String,
    @Value("\${attendance.email.to:lo.wailun5@gmail.com}") private val toAddress: String,
    @Value("\${attendance.email.grace-minutes:5}") private val graceMinutes: Long,
    /** Only auto-email events that ended within this lookback window (avoids flooding old history). */
    @Value("\${attendance.email.lookback-hours:12}") private val lookbackHours: Long
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val hkt: ZoneId = ZoneId.of("Asia/Hong_Kong")

    fun isReady(): Boolean = resendEmailService.isConfigured()

    /**
     * Find ACTIVE events whose end time (+ grace) has passed, that have not been emailed yet,
     * and that ended within [lookbackHours] (so historical events are never bulk-emailed).
     */
    fun findEventsDueForAttendanceEmail(now: ZonedDateTime = ZonedDateTime.now(hkt)): List<com.example.bnianchorcheckinbackend.entities.Event> {
        val lookbackStart = now.minusHours(lookbackHours)
        val candidates = eventRepository.findAllByStatusAndDeletedAtIsNullOrderByEventDateAscStartTimeAsc("ACTIVE")
        return candidates.filter { event ->
            if (event.attendanceEmailSentAt != null) return@filter false
            val id = event.id ?: return@filter false
            val endBase = event.endTime ?: event.startTime.plusHours(2)
            val endDate = if (!endBase.isAfter(event.startTime)) event.eventDate.plusDays(1) else event.eventDate
            val endAt = ZonedDateTime.of(endDate, endBase, hkt)
            val dueAt = endAt.plusMinutes(graceMinutes)
            // Ended recently enough, and past grace window
            !endAt.isBefore(lookbackStart) && !now.isBefore(dueAt) && id > 0
        }
    }

    /**
     * Send attendance CSV for [eventId].
     * @param force when true, send even if already emailed (admin test)
     * @param markSent when true, set attendance_email_sent_at after success
     */
    @Transactional
    fun sendAttendanceEmail(
        eventId: Int,
        force: Boolean = false,
        markSent: Boolean = true
    ): AttendanceEmailResult {
        if (!resendEmailService.isConfigured()) {
            throw IllegalStateException("RESEND_API_KEY is not configured on the server")
        }
        val event = eventRepository.findById(eventId.toLong()).orElse(null)
            ?: throw IllegalArgumentException("Event not found: $eventId")
        if (event.deletedAt != null) {
            throw IllegalArgumentException("Event is deleted: $eventId")
        }
        if (!force && event.attendanceEmailSentAt != null) {
            return AttendanceEmailResult(
                status = "skipped",
                message = "Attendance email already sent at ${event.attendanceEmailSentAt}",
                eventId = eventId,
                eventName = event.name,
                eventDate = event.eventDate.toString()
            )
        }

        val csv = csvExportService.buildCsvForEvent(eventId)
        val recipients = toAddress.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        val subject = "EventXP 出席記錄 — ${csv.eventName} (${csv.eventDate})"
        val body = buildString {
            appendLine("活動已結束，附件為出席記錄 CSV。")
            appendLine()
            appendLine("活動名稱：${csv.eventName}")
            appendLine("活動日期：${csv.eventDate}")
            appendLine("記錄列數：${csv.rowCount}")
            appendLine("寄出時間（HKT）：${ZonedDateTime.now(hkt).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))}")
            appendLine()
            appendLine("此為系統自動寄送（EventXP）。")
        }

        resendEmailService.sendEmail(
            from = fromAddress,
            to = recipients,
            subject = subject,
            textBody = body,
            attachments = listOf(
                ResendEmailService.Attachment(
                    filename = csv.filename,
                    bytes = csv.bytes,
                    contentType = "text/csv"
                )
            )
        )

        if (markSent) {
            event.attendanceEmailSentAt = OffsetDateTime.now(hkt)
            eventRepository.save(event)
        }

        log.info(
            "Attendance email sent for eventId={} date={} rows={} to={}",
            eventId, csv.eventDate, csv.rowCount, recipients.joinToString(",")
        )

        return AttendanceEmailResult(
            status = "success",
            message = "Attendance CSV emailed successfully",
            eventId = eventId,
            eventName = csv.eventName,
            eventDate = csv.eventDate,
            filename = csv.filename,
            rowCount = csv.rowCount,
            recipient = recipients.joinToString(",")
        )
    }

    /**
     * Clear [Event.attendanceEmailSentAt] so cron / manual send can treat the event as not yet emailed.
     */
    @Transactional
    fun resetAttendanceEmailSent(eventId: Int): AttendanceEmailResult {
        val event = eventRepository.findById(eventId.toLong()).orElse(null)
            ?: throw IllegalArgumentException("Event not found: $eventId")
        if (event.deletedAt != null) {
            throw IllegalArgumentException("Event is deleted: $eventId")
        }
        val previous = event.attendanceEmailSentAt?.toString()
        event.attendanceEmailSentAt = null
        eventRepository.save(event)
        return AttendanceEmailResult(
            status = "success",
            message = if (previous != null) {
                "Attendance email status reset (was sent at $previous)"
            } else {
                "Attendance email status was already clear"
            },
            eventId = eventId,
            eventName = event.name,
            eventDate = event.eventDate.toString()
        )
    }

    /** Process all due events; returns count of successful sends. */
    fun processDueEvents(): Int {
        if (!isReady()) {
            log.debug("Skipping attendance email poll — RESEND_API_KEY not set")
            return 0
        }
        var sent = 0
        for (event in findEventsDueForAttendanceEmail()) {
            val id = event.id?.toInt() ?: continue
            try {
                val result = sendAttendanceEmail(eventId = id, force = false, markSent = true)
                if (result.status == "success") sent++
            } catch (e: Exception) {
                log.error("Failed to email attendance for eventId={}: {}", id, e.message)
            }
        }
        return sent
    }
}
