package com.example.bnianchorcheckinbackend

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class ApiAccessPolicyTest {

    @Test
    fun `kiosk and public guest routes stay open`() {
        assertTrue(ApiAccessPolicy.isPublic("GET", "/health"))
        assertTrue(ApiAccessPolicy.isPublic("GET", "/api/members"))
        assertTrue(ApiAccessPolicy.isPublic("GET", "/api/events/current"))
        assertTrue(ApiAccessPolicy.isPublic("GET", "/api/events/52"))
        assertTrue(ApiAccessPolicy.isPublic("POST", "/api/checkin"))
        assertTrue(ApiAccessPolicy.isPublic("POST", "/api/attendance/scan"))
        assertTrue(ApiAccessPolicy.isPublic("POST", "/api/attendance/log"))
        assertTrue(ApiAccessPolicy.isPublic("GET", "/api/public/captcha"))
        assertTrue(ApiAccessPolicy.isPublic("POST", "/api/public/guests"))
        assertTrue(ApiAccessPolicy.isPublic("POST", "/api/client/login"))
        assertTrue(ApiAccessPolicy.isPublic("OPTIONS", "/api/events"))
        assertTrue(ApiAccessPolicy.isPublic("POST", "/api/matching/quick"))
        assertTrue(ApiAccessPolicy.isPublic("GET", "/ws/records"))
    }

    @Test
    fun `admin mutations and PII exports require a token`() {
        assertFalse(ApiAccessPolicy.isPublic("GET", "/api/events"))
        assertFalse(ApiAccessPolicy.isPublic("POST", "/api/events"))
        assertFalse(ApiAccessPolicy.isPublic("GET", "/api/report"))
        assertFalse(ApiAccessPolicy.isPublic("GET", "/api/export"))
        assertFalse(ApiAccessPolicy.isPublic("GET", "/api/records"))
        assertFalse(ApiAccessPolicy.isPublic("POST", "/api/bulk-import"))
        assertFalse(ApiAccessPolicy.isPublic("POST", "/api/traffic-light/upload"))
        assertFalse(ApiAccessPolicy.isPublic("GET", "/api/traffic-light/latest"))
        assertFalse(ApiAccessPolicy.isPublic("GET", "/api/traffic-light/reports"))
        assertFalse(ApiAccessPolicy.isPublic("GET", "/api/traffic-light/reports/3"))
        assertFalse(ApiAccessPolicy.isPublic("POST", "/api/events/21/send-attendance-email"))
        assertFalse(ApiAccessPolicy.isPublic("POST", "/api/members"))
        assertFalse(ApiAccessPolicy.isPublic("GET", "/api/observers/export"))
        assertFalse(ApiAccessPolicy.isPublic("DELETE", "/api/events/clear-all"))
        assertFalse(ApiAccessPolicy.isPublic("POST", "/api/matching/members"))
        assertFalse(ApiAccessPolicy.isPublic("POST", "/api/matching/batch"))
        assertFalse(ApiAccessPolicy.isPublic("GET", "/api/insights/1"))
        assertFalse(ApiAccessPolicy.isPublic("POST", "/api/events/52/activate"))
        assertFalse(ApiAccessPolicy.isPublic("DELETE", "/api/events/52"))
    }
}
