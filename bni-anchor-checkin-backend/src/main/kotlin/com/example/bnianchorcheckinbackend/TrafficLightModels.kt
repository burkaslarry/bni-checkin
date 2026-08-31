package com.example.bnianchorcheckinbackend

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

data class TrafficLightReminderRequest(
    val name: String,
    val periodLabel: String? = null
)

data class TrafficLightReminderDto(
    val name: String,
    val light: String,
    val totalPts: Int,
    val emailSubject: String,
    val emailBody: String,
    val whatsappText: String,
    val source: String
)
