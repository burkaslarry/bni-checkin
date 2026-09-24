package com.example.bnianchorcheckinbackend

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class GuestLtTermTest {
    @Test
    fun `dates before October 2026 are term 2`() {
        assertEquals(2, GuestLtTerm.number("2026-03-12"))
        assertEquals(2, GuestLtTerm.number("2026-09-30"))
    }

    @Test
    fun `October 2026 through March 2027 is term 3`() {
        assertEquals(3, GuestLtTerm.number("2026-10-01"))
        assertEquals(3, GuestLtTerm.number("2027-03-31"))
    }

    @Test
    fun `term advances every six months after March 2027`() {
        assertEquals(4, GuestLtTerm.number("2027-04-01"))
        assertEquals(5, GuestLtTerm.number("2027-10-01"))
    }

    @Test
    fun `missing date has no term`() {
        assertNull(GuestLtTerm.number(null))
        assertNull(GuestLtTerm.number(""))
    }
}
