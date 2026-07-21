package com.example.bnianchorcheckinbackend

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import java.io.ByteArrayOutputStream
import java.io.PrintWriter
import java.nio.charset.StandardCharsets

data class AttendanceCsvPayload(
    val filename: String,
    val bytes: ByteArray,
    val eventId: Int,
    val eventName: String,
    val eventDate: String,
    val rowCount: Int
)

/**
 * Builds attendance CSV matching GET /api/export format (UTF-8 BOM).
 * Used by download export and post-event email.
 */
@Service
@ConditionalOnProperty(name = ["spring.datasource.url"])
class AttendanceCsvExportService(
    private val eventDbService: EventDbService,
    private val databaseMemberService: DatabaseMemberService
) {
    fun buildCsvForEvent(eventId: Int): AttendanceCsvPayload {
        val reportData = eventDbService.getReportData(eventId)
            ?: throw IllegalArgumentException("Event not found or has no report data: $eventId")

        val out = ByteArrayOutputStream()
        out.write(byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()))
        val writer = PrintWriter(out, false, StandardCharsets.UTF_8)
        writer.println("姓名,專業領域,類別,出席狀態,簽到時間,替代人")

        val membersWithDomain = try {
            databaseMemberService.getAllMembers().map { m ->
                (m["name"] as String) to (m["domain"] as? String ?: "")
            }
        } catch (_: Exception) {
            emptyList()
        }
        val memberDomainMap = membersWithDomain.toMap()

        var rows = 0
        for (attendee in reportData.attendees) {
            if (attendee.role != "MEMBER") continue
            val domain = (memberDomainMap[attendee.memberName] ?: "").replace(",", "，")
            val statusText = when (attendee.status) {
                "on-time" -> "準時"
                "late" -> "遲到"
                "late_with_code" -> "遲到(有代碼)"
                else -> attendee.status
            }
            val substitute = (attendee.substituteFor ?: "").replace(",", "，")
            writer.println(
                "${attendee.memberName},${domain},member,${statusText},${formatCheckInTime(attendee.checkInTime)},${substitute}"
            )
            rows++
        }

        for (absentee in reportData.absentees) {
            if (absentee.role !in listOf("MEMBER", "")) continue
            val domain = (memberDomainMap[absentee.memberName] ?: "").replace(",", "，")
            writer.println("${absentee.memberName},${domain},member,缺席,,")
            rows++
        }

        val guestDomainMap = try {
            databaseMemberService.getAllGuests()
                .associate { g -> (g["name"] ?: "") to (g["profession"] ?: "") }
                .filterKeys { it.isNotBlank() }
        } catch (_: Exception) {
            emptyMap()
        }

        val exportedGuestNames = mutableSetOf<String>()
        for (attendee in reportData.attendees) {
            if (attendee.role !in listOf("GUEST", "VIP", "SPEAKER")) continue
            val domain = (guestDomainMap[attendee.memberName] ?: "").replace(",", "，")
            val roleLabel = attendee.role.lowercase()
            val statusText = when (attendee.status) {
                "on-time" -> "準時"
                "late" -> "遲到"
                else -> attendee.status
            }
            writer.println(
                "${attendee.memberName},${domain},${roleLabel},${statusText},${formatCheckInTime(attendee.checkInTime)}"
            )
            exportedGuestNames.add(attendee.memberName)
            rows++
        }

        val allGuestsForEvent = try {
            databaseMemberService.getGuestsForEventDate(reportData.eventDate)
        } catch (_: Exception) {
            emptyList()
        }
        for (g in allGuestsForEvent) {
            val guestName = (g["name"] ?: "").trim()
            if (guestName.isBlank() || exportedGuestNames.contains(guestName)) continue
            val domain = (g["profession"] ?: "").replace(",", "，")
            writer.println("${guestName},${domain},guest,缺席,")
            rows++
        }

        // Absent guests from report absentees (role GUEST)
        for (absentee in reportData.absentees) {
            if (absentee.role != "GUEST") continue
            if (exportedGuestNames.contains(absentee.memberName)) continue
            val domain = (guestDomainMap[absentee.memberName] ?: "").replace(",", "，")
            writer.println("${absentee.memberName},${domain},guest,缺席,")
            exportedGuestNames.add(absentee.memberName)
            rows++
        }

        writer.flush()
        writer.close()

        val yyyymmdd = reportData.eventDate.replace("-", "")
        val filename = "attendance_${yyyymmdd}.csv"
        return AttendanceCsvPayload(
            filename = filename,
            bytes = out.toByteArray(),
            eventId = eventId,
            eventName = reportData.eventName,
            eventDate = reportData.eventDate,
            rowCount = rows
        )
    }

    private fun formatCheckInTime(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        val t = raw.trim()
        // Prefer H:mm / HH:mm without seconds for Excel-friendly export
        return try {
            val timePart = when {
                t.contains("T") -> t.substringAfter("T").take(8)
                else -> t
            }
            val parts = timePart.split(":")
            if (parts.size >= 2) {
                val h = parts[0].toInt()
                val m = parts[1].toInt()
                "%d:%02d".format(h, m)
            } else t
        } catch (_: Exception) {
            t
        }
    }
}
