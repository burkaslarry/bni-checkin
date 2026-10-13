package com.example.bnianchorcheckinbackend

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class AttendanceEmailSettingsServiceTest {
    @Test
    fun `normalizes and deduplicates up to three recipients`() {
        assertEquals(
            listOf("Raymondkuo88@gmail.com", "TEAM@example.com"),
            AttendanceEmailSettingsService.normalizeRecipients(
                listOf(" Raymondkuo88@gmail.com ", "TEAM@example.com", "team@example.com")
            )
        )
    }

    @Test
    fun `rejects more than three recipients`() {
        assertThrows(IllegalArgumentException::class.java) {
            AttendanceEmailSettingsService.normalizeRecipients(
                listOf("a@example.com", "b@example.com", "c@example.com", "d@example.com")
            )
        }
    }
}
