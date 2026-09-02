package com.example.bnianchorcheckinbackend

/**
 * One member row from the Traffic Light Report sheet (or JSON import).
 * Column mapping matches BNI Anchor Excel: P/A/L/M/S, G, R, V, 1-2-1, T, Biz Give, PLS %, Total PTs.
 * [light] is `GREEN` | `YELLOW` | `RED` | `BLACK` (Excel fill, else [TrafficLightScoring.lightFromPts]).
 */
data class TrafficLightRowDto(
    val name: String,
    val present: Int = 0,
    val absent: Int = 0,
    val late: Int = 0,
    val medical: Int = 0,
    val substitute: Int = 0,
    val referralsGiven: Int = 0,
    val referralsReceived: Int = 0,
    val visitors: Int = 0,
    val oneToOnes: Int = 0,
    val training: Int = 0,
    val bizGive: Double = 0.0,
    val plsPct: Int = 0,
    val totalPts: Int = 0,
    val light: String
)

/**
 * POST `/api/traffic-light/import` body (also parser output).
 * [greenGoal]/[yellowGoal] are chapter KPI banners from Excel (e.g. “Green Goal: 60”), not row cutoffs.
 * Row cutoffs live in [TrafficLightScoring] (green ≥ 70).
 */
data class TrafficLightImportRequest(
    val periodLabel: String,
    val periodStart: String? = null,
    val periodEnd: String? = null,
    val greenGoal: Int = 60,
    val yellowGoal: Int = 40,
    val filename: String? = null,
    val perfectPresent: Int? = null,
    val rows: List<TrafficLightRowDto>
)

/** Latest or just-imported snapshot returned to the admin UI. */
data class TrafficLightReportDto(
    val id: Int,
    val chapterId: Int,
    val periodLabel: String,
    val periodStart: String?,
    val periodEnd: String?,
    val greenGoal: Int,
    val yellowGoal: Int,
    val filename: String?,
    val createdAt: String?,
    val rows: List<TrafficLightRowDto>
)

/**
 * One upload in the history list (no member rows).
 * Light counts are of that snapshot only — re-upload does not add to older rows.
 */
data class TrafficLightHistoryItemDto(
    val id: Int,
    val periodLabel: String,
    val periodStart: String?,
    val periodEnd: String?,
    val filename: String?,
    val createdAt: String?,
    val rowCount: Int,
    val green: Int,
    val yellow: Int,
    val red: Int,
    val black: Int
)

/** POST reminder — [name] matches a row; [reportId] selects a snapshot (default: latest). */
data class TrafficLightReminderRequest(
    val name: String,
    val periodLabel: String? = null,
    val reportId: Int? = null
)

/**
 * Email + WhatsApp copy for one member.
 * [source] is `deepseek` when AI succeeded, otherwise `template`.
 */
data class TrafficLightReminderDto(
    val name: String,
    val light: String,
    val totalPts: Int,
    val emailSubject: String,
    val emailBody: String,
    val whatsappText: String,
    val source: String
)
