package com.example.bnianchorcheckinbackend

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

@RestController
@Tag(name = "Traffic Light", description = "Anchor Member Traffic Light Excel import and reminders")
@ConditionalOnProperty(name = ["spring.datasource.url"])
class TrafficLightController(
    private val trafficLightService: TrafficLightService
) {
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
