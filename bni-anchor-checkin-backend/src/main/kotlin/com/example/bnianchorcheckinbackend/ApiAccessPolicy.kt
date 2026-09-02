package com.example.bnianchorcheckinbackend

/**
 * Public (unauthenticated) HTTP routes for kiosk check-in and guest walk-in.
 * Other /api routes require a valid X-Client-Token header.
 */
object ApiAccessPolicy {

    fun isPublic(method: String, path: String): Boolean {
        val m = method.uppercase()
        val p = normalizePath(path)
        if (m == "OPTIONS") return true
        if (p == "/health") return true
        if (p.startsWith("/ws/")) return true
        if (p.startsWith("/api/public/")) return true
        if (m == "POST" && p == "/api/client/login") return true
        if (m == "POST" && p == "/api/client/logout") return true
        if (m == "GET" && p == "/api/client/session") return true
        if (m == "GET" && (p == "/api/chapters" || p == "/api/chapters/resolve")) return true
        if (m == "GET" && p == "/api/events/current") return true
        if (m == "GET" && p == "/api/events/check") return true
        if (m == "GET" && p == "/api/events/check-this-week") return true
        if (m == "GET" && p == "/api/events/for-date") return true
        if (m == "GET" && EVENT_ID.matches(p)) return true
        if (m == "GET" && p == "/api/members") return true
        if (m == "GET" && p == "/api/profession-groups") return true
        if (m == "GET" && p == "/api/guests") return true
        if (m == "GET" && p == "/api/observers") return true
        if (m == "GET" && p == "/api/attendance/planned-substitutes") return true
        if (m == "POST" && p == "/api/checkin") return true
        if (m == "POST" && p == "/api/attendance/scan") return true
        if (m == "POST" && p == "/api/attendance/log") return true
        if (m == "POST" && p == "/api/attendance/substitute-for") return true
        if (m == "POST" && p == "/api/matching/quick") return true
        if (m == "GET" && p == "/api/matching/health") return true
        return false
    }

    fun normalizePath(path: String): String {
        val noQuery = path.substringBefore('?').trim()
        if (noQuery.isEmpty()) return "/"
        val slash = if (noQuery.startsWith("/")) noQuery else "/$noQuery"
        return if (slash.length > 1) slash.trimEnd('/') else slash
    }

    private val EVENT_ID = Regex("^/api/events/\\d+$")
}
