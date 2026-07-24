package com.example.bnianchorcheckinbackend

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@Tag(name = "Bulk Import", description = "Endpoints for bulk importing members and guests")
class BulkImportController(
    @Autowired(required = false) private val bulkImportService: BulkImportService?,
    private val guestService: GuestService,
    @Autowired(required = false) private val attendanceWebSocketHandler: AttendanceWebSocketHandler?,
) {

    private val log = org.slf4j.LoggerFactory.getLogger(BulkImportController::class.java)

    private fun notifyGuestRegistryUpdated(result: ImportResult) {
        if (result.inserted + result.updated > 0) {
            attendanceWebSocketHandler?.broadcast(mapOf("type" to "guest_registry_updated"))
        }
    }

    private fun notifyObserverRegistryUpdated(result: ImportResult) {
        if (result.inserted + result.updated > 0) {
            attendanceWebSocketHandler?.broadcast(mapOf("type" to "observer_registry_updated"))
        }
    }

    private fun isDbConnectionError(errors: List<String>): Boolean {
        if (errors.isEmpty()) return false
        val msg = errors.joinToString(" ").lowercase()
        return "connection" in msg || "jdbc" in msg || "unable to acquire" in msg ||
            "無法連線" in msg || "timeout" in msg || "no route" in msg
    }

    private fun resolveChapterParam(queryChapter: String?, bodyChapter: String?): String? =
        queryChapter?.takeIf { it.isNotBlank() } ?: bodyChapter

    @PostMapping("/api/bulk-import")
    @Operation(summary = "Bulk import members or guests from CSV data")
    fun bulkImport(
        @RequestParam(required = false) chapter: String?,
        @RequestBody request: BulkImportRequest
    ): ResponseEntity<ImportResult> {
        val scoped = request.copy(chapter = resolveChapterParam(chapter, request.chapter))
        if (bulkImportService == null) {
            return if (scoped.type.lowercase() == "guest") {
                val fallback = guestService.addBulkImportedGuests(scoped.records)
                notifyGuestRegistryUpdated(fallback)
                ResponseEntity.ok(fallback)
            } else {
                ResponseEntity.ok(ImportResult(
                    total = scoped.records.size, inserted = 0, updated = 0, failed = scoped.records.size,
                    errors = listOf("匯入會員需要資料庫連線，請設定 spring.datasource.url")
                ))
            }
        }
        return try {
            val result = bulkImportService.bulkImport(scoped)
            if (result.failed > 0 && scoped.type.lowercase() == "guest" && isDbConnectionError(result.errors)) {
                log.warn("DB unavailable for guest import, falling back to in-memory store")
                val fallback = guestService.addBulkImportedGuests(scoped.records)
                notifyGuestRegistryUpdated(fallback)
                return ResponseEntity.ok(fallback)
            }
            if (scoped.type.lowercase() == "guest") notifyGuestRegistryUpdated(result)
            ResponseEntity.ok(result)
        } catch (e: Exception) {
            log.error("Bulk import failed: {}", e.message, e)
            if (scoped.type.lowercase() == "guest") {
                try {
                    val fallback = guestService.addBulkImportedGuests(scoped.records)
                    notifyGuestRegistryUpdated(fallback)
                    return ResponseEntity.ok(fallback)
                } catch (e2: Exception) {
                    log.error("Guest fallback also failed: {}", e2.message)
                }
            }
            ResponseEntity.ok(ImportResult(
                total = scoped.records.size, inserted = 0, updated = 0, failed = scoped.records.size,
                errors = listOf("資料庫暫時無法連線，無法儲存匯入資料。請稍後重試。")
            ))
        }
    }

    @PostMapping("/api/bulk-import/members", "/api/bulk-import-members")
    @Operation(summary = "Bulk import members only")
    fun bulkImportMembers(
        @RequestParam(required = false) chapter: String?,
        @RequestBody records: List<ImportRecord>
    ): ResponseEntity<ImportResult> {
        if (bulkImportService == null) {
            return ResponseEntity.ok(ImportResult(
                total = records.size, inserted = 0, updated = 0, failed = records.size,
                errors = listOf("匯入會員需要資料庫連線")
            ))
        }
        return try {
            ResponseEntity.ok(bulkImportService.bulkImportMembers(records, chapter))
        } catch (e: Exception) {
            log.error("Bulk import members failed: {}", e.message)
            ResponseEntity.ok(ImportResult(
                total = records.size, inserted = 0, updated = 0, failed = records.size,
                errors = listOf("資料庫暫時無法連線，無法儲存匯入資料。")
            ))
        }
    }

    @PostMapping("/api/bulk-import/guests", "/api/bulk-import-guest")
    @Operation(summary = "Bulk import guests only")
    fun bulkImportGuests(
        @RequestBody records: List<ImportRecord>,
        @RequestParam(required = false) chapter: String?
    ): ResponseEntity<ImportResult> {
        return try {
            if (bulkImportService != null) {
                val r = bulkImportService.bulkImportGuests(records, chapter)
                notifyGuestRegistryUpdated(r)
                ResponseEntity.ok(r)
            } else {
                val r = guestService.addBulkImportedGuests(records)
                notifyGuestRegistryUpdated(r)
                ResponseEntity.ok(r)
            }
        } catch (e: Exception) {
            log.error("Bulk import guests failed: {}", e.message)
            return try {
                val r = guestService.addBulkImportedGuests(records)
                notifyGuestRegistryUpdated(r)
                ResponseEntity.ok(r)
            } catch (e2: Exception) {
                ResponseEntity.ok(ImportResult(
                    total = records.size, inserted = 0, updated = 0, failed = records.size,
                    errors = listOf("資料庫暫時無法連線，無法儲存匯入資料。")
                ))
            }
        }
    }

    @PostMapping("/api/bulk-import/observers", "/api/bulk-import-observers")
    @Operation(summary = "Bulk import observers only")
    fun bulkImportObservers(
        @RequestBody records: List<ImportRecord>,
        @RequestParam(required = false) chapter: String?
    ): ResponseEntity<ImportResult> {
        if (bulkImportService == null) {
            return ResponseEntity.ok(ImportResult(
                total = records.size, inserted = 0, updated = 0, failed = records.size,
                errors = listOf("匯入觀察員需要資料庫連線")
            ))
        }
        return try {
            val r = bulkImportService.bulkImportObservers(records, chapter)
            notifyObserverRegistryUpdated(r)
            ResponseEntity.ok(r)
        } catch (e: Exception) {
            log.error("Bulk import observers failed: {}", e.message)
            ResponseEntity.ok(ImportResult(
                total = records.size, inserted = 0, updated = 0, failed = records.size,
                errors = listOf("資料庫暫時無法連線，無法儲存匯入資料。")
            ))
        }
    }
}
