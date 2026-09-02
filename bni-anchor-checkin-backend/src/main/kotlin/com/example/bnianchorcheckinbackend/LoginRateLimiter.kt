package com.example.bnianchorcheckinbackend

import java.util.concurrent.ConcurrentHashMap

/**
 * In-memory login throttle: 5 attempts per IP per 5 minutes.
 * Render sets X-Forwarded-For; use the left-most client address.
 */
object LoginRateLimiter {
    private const val MAX_ATTEMPTS = 5
    private const val WINDOW_MS = 5L * 60L * 1000L

    private data class Bucket(var count: Int, var windowStartMs: Long)

    private val buckets = ConcurrentHashMap<String, Bucket>()

    fun allow(ip: String): Boolean {
        val key = ip.trim().ifBlank { "unknown" }
        val now = System.currentTimeMillis()
        val bucket = buckets.compute(key) { _, existing ->
            if (existing == null || now - existing.windowStartMs >= WINDOW_MS) {
                Bucket(1, now)
            } else {
                existing.count += 1
                existing
            }
        }!!
        return bucket.count <= MAX_ATTEMPTS
    }

    fun clientIp(forwardedFor: String?, remoteAddr: String?): String {
        val first = forwardedFor?.split(",")?.firstOrNull()?.trim().orEmpty()
        if (first.isNotEmpty()) return first
        return remoteAddr?.trim().orEmpty().ifBlank { "unknown" }
    }
}
