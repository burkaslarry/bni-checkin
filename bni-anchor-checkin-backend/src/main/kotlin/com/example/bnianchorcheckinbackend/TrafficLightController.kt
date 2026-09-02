package com.example.bnianchorcheckinbackend

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

/**
 * REST for Anchor Member Traffic Light Excel import and per-member reminder drafts.
 *
 * Security: all endpoints call [TrafficLightService.requireAnchor] — other chapters get 400/403.
 * Auth is the same chapter-admin session as other admin APIs (no extra JWT on these routes).
 * Side effects: upload/import write `bni_traffic_light_reports` and may update `bni_anchor_members.standing`.
 *
 * Endpoints: upload, import, latest, reports list, report by id, reminder.
 */
@RestController
@Tag(name = "Traffic Light", description = "Anchor Member Traffic Light Excel import and reminders")
@ConditionalOnProperty(name = ["spring.datasource.url"])
class TrafficLightController(
    private val trafficLightService: TrafficLightService
) {
    /**
     * Upload a BNI Member Traffic Light `.xlsx` (Anchor only).
     *
     * @param file multipart Excel; empty file → 400
     * @param chapter optional tag; omitted defaults via [ChapterService.requireChapter]
     * @return 200 `{status, message, report}`; 400 parse/empty/non-Anchor
     */
    @PostMapping("/api/traffic-light/upload", consumes = ["multipart/form-data"])
    @Operation(summary = "Upload Anchor Member Traffic Light .xlsx (Anchor only)")
    fun uploadExcel(
        @RequestParam("file") file: MultipartFile,
        @RequestParam(required = false) chapter: String?
    ): ResponseEntity<Map<String, Any>> {
        return try {
            if (file.isEmpty) {
                return ResponseEntity.badRequest().body(mapOf("status" to "error", "message" to "Empty file"))
            }
            val dto = trafficLightService.importXlsx(file.bytes, file.originalFilename ?: "traffic-light.xlsx", chapter)
            ResponseEntity.ok(
                mapOf(
                    "status" to "success",
                    "message" to "已匯入 ${dto.rows.size} 位會員紅綠燈",
                    "report" to dto
                )
            )
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("status" to "error", "message" to (e.message ?: "Invalid request"))
            )
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("status" to "error", "message" to (e.message ?: "Failed to parse Excel"))
            )
        }
    }

    /**
     * Import already-parsed rows (tests / clients that skip xlsx).
     *
     * @param request period + member rows; empty `rows` → 400
     * @param chapter optional tag
     * @return 200 `{status, message, report}`; 400 non-Anchor or empty rows
     */
    @PostMapping("/api/traffic-light/import")
    @Operation(summary = "Import parsed Anchor Traffic Light Excel rows (Anchor chapter only)")
    fun importReport(
        @RequestBody request: TrafficLightImportRequest,
        @RequestParam(required = false) chapter: String?
    ): ResponseEntity<Map<String, Any>> {
        return try {
            val dto = trafficLightService.importReport(request, chapter)
            ResponseEntity.ok(
                mapOf(
                    "status" to "success",
                    "message" to "已匯入 ${dto.rows.size} 位會員紅綠燈",
                    "report" to dto
                )
            )
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("status" to "error", "message" to (e.message ?: "Invalid request"))
            )
        }
    }

    /**
     * Latest stored report for Anchor, newest `id` first.
     *
     * @param chapter optional tag
     * @return 200 [TrafficLightReportDto]; 404 none uploaded; 403 non-Anchor
     */
    @GetMapping("/api/traffic-light/latest")
    @Operation(summary = "Latest uploaded Traffic Light report (Anchor only)")
    fun latest(@RequestParam(required = false) chapter: String?): ResponseEntity<Any> {
        return try {
            val dto = trafficLightService.latest(chapter)
                ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                    mapOf("status" to "error", "message" to "尚未上傳 Traffic Light Excel")
                )
            ResponseEntity.ok(dto)
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                mapOf("status" to "error", "message" to (e.message ?: "Forbidden"))
            )
        }
    }

    /**
     * Upload history for the LT dashboard (newest first, no member rows).
     *
     * @param chapter optional tag
     * @return 200 list of [TrafficLightHistoryItemDto]; 403 non-Anchor
     */
    @GetMapping("/api/traffic-light/reports")
    @Operation(summary = "List Traffic Light upload history (Anchor only)")
    fun listReports(@RequestParam(required = false) chapter: String?): ResponseEntity<Any> {
        return try {
            ResponseEntity.ok(mapOf("reports" to trafficLightService.listHistory(chapter)))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                mapOf("status" to "error", "message" to (e.message ?: "Forbidden"))
            )
        }
    }

    /**
     * One stored snapshot (full member rows) for a history row click.
     *
     * @param id report id
     * @param chapter optional tag
     * @return 200 [TrafficLightReportDto]; 404 missing; 403 non-Anchor
     */
    @GetMapping("/api/traffic-light/reports/{id}")
    @Operation(summary = "Get one Traffic Light snapshot by id (Anchor only)")
    fun getReport(
        @PathVariable id: Int,
        @RequestParam(required = false) chapter: String?
    ): ResponseEntity<Any> {
        return try {
            ResponseEntity.ok(trafficLightService.getById(id, chapter))
        } catch (e: IllegalArgumentException) {
            val msg = e.message ?: "Invalid request"
            val missing = msg.contains("搵唔到")
            ResponseEntity.status(if (missing) HttpStatus.NOT_FOUND else HttpStatus.FORBIDDEN).body(
                mapOf("status" to "error", "message" to msg)
            )
        }
    }

    /**
     * Draft email + WhatsApp copy for one member on the selected (or latest) report.
     * Uses DeepSeek when the API key is set; otherwise a Cantonese template.
     *
     * @param request `name` must match a row (case-insensitive); optional `periodLabel` and `reportId`
     * @param chapter optional tag
     * @return 200 [TrafficLightReminderDto] (`source` = `deepseek` | `template`); 400 missing report/name
     */
    @PostMapping("/api/traffic-light/reminder")
    @Operation(summary = "DeepSeek (or template) email + WhatsApp reminder for one member")
    fun reminder(
        @RequestBody request: TrafficLightReminderRequest,
        @RequestParam(required = false) chapter: String?
    ): ResponseEntity<Any> {
        return try {
            ResponseEntity.ok(trafficLightService.reminder(request, chapter))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                mapOf("status" to "error", "message" to (e.message ?: "Invalid request"))
            )
        }
    }
}
