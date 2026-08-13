package com.example.bnianchorcheckinbackend

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * Background poller: after an event end time (+ grace), silently email attendance CSV via Resend,
 * then create the chapter's next weekly meeting and set it as the current event.
 */
@Component
@ConditionalOnProperty(name = ["spring.datasource.url"])
class EventAttendanceEmailScheduler(
    private val emailService: EventAttendanceEmailService,
    @Value("\${attendance.email.enabled:true}") private val enabled: Boolean
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(fixedDelayString = "\${attendance.email.poll-ms:300000}", initialDelayString = "60000")
    fun pollFinishedEvents() {
        if (!enabled) return
        if (!emailService.isReady()) return
        try {
            val sent = emailService.processDueEvents()
            if (sent > 0) {
                log.info("Attendance email scheduler sent {} email(s)", sent)
            }
        } catch (e: Exception) {
            log.error("Attendance email scheduler failed: {}", e.message)
        }
    }
}
