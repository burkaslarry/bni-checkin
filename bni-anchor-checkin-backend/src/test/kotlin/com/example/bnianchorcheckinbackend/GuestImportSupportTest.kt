package com.example.bnianchorcheckinbackend

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class GuestImportSupportTest {

    @Test
    fun `sanitizeGuestPhone treats template placeholder as null`() {
        assertNull(GuestImportSupport.sanitizeGuestPhone("12345678"))
        assertNull(GuestImportSupport.sanitizeGuestPhone(""))
        assertEquals("61234567", GuestImportSupport.sanitizeGuestPhone("61234567"))
    }

    @Test
    fun `normalizeEventDate accepts YYYYMMDD`() {
        assertEquals("2026-05-28", GuestImportSupport.normalizeEventDate("20260528"))
        assertEquals("2026-05-28", GuestImportSupport.normalizeEventDate("2026-05-28"))
    }
}
