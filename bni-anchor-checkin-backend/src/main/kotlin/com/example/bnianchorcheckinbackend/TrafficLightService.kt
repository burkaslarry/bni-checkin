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

@Service
@ConditionalOnProperty(name = ["spring.datasource.url"])
class TrafficLightService(
    private val reportRepository: TrafficLightReportRepository,
    private val memberRepository: MemberRepository,
    private val chapterService: ChapterService,
    private val objectMapper: ObjectMapper,
    private val deepSeekService: DeepSeekService
) {
    fun requireAnchor(chapterTag: String?): Int {
        val chapter = chapterService.requireChapter(chapterTag)
        if (!chapter.tag.equals("anchor", ignoreCase = true)) {
            throw IllegalArgumentException("Member Traffic Light upload is Anchor-only")
        }
        return chapter.id!!.toInt()
    }

    @Transactional
    fun importXlsx(bytes: ByteArray, filename: String, chapterTag: String?): TrafficLightReportDto {
        val parsed = TrafficLightXlsxParser.parse(bytes).copy(filename = filename)
        return importReport(parsed, chapterTag)
    }

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

    fun latest(chapterTag: String?): TrafficLightReportDto? {
        val chapterId = requireAnchor(chapterTag)
        val report = reportRepository.findTopByChapterIdOrderByIdDesc(chapterId) ?: return null
        return toDto(report)
    }

    fun reminder(request: TrafficLightReminderRequest, chapterTag: String?): TrafficLightReminderDto {
        val latest = latest(chapterTag) ?: throw IllegalArgumentException("尚未上傳 Traffic Light Excel")
        val row = latest.rows.firstOrNull { it.name.equals(request.name.trim(), ignoreCase = true) }
            ?: throw IllegalArgumentException("Report 搵唔到會員：${request.name}")
        val period = request.periodLabel?.trim()?.ifEmpty { null } ?: latest.periodLabel
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

    private fun toDto(report: TrafficLightReport): TrafficLightReportDto {
        val rows: List<TrafficLightRowDto> = objectMapper.readValue(
            report.rowsJson,
            object : TypeReference<List<TrafficLightRowDto>>() {}
        )
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

    private fun meetingWeeks(row: TrafficLightRowDto): Int {
        val n = row.present + row.absent + row.late + row.medical + row.substitute
        return n.coerceAtLeast(1)
    }

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
}
