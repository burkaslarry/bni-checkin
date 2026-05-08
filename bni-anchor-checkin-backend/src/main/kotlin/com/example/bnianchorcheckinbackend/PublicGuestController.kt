package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.Guest
import com.example.bnianchorcheckinbackend.repositories.EventRepository
import com.example.bnianchorcheckinbackend.repositories.GuestRepository
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.time.LocalDate

data class PublicGuestCreateRequest(
    val name: String,
    val profession: String,
    val phoneNumber: String,
    val referrer: String? = null,
    val eventDate: String? = null,
    val eventId: Int? = null,
    val notes: String? = null,
    val captcha: PublicCaptchaAnswer
)

data class PublicCaptchaAnswer(
    val a: Int,
    val b: Int,
    val op: String,
    val nonce: String,
    val signature: String,
    val answer: Int
)

@RestController
@RequestMapping("/api/public")
@Tag(name = "Public Guest", description = "Public endpoints for walk-in guest registration")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = ["spring.datasource.url"])
class PublicGuestController(
    private val guestRepository: GuestRepository,
    private val eventRepository: EventRepository,
    private val captchaService: CaptchaService,
) {
    @PostMapping("/guests")
    @Operation(summary = "Create a guest for an event date (public walk-in form)")
    fun createGuest(@RequestBody request: PublicGuestCreateRequest): ResponseEntity<Map<String, Any>> {
        val name = request.name.trim()
        val profession = request.profession.trim()
        val phone = request.phoneNumber.trim()
        val referrer = request.referrer?.trim()?.takeIf { it.isNotEmpty() }
        val eventDate = request.eventDate?.trim().orEmpty()
        val eventId = request.eventId

        if (name.isEmpty() || profession.isEmpty() || phone.isEmpty() || (eventId == null && eventDate.isEmpty())) {
            return ResponseEntity.badRequest().body(mapOf("error" to "missing_required_fields"))
        }
        val resolvedEventDate = if (eventId != null) {
            val ev = eventRepository.findById(eventId.toLong()).orElse(null)
                ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to "event_not_found"))
            ev.eventDate.toString()
        } else {
            // Basic YYYY-MM-DD validation (avoid inserting junk)
            try { LocalDate.parse(eventDate).toString() } catch (_: Exception) {
                return ResponseEntity.badRequest().body(mapOf("error" to "invalid_event_date"))
            }
        }

        val c = request.captcha
        val okCaptcha = captchaService.verify(
            nonce = c.nonce,
            signature = c.signature,
            a = c.a,
            b = c.b,
            op = c.op,
            answer = c.answer
        )
        if (!okCaptcha) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(mapOf("error" to "captcha_failed"))
        }

        // Duplicate: same phone + same eventDate
        if (guestRepository.existsByPhoneNumberAndEventDate(phone, resolvedEventDate)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf("error" to "duplicate_guest_phone_event"))
        }

        /*
         * F01 -- Public guest list only (no auto check-in) --- PublicGuestController.createGuest
         * Register on guest list only; actual check-in is done elsewhere (e.g. scan / admin manual).
         */
        val saved = guestRepository.save(
            Guest(
                name = name,
                profession = profession,
                referrer = referrer,
                phoneNumber = phone,
                eventDate = resolvedEventDate,
                checkInTime = null
            )
        )

        return ResponseEntity.status(HttpStatus.CREATED).body(
            mapOf(
                "status" to "success",
                "guest" to mapOf(
                    "id" to saved.id,
                    "name" to saved.name,
                    "profession" to saved.profession,
                    "phoneNumber" to (saved.phoneNumber ?: ""),
                    "referrer" to (saved.referrer ?: ""),
                    "eventDate" to (saved.eventDate ?: "")
                )
            )
        )
    }
}

