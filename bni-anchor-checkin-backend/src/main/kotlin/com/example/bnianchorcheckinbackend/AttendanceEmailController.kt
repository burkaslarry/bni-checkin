package com.example.bnianchorcheckinbackend

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * Admin endpoints to manually trigger attendance CSV email (Resend).
 * Background cron lives in [EventAttendanceEmailScheduler].
 */
@RestController
@Tag(name = "Attendance Email", description = "Send attendance CSV via Resend after event end / admin test")
@ConditionalOnProperty(name = ["spring.datasource.url"])
class AttendanceEmailController(
    private val eventAttendanceEmailService: EventAttendanceEmailService
) {
    private val log = org.slf4j.LoggerFactory.getLogger(javaClass)

    @PostMapping("/api/events/{eventId}/send-attendance-email")
    @Operation(summary = "Email attendance CSV for an event (admin test / manual send)")
    fun sendAttendanceEmail(
        @PathVariable eventId: Int,
        @RequestParam(name = "force", defaultValue = "false") force: Boolean
    ): ResponseEntity<Map<String, Any?>> {
        return try {
            val result = eventAttendanceEmailService.sendAttendanceEmail(
                eventId = eventId,
                force = force,
                markSent = true
            )
            val status = if (result.status == "success") HttpStatus.OK else HttpStatus.OK
            ResponseEntity.status(status).body(
                mapOf(
                    "status" to result.status,
                    "message" to result.message,
                    "eventId" to result.eventId,
                    "eventName" to result.eventName,
                    "eventDate" to result.eventDate,
                    "filename" to result.filename,
                    "rowCount" to result.rowCount,
                    "recipient" to result.recipient
                )
            )
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                mapOf("status" to "error", "message" to (e.message ?: "Event not found"))
            )
        } catch (e: IllegalStateException) {
            log.warn("Attendance email not ready: {}", e.message)
            ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                mapOf("status" to "error", "message" to (e.message ?: "Email service not configured"))
            )
        } catch (e: Exception) {
            log.error("Attendance email failed for eventId={}: {}", eventId, e.message)
            ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(
                mapOf("status" to "error", "message" to (e.message ?: "Failed to send email"))
            )
        }
    }

    @DeleteMapping("/api/events/{eventId}/attendance-email")
    @Operation(summary = "Reset attendance email sent flag so the event can be emailed again by cron or manual send")
    fun resetAttendanceEmail(@PathVariable eventId: Int): ResponseEntity<Map<String, Any?>> {
        return try {
            val result = eventAttendanceEmailService.resetAttendanceEmailSent(eventId)
            ResponseEntity.ok(
                mapOf(
                    "status" to result.status,
                    "message" to result.message,
                    "eventId" to result.eventId,
                    "eventName" to result.eventName,
                    "eventDate" to result.eventDate
                )
            )
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                mapOf("status" to "error", "message" to (e.message ?: "Event not found"))
            )
        } catch (e: Exception) {
            log.error("Reset attendance email failed for eventId={}: {}", eventId, e.message)
            ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                mapOf("status" to "error", "message" to (e.message ?: "Reset failed"))
            )
        }
    }
}
