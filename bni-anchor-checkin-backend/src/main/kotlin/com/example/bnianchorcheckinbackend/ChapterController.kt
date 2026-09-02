package com.example.bnianchorcheckinbackend

import com.fasterxml.jackson.annotation.JsonProperty
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

data class ClientLoginRequest(
    @JsonProperty("AdminLogin")
    val adminLogin: String? = null,
    @JsonProperty("AdminPassword")
    val adminPassword: String? = null
)

data class ChapterAdminPasswordRequest(
    @JsonProperty("AdminPassword")
    val adminPassword: String? = null
)

@RestController
@Tag(name = "Chapter / Client Auth", description = "Chapter resolution and client admin login")
@ConditionalOnProperty(name = ["spring.datasource.url"])
class ChapterController(
    private val chapterService: ChapterService
) {

    @GetMapping("/api/chapters")
    @Operation(summary = "List active chapters")
    fun listChapters(): Map<String, Any> =
        mapOf("chapters" to chapterService.listActiveChapters())

    @GetMapping("/api/chapters/resolve")
    @Operation(summary = "Resolve chapter tag (default anchor)")
    fun resolveChapter(@RequestParam(required = false) chapter: String?): ResponseEntity<Map<String, Any>> {
        return try {
            val info = chapterService.toInfo(chapterService.requireChapter(chapter))
            ResponseEntity.ok(mapOf("chapter" to info))
        } catch (e: IllegalArgumentException) {
            ResponseEntity.badRequest().body(mapOf("status" to "error", "message" to (e.message ?: "Invalid chapter")))
        }
    }

    @PostMapping("/api/client/login")
    @Operation(summary = "Client chapter admin login (AdminLogin / AdminPassword; bcrypt with MD5 upgrade)")
    fun login(@RequestBody request: ClientLoginRequest): ResponseEntity<Map<String, Any>> {
        val login = (request.adminLogin ?: "").trim()
        val password = request.adminPassword ?: ""
        return try {
            val result = chapterService.login(login, password)
            ResponseEntity.ok(
                mapOf(
                    "status" to "success",
                    "token" to result.token,
                    "expiresAtEpochMs" to result.expiresAtEpochMs,
                    "chapter" to result.chapter
                )
            )
        } catch (e: IllegalArgumentException) {
            ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                mapOf("status" to "error", "message" to (e.message ?: "Login failed"))
            )
        }
    }

    @PostMapping("/api/client/logout")
    @Operation(summary = "Invalidate client admin session token")
    fun logout(@RequestHeader(value = "X-Client-Token", required = false) token: String?): Map<String, String> {
        chapterService.logout(token)
        return mapOf("status" to "success")
    }

    @GetMapping("/api/client/session")
    @Operation(summary = "Validate client session token")
    fun session(@RequestHeader(value = "X-Client-Token", required = false) token: String?): ResponseEntity<Map<String, Any>> {
        val chapter = chapterService.resolveChapterFromSession(token)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                mapOf("status" to "error", "message" to "Not authenticated")
            )
        return ResponseEntity.ok(
            mapOf("status" to "success", "chapter" to chapterService.toInfo(chapter))
        )
    }

    @PutMapping("/api/chapters/{tag}/admin-password")
    @Operation(summary = "Anchor-only: reset another chapter AdminPassword (stored as bcrypt)")
    fun updateChapterAdminPassword(
        @PathVariable tag: String,
        @RequestHeader(value = "X-Client-Token", required = false) token: String?,
        @RequestBody request: ChapterAdminPasswordRequest
    ): ResponseEntity<Map<String, Any>> {
        return try {
            chapterService.requireAnchorSession(token)
            val updated = chapterService.updateChapterAdminPassword(tag, request.adminPassword ?: "")
            ResponseEntity.ok(
                mapOf(
                    "status" to "success",
                    "chapter" to mapOf(
                        "tag" to updated.tag,
                        "displayName" to updated.displayName
                    )
                )
            )
        } catch (e: IllegalArgumentException) {
            val msg = e.message ?: "Update failed"
            val unauthorized =
                msg.contains("Not authenticated", ignoreCase = true) ||
                    msg.contains("Only Anchor", ignoreCase = true)
            ResponseEntity.status(if (unauthorized) HttpStatus.UNAUTHORIZED else HttpStatus.BAD_REQUEST)
                .body(mapOf("status" to "error", "message" to msg))
        }
    }
}
