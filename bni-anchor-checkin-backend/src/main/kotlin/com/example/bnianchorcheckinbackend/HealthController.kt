package com.example.bnianchorcheckinbackend

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Process liveness for Render. No PII, no DB. Do not use /api/members as a health check.
 */
@RestController
class HealthController {
    @GetMapping("/health")
    fun health(): ResponseEntity<Map<String, String>> =
        ResponseEntity.ok(mapOf("status" to "ok"))
}
