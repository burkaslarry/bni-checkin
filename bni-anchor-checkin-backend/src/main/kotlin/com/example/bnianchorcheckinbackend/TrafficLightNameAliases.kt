package com.example.bnianchorcheckinbackend

/**
 * Excel Traffic Light names → EventXP roster names (Anchor).
 * Keep in sync with `bni-anchor-checkin/src/lib/trafficLight.ts`.
 */
object TrafficLightNameAliases {
    private val excelToRoster = mapOf(
        "chow chong kwan" to "Dr. Chow C.K.",
        "wade suen" to "Dr. Wade Suen",
        "eddie chou" to "Max Chan/William Lai/Eddie Chou",
    )

    fun normalize(name: String): String =
        name.trim().lowercase().replace(Regex("\\s+"), " ")

    /** Roster name to look up from an Excel cell, or the trimmed Excel name if no alias. */
    fun rosterNameForExcel(excelName: String): String {
        val key = normalize(excelName)
        return excelToRoster[key] ?: excelName.trim()
    }
}
