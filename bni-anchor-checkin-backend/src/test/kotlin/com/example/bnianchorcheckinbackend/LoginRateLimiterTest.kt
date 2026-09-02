package com.example.bnianchorcheckinbackend

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class LoginRateLimiterTest {

    @Test
    fun `clientIp prefers first X-Forwarded-For hop`() {
        assertEquals("1.2.3.4", LoginRateLimiter.clientIp("1.2.3.4, 10.0.0.1", "127.0.0.1"))
        assertEquals("127.0.0.1", LoginRateLimiter.clientIp(null, "127.0.0.1"))
    }

    @Test
    fun `allows a burst then blocks the same ip`() {
        val ip = "203.0.113.${System.nanoTime() % 1000}"
        repeat(5) { assertTrue(LoginRateLimiter.allow(ip)) }
        assertFalse(LoginRateLimiter.allow(ip))
    }
}
