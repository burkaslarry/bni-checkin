package com.example.bnianchorcheckinbackend

import jakarta.annotation.PostConstruct
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

data class AttendanceEmailSettings(val recipients: List<String>)

/**
 * [F012][S1201] Persists up to three attendance CSV recipients per chapter.
 * The settings table is created idempotently so a deploy cannot start with code ahead of its schema.
 */
@Service
@ConditionalOnProperty(name = ["spring.datasource.url"])
class AttendanceEmailSettingsService(
    private val jdbcTemplate: JdbcTemplate,
    @Value("\${attendance.email.to:Raymondkuo88@gmail.com}") private val defaultRecipients: String
) {
    @PostConstruct
    fun ensureTable() {
        jdbcTemplate.execute(
            """
            CREATE TABLE IF NOT EXISTS bni_eventxp_chapter_email_settings (
                chapter_id INTEGER PRIMARY KEY REFERENCES bni_eventxp_chapters(id) ON DELETE CASCADE,
                attendance_email_recipients TEXT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """.trimIndent()
        )
    }

    fun getSettings(chapterId: Int): AttendanceEmailSettings {
        val stored = jdbcTemplate.query(
            "SELECT attendance_email_recipients FROM bni_eventxp_chapter_email_settings WHERE chapter_id = ?",
            { rs, _ -> rs.getString(1) },
            chapterId
        ).firstOrNull()
        return AttendanceEmailSettings(normalizeRecipients(stored ?: defaultRecipients))
    }

    @Transactional
    fun updateSettings(chapterId: Int, recipients: List<String>): AttendanceEmailSettings {
        val normalized = normalizeRecipients(recipients)
        jdbcTemplate.update(
            """
            INSERT INTO bni_eventxp_chapter_email_settings (chapter_id, attendance_email_recipients, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (chapter_id) DO UPDATE SET
                attendance_email_recipients = EXCLUDED.attendance_email_recipients,
                updated_at = CURRENT_TIMESTAMP
            """.trimIndent(),
            chapterId,
            normalized.joinToString(",")
        )
        return AttendanceEmailSettings(normalized)
    }

    companion object {
        private val EMAIL = Regex("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$", RegexOption.IGNORE_CASE)

        fun normalizeRecipients(raw: String): List<String> = normalizeRecipients(raw.split(","))

        fun normalizeRecipients(raw: List<String>): List<String> {
            val recipients = raw.map { it.trim() }.filter { it.isNotEmpty() }.distinctBy { it.lowercase() }
            require(recipients.isNotEmpty()) { "At least one attendance email recipient is required" }
            require(recipients.size <= 3) { "A maximum of 3 attendance email recipients is allowed" }
            require(recipients.all { EMAIL.matches(it) }) { "Invalid attendance email recipient" }
            return recipients
        }
    }
}
