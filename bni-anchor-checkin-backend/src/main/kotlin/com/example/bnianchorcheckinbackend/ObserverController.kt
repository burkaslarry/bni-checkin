package com.example.bnianchorcheckinbackend

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.io.ByteArrayOutputStream
import java.io.PrintWriter

data class CreateObserverRequest(
    val name: String,
    val profession: String,
    val eventDate: String? = null
)

data class UpdateObserverRequest(
    val profession: String? = null,
    val eventDate: String? = null
)

@RestController
@Tag(name = "Observer", description = "Observer registry and attendance (no check-in time)")
@ConditionalOnProperty(name = ["spring.datasource.url"])
class ObserverController(
    private val databaseMemberService: DatabaseMemberService,
    @Autowired(required = false) private val eventDbService: EventDbService?,
    @Autowired(required = false) private val attendanceWebSocketHandler: AttendanceWebSocketHandler?,
) {

    @GetMapping("/api/observers")
    @Operation(summary = "List observers; optional eventDate filter")
    fun getObservers(@RequestParam(required = false) eventDate: String?): ResponseEntity<Map<String, List<Map<String, Any>>>> {
        val filter = eventDate?.trim()?.takeIf { it.isNotEmpty() }
        val list = if (filter != null) {
            databaseMemberService.getObserversForEventDate(filter)
        } else {
            databaseMemberService.getAllObservers()
        }
        return ResponseEntity.ok(mapOf("observers" to list))
    }

    @PostMapping("/api/observers")
    @Operation(summary = "Create observer for an event date (registration only)")
    fun createObserver(@RequestBody request: CreateObserverRequest): ResponseEntity<Map<String, Any>> {
        val name = request.name.trim()
        val profession = request.profession.trim()
        if (name.isBlank() || profession.isBlank()) {
            return ResponseEntity.badRequest().body(
                mapOf("status" to "error", "message" to "name and profession are required")
            )
        }
        val resolvedDate = request.eventDate?.trim().takeUnless { it.isNullOrEmpty() }
            ?: eventDbService?.getCurrentEvent()?.date
        if (resolvedDate.isNullOrBlank()) {
            return ResponseEntity.badRequest().body(
                mapOf("status" to "error", "message" to "eventDate is required when no current event is active")
            )
        }
        return try {
            val created = databaseMemberService.createObserver(name, profession, resolvedDate)
            attendanceWebSocketHandler?.broadcast(mapOf("type" to "observer_registry_updated"))
            ResponseEntity.status(HttpStatus.CREATED).body(
                mapOf(
                    "status" to "success",
                    "message" to "Observer created successfully",
                    "observer" to mapOf(
                        "id" to created.id!!.toInt(),
                        "name" to created.name,
                        "profession" to created.profession,
                        "eventDate" to created.eventDate,
                        "attended" to created.attended
                    )
                )
            )
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                mapOf("status" to "error", "message" to "無法新增觀察員。")
            )
        }
    }

    @PutMapping("/api/observers/{name}")
    @Operation(summary = "Update observer information")
    fun updateObserver(
        @PathVariable name: String,
        @RequestBody request: UpdateObserverRequest
    ): ResponseEntity<Map<String, Any>> {
        val updated = try {
            databaseMemberService.updateObserver(name, request.profession, request.eventDate)
        } catch (e: Exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                mapOf("status" to "error", "message" to "無法更新觀察員資料。")
            )
        }
        return if (updated != null) {
            attendanceWebSocketHandler?.broadcast(mapOf("type" to "observer_registry_updated"))
            ResponseEntity.ok(
                mapOf(
                    "status" to "success",
                    "message" to "Observer updated successfully",
                    "observer" to mapOf(
                        "id" to updated.id!!.toInt(),
                        "name" to updated.name,
                        "profession" to updated.profession,
                        "eventDate" to updated.eventDate,
                        "attended" to updated.attended
                    )
                )
            )
        } else {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                mapOf("status" to "error", "message" to "Observer not found")
            )
        }
    }

    @DeleteMapping("/api/observers/{name}")
    @Operation(summary = "Delete an observer")
    fun deleteObserver(@PathVariable name: String): ResponseEntity<Map<String, String>> {
        val deleted = try {
            databaseMemberService.deleteObserver(name)
        } catch (e: Exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(mapOf("status" to "error", "message" to "無法刪除觀察員。"))
        }
        return if (deleted) {
            attendanceWebSocketHandler?.broadcast(mapOf("type" to "observer_registry_updated"))
            ResponseEntity.ok(mapOf("status" to "success", "message" to "Observer deleted successfully"))
        } else {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("status" to "error", "message" to "Observer not found"))
        }
    }

    @GetMapping("/api/observers/export")
    @Operation(summary = "Export observer attendance for an event date (no check-in time)")
    fun exportObservers(@RequestParam eventDate: String): ResponseEntity<ByteArray> {
        val observers = databaseMemberService.getObserversForEventDate(eventDate.trim())
        val out = ByteArrayOutputStream()
        out.write(byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()))
        val writer = PrintWriter(out)
        writer.println("姓名,專業領域,出席狀態")
        for (o in observers) {
            val status = if (o["attended"] == true) "出席" else "缺席"
            val profession = (o["profession"] as? String ?: "").replace(",", "，")
            writer.println("${o["name"]},$profession,$status")
        }
        writer.flush()
        val filename = "observer-attendance-${eventDate.trim()}.csv"
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=$filename")
            .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
            .body(out.toByteArray())
    }
}
