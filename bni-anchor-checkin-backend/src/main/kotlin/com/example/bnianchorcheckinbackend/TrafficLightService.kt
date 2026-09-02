package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.MemberStanding
import com.example.bnianchorcheckinbackend.entities.TrafficLightReport
import com.example.bnianchorcheckinbackend.repositories.MemberRepository
import com.example.bnianchorcheckinbackend.repositories.TrafficLightReportRepository
import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDate

/**
 * Persist Anchor Traffic Light Excel snapshots and draft per-member reminders.
 *
 * Transactional: [importXlsx] / [importReport] write one `bni_traffic_light_reports` row
 * then sync matching members' [com.example.bnianchorcheckinbackend.entities.Member.standing].
 * Reminder generation is read-only except DeepSeek HTTP.
 */
@Service
@ConditionalOnProperty(name = ["spring.datasource.url"])
class TrafficLightService(
    private val reportRepository: TrafficLightReportRepository,
    private val memberRepository: MemberRepository,
    private val chapterService: ChapterService,
    private val objectMapper: ObjectMapper,
    private val deepSeekService: DeepSeekService
) {
    /**
     * Resolve chapter and reject non-Anchor callers.
     * @param chapterTag tag or null (default chapter)
     * @return Anchor `chapter_id`
     * @throws IllegalArgumentException when the chapter is not `anchor`
     */
    fun requireAnchor(chapterTag: String?): Int {
        val chapter = chapterService.requireChapter(chapterTag)
        if (!chapter.tag.equals("anchor", ignoreCase = true)) {
            throw IllegalArgumentException("Member Traffic Light upload is Anchor-only")
        }
        return chapter.id!!.toInt()
    }

    /**
     * Parse `.xlsx` bytes then [importReport].
     * @param bytes OOXML zip; must contain a Traffic Light Report sheet
     * @param filename stored on the snapshot for admin display
     */
    @Transactional
    fun importXlsx(bytes: ByteArray, filename: String, chapterTag: String?): TrafficLightReportDto {
        val parsed = TrafficLightXlsxParser.parse(bytes).copy(filename = filename)
        return importReport(parsed, chapterTag)
    }

    /**
     * Insert a report snapshot and overlay standing on members whose names match.
     * Unmatched names are skipped (no insert).
     */
    @Transactional
    fun importReport(request: TrafficLightImportRequest, chapterTag: String?): TrafficLightReportDto {
        val chapterId = requireAnchor(chapterTag)
        if (request.rows.isEmpty()) throw IllegalArgumentException("No traffic-light rows")
        val saved = reportRepository.save(
            TrafficLightReport(
                chapterId = chapterId,
                periodLabel = request.periodLabel.trim().ifEmpty { "Traffic Light" },
                periodStart = request.periodStart?.trim()?.takeIf { it.isNotEmpty() }?.let { LocalDate.parse(it) },
                periodEnd = request.periodEnd?.trim()?.takeIf { it.isNotEmpty() }?.let { LocalDate.parse(it) },
                greenGoal = request.greenGoal,
                yellowGoal = request.yellowGoal,
                filename = request.filename,
                rowsJson = objectMapper.writeValueAsString(request.rows)
            )
        )
        syncMemberStanding(chapterId, request.rows)
        return toDto(saved)
    }

    /** Newest report for Anchor, or null if none uploaded. */
    fun latest(chapterTag: String?): TrafficLightReportDto? {
        val chapterId = requireAnchor(chapterTag)
        val report = reportRepository.findTopByChapterIdOrderByIdDesc(chapterId) ?: return null
        return toDto(report)
    }

    /**
     * Upload history for the LT dashboard (newest first). Caps at [HISTORY_LIMIT] rows.
     * Side effect: reads `rows_json` to count lights; no write.
     */
    fun listHistory(chapterTag: String?): List<TrafficLightHistoryItemDto> {
        val chapterId = requireAnchor(chapterTag)
        return reportRepository.findAllByChapterIdOrderByIdDesc(chapterId)
            .take(HISTORY_LIMIT)
            .map { toHistoryItem(it) }
    }

    /**
     * One snapshot by id for the selected history row.
     * @throws IllegalArgumentException when missing or not Anchor
     */
    fun getById(reportId: Int, chapterTag: String?): TrafficLightReportDto {
        val chapterId = requireAnchor(chapterTag)
        val report = reportRepository.findByIdAndChapterId(reportId.toLong(), chapterId)
            ?: throw IllegalArgumentException("搵唔到呢份 Traffic Light 報告")
        return toDto(report)
    }

    /**
     * DeepSeek draft with template fallback.
     * Side effects: outbound DeepSeek HTTP when `deepseek.api.key` is set; no DB write.
     */
    fun reminder(request: TrafficLightReminderRequest, chapterTag: String?): TrafficLightReminderDto {
        val snapshot = if (request.reportId != null) {
            getById(request.reportId, chapterTag)
        } else {
            latest(chapterTag) ?: throw IllegalArgumentException("尚未上傳 Traffic Light Excel")
        }
        val row = snapshot.rows.firstOrNull { it.name.equals(request.name.trim(), ignoreCase = true) }
            ?: throw IllegalArgumentException("Report 搵唔到會員：${request.name}")
        val period = request.periodLabel?.trim()?.ifEmpty { null } ?: snapshot.periodLabel
        val weeks = meetingWeeks(row)
        val fallback = templateReminder(row, period, weeks)
        val ai = deepSeekService.generateTrafficLightReminder(
            name = row.name,
            light = row.light,
            totalPts = row.totalPts,
            periodLabel = period,
            summary = fallback.emailBody
        )
        return if (ai != null) {
            fallback.copy(
                emailSubject = ai.emailSubject.ifBlank { fallback.emailSubject },
                emailBody = ai.emailBody.ifBlank { fallback.emailBody },
                whatsappText = ai.whatsappText.ifBlank { fallback.whatsappText },
                source = "deepseek"
            )
        } else fallback
    }

    /** Overlay [MemberStanding] from light color; skip unknown names / invalid lights. */
    private fun syncMemberStanding(chapterId: Int, rows: List<TrafficLightRowDto>) {
        for (row in rows) {
            val member = memberRepository.findByChapterIdAndNameIgnoreCase(chapterId, row.name).orElse(null)
                ?: continue
            val standing = try {
                MemberStanding.valueOf(row.light.uppercase())
            } catch (_: Exception) {
                continue
            }
            member.standing = standing
            memberRepository.save(member)
        }
    }

    private fun parseRows(report: TrafficLightReport): List<TrafficLightRowDto> =
        objectMapper.readValue(
            report.rowsJson,
            object : TypeReference<List<TrafficLightRowDto>>() {}
        )

    private fun toHistoryItem(report: TrafficLightReport): TrafficLightHistoryItemDto {
        val rows = parseRows(report)
        val lights = rows.groupingBy { it.light.uppercase() }.eachCount()
        return TrafficLightHistoryItemDto(
            id = report.id!!.toInt(),
            periodLabel = report.periodLabel,
            periodStart = report.periodStart?.toString(),
            periodEnd = report.periodEnd?.toString(),
            filename = report.filename,
            createdAt = report.createdAt?.toString(),
            rowCount = rows.size,
            green = lights["GREEN"] ?: 0,
            yellow = lights["YELLOW"] ?: 0,
            red = lights["RED"] ?: 0,
            black = lights["BLACK"] ?: 0
        )
    }

    /** Deserialize [TrafficLightReport.rowsJson] into the admin DTO. */
    private fun toDto(report: TrafficLightReport): TrafficLightReportDto {
        val rows = parseRows(report)
        return TrafficLightReportDto(
            id = report.id!!.toInt(),
            chapterId = report.chapterId,
            periodLabel = report.periodLabel,
            periodStart = report.periodStart?.toString(),
            periodEnd = report.periodEnd?.toString(),
            greenGoal = report.greenGoal,
            yellowGoal = report.yellowGoal,
            filename = report.filename,
            createdAt = report.createdAt?.toString(),
            rows = rows
        )
    }

    /** Weeks used for per-week rates: attendance-ish columns, at least 1. */
    private fun meetingWeeks(row: TrafficLightRowDto): Int {
        val n = row.present + row.absent + row.late + row.medical + row.substitute
        return n.coerceAtLeast(1)
    }

    /** Cantonese email/WhatsApp copy when DeepSeek is unavailable. */
    private fun templateReminder(row: TrafficLightRowDto, period: String, weeks: Int): TrafficLightReminderDto {
        val lightZh = TrafficLightScoring.lightLabelZh(row.light)
        val short = (TrafficLightScoring.GREEN_PTS - row.totalPts).coerceAtLeast(0)
        val gNeed = ((1.5 * weeks) - row.referralsGiven).toInt().coerceAtLeast(0)
        val vNeed = ((0.75 * weeks) - row.visitors).toInt().coerceAtLeast(0)
        val body = buildString {
            appendLine("你好 ${row.name}，")
            appendLine()
            appendLine("Anchor Member Traffic Light（$period）你而家係${lightZh}，總分 ${row.totalPts}。")
            appendLine("綠燈門檻係 ${TrafficLightScoring.GREEN_PTS} 分。")
            appendLine()
            if (row.light.equals("GREEN", ignoreCase = true)) {
                appendLine("你已經係綠燈。請保持出席、每週 1.5 筆引薦、0.75 位嘉賓同每週 1 次 1-2-1。")
            } else {
                appendLine("距離綠燈大約差 $short 分。優先：")
                if (row.late > 0) appendLine("• 下個週期 0 遲到")
                if (gNeed > 0) appendLine("• 再多大約 $gNeed 筆引薦（目標每週 1.5 筆）")
                if (vNeed > 0) appendLine("• 再帶大約 $vNeed 位嘉賓（目標每週 0.75 位）")
                if (row.training < 2) appendLine("• 再完成 ${2 - row.training} 個 Skills Module")
                if (row.bizGive < 500_000) appendLine("• TYFCB 目標 HK\$500,000")
            }
            appendLine()
            appendLine("有問題可以搵 Membership Committee / VP。")
            appendLine("BNI Anchor")
        }
        val wa = buildString {
            append("Hi ${row.name}，Anchor 紅綠燈（$period）你而家係${lightZh}（${row.totalPts}分）。")
            if (!row.light.equals("GREEN", ignoreCase = true)) {
                append(" 要上綠燈大約差 $short 分。")
                if (gNeed > 0) append(" 引薦再多約 $gNeed 筆；")
                if (vNeed > 0) append(" 嘉賓再帶約 $vNeed 位。")
            } else {
                append(" 做得好，保持住。")
            }
            append(" 有問題搵 VP / Membership Committee 啦。")
        }
        return TrafficLightReminderDto(
            name = row.name,
            light = row.light.uppercase(),
            totalPts = row.totalPts,
            emailSubject = "BNI Anchor 紅綠燈提醒 — ${row.name}（$lightZh）",
            emailBody = body.trim(),
            whatsappText = wa.trim(),
            source = "template"
        )
    }

    companion object {
        /** Cap history API so listing does not load unbounded Excel snapshots. */
        const val HISTORY_LIMIT = 24
    }
}
