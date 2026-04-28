package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.MemberStanding
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

data class UpdateMemberRequest(
    val profession: String? = null,
    val standing: String? = null
)

data class UpdateGuestRequest(
    val profession: String? = null,
    val referrer: String? = null,
    val eventDate: String? = null
)

data class CreateGuestRequest(
    val name: String,
    val profession: String,
    val referrer: String? = null,
    val eventDate: String? = null
)

@RestController
@Tag(name = "Member Management", description = "Endpoints for managing member records")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = ["spring.datasource.url"])
class MemberManagementController(
    private val databaseMemberService: DatabaseMemberService,
    @Autowired(required = false) private val eventDbService: EventDbService?,
    @Autowired(required = false) private val attendanceWebSocketHandler: AttendanceWebSocketHandler?,
) {

    @PutMapping("/api/members/{name}")
    @Operation(summary = "Update member information")
    fun updateMember(
        @PathVariable name: String,
        @RequestBody request: UpdateMemberRequest
    ): ResponseEntity<Map<String, Any>> {
        val standing = try {
            request.standing?.let { MemberStanding.valueOf(it.uppercase()) }
        } catch (e: Exception) {
            return ResponseEntity.badRequest().body(mapOf(
                "status" to "error",
                "message" to "Invalid standing value. Must be GREEN, YELLOW, RED, or BLACK"
            ))
        }

        val updatedMember = try {
            databaseMemberService.updateMember(name, request.profession, standing)
        } catch (e: Exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(mapOf(
                "status" to "error",
                "message" to "資料庫暫時無法連線，無法更新會員資料。"
            ))
        }
        return if (updatedMember != null) {
            attendanceWebSocketHandler?.broadcast(mapOf("type" to "member_registry_updated"))
            ResponseEntity.ok(mapOf(
                "status" to "success",
                "message" to "Member updated successfully",
                "member" to mapOf(
                    "name" to updatedMember.name,
                    "profession" to (updatedMember.profession ?: ""),
                    "standing" to updatedMember.standing.name
                )
            ))
        } else {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                "status" to "error",
                "message" to "Member not found"
            ))
        }
    }

    @DeleteMapping("/api/members/{name}")
    @Operation(summary = "Delete a member")
    fun deleteMember(@PathVariable name: String): ResponseEntity<Map<String, String>> {
        val deleted = try {
            databaseMemberService.deleteMember(name)
        } catch (e: Exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(mapOf("status" to "error", "message" to "資料庫暫時無法連線，無法刪除會員。"))
        }
        return if (deleted) {
            attendanceWebSocketHandler?.broadcast(mapOf("type" to "member_registry_updated"))
            ResponseEntity.ok(mapOf("status" to "success", "message" to "Member deleted successfully"))
        } else {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("status" to "error", "message" to "Member not found"))
        }
    }

    @PutMapping("/api/guests/{name}")
    @Operation(summary = "Update guest information")
    fun updateGuest(
        @PathVariable name: String,
        @RequestBody request: UpdateGuestRequest
    ): ResponseEntity<Map<String, Any>> {
        val updatedGuest = try {
            databaseMemberService.updateGuest(name, request.profession, request.referrer, request.eventDate)
        } catch (e: Exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(mapOf(
                "status" to "error",
                "message" to "資料庫暫時無法連線，無法更新嘉賓資料。"
            ))
        }
        return if (updatedGuest != null) {
            attendanceWebSocketHandler?.broadcast(mapOf("type" to "guest_registry_updated"))
            ResponseEntity.ok(mapOf(
                "status" to "success",
                "message" to "Guest updated successfully",
                "guest" to mapOf(
                    "name" to updatedGuest.name,
                    "profession" to updatedGuest.profession,
                    "referrer" to (updatedGuest.referrer ?: ""),
                    "eventDate" to (updatedGuest.eventDate ?: "")
                )
            ))
        } else {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf(
                "status" to "error",
                "message" to "Guest not found"
            ))
        }
    }

    @DeleteMapping("/api/guests/{name}")
    @Operation(summary = "Delete a guest")
    fun deleteGuest(@PathVariable name: String): ResponseEntity<Map<String, String>> {
        val deleted = try {
            databaseMemberService.deleteGuest(name)
        } catch (e: Exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(mapOf("status" to "error", "message" to "資料庫暫時無法連線，無法刪除嘉賓。"))
        }
        return if (deleted) {
            attendanceWebSocketHandler?.broadcast(mapOf("type" to "guest_registry_updated"))
            ResponseEntity.ok(mapOf("status" to "success", "message" to "Guest deleted successfully"))
        } else {
            ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("status" to "error", "message" to "Guest not found"))
        }
    }

    @PostMapping("/api/guests")
    @Operation(summary = "Create guest (registration only, no check-in)")
    fun createGuest(@RequestBody request: CreateGuestRequest): ResponseEntity<Map<String, Any>> {
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
            val created = databaseMemberService.createGuest(
                name = name,
                profession = profession,
                referrer = request.referrer?.trim()?.takeIf { it.isNotEmpty() },
                eventDate = resolvedDate
            )
            attendanceWebSocketHandler?.broadcast(mapOf("type" to "guest_registry_updated"))
            ResponseEntity.status(HttpStatus.CREATED).body(
                mapOf(
                    "status" to "success",
                    "message" to "Guest created successfully",
                    "guest" to mapOf(
                        "name" to created.name,
                        "profession" to created.profession,
                        "referrer" to (created.referrer ?: ""),
                        "eventDate" to (created.eventDate ?: "")
                    )
                )
            )
        } catch (e: Exception) {
            ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(
                mapOf("status" to "error", "message" to "資料庫暫時無法連線，無法新增嘉賓。")
            )
        }
    }
}
