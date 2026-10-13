package com.example.bnianchorcheckinbackend

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.LocalDate
import java.time.ZoneId

/**
 * Background poller: at or after the configured send time, email attendance CSV via Resend.
 * It also creates the chapter's next weekly meeting and sets it as the current event.
 */
@Component
@ConditionalOnProperty(name = ["spring.datasource.url"])
class EventAttendanceEmailScheduler(
    private val emailService: EventAttendanceEmailService,
    @Value("\${attendance.email.enabled:true}") private val enabled: Boolean
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val hkt = ZoneId.of("Asia/Hong_Kong")

    /**
     * Poll every `attendance.email.poll-ms` (default 5 min).
     * After a successful send, the email service also creates next week's meeting.
     */
    @Scheduled(fixedDelayString = "\${attendance.email.poll-ms:300000}", initialDelayString = "60000")
    fun pollFinishedEvents() {
        if (!enabled) return
        // Keep email delivery isolated from meeting maintenance. A failure in either job must not
        // prevent the other job from running during this poll cycle.
        if (emailService.isReady()) {
            try {
                val sent = emailService.processDueEvents()
                if (sent > 0) log.info("Attendance email scheduler sent {} email(s)", sent)
            } catch (e: Exception) {
                log.error("Attendance email scheduler failed while sending due CSV files", e)
            }
        }

        try {
            // Independent of Resend: open the next meeting once it is within 7 days
            // (Anchor 24 Sep / 1 Oct blackout → create 8 Oct on 1 Oct).
            // Pass the date explicitly because Kotlin default arguments are evaluated against the
            // Spring proxy, whose private service fields are not guaranteed to be initialized.
            emailService.ensureUpcomingMeetings(LocalDate.now(hkt))
        } catch (e: Exception) {
            log.error("Attendance email scheduler failed while ensuring upcoming meetings", e)
        }
    }
}
