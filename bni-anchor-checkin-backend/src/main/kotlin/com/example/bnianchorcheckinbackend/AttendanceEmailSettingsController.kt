package com.example.bnianchorcheckinbackend

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

data class UpdateAttendanceEmailSettingsRequest(val recipients: List<String> = emptyList())

/** [F012][S1202] Authenticated admin API for chapter-scoped attendance CSV recipients. */
@RestController
@RequestMapping("/api/attendance-email/settings")
@ConditionalOnProperty(name = ["spring.datasource.url"])
class AttendanceEmailSettingsController(
    private val settingsService: AttendanceEmailSettingsService,
    private val chapterService: ChapterService
) {
    @GetMapping
    fun getSettings(@RequestHeader(value = "X-Client-Token", required = false) token: String?) =
        respond(token) { settingsService.getSettings(it) }

    @PutMapping
    fun updateSettings(
        @RequestHeader(value = "X-Client-Token", required = false) token: String?,
        @RequestBody request: UpdateAttendanceEmailSettingsRequest
    ) = respond(token) { settingsService.updateSettings(it, request.recipients) }

    private fun respond(
        token: String?,
        action: (Int) -> AttendanceEmailSettings
    ): ResponseEntity<Map<String, Any>> {
        return try {
            val chapter = chapterService.resolveChapterFromSession(token)
                ?: return ResponseEntity.status(401).body(mapOf("status" to "error", "message" to "Not authenticated"))
            val settings = action(chapter.id!!.toInt())
            ResponseEntity.ok(mapOf("status" to "success", "recipients" to settings.recipients))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().body(mapOf("status" to "error", "message" to (e.message ?: "Invalid recipients")))
        }
    }
}
