package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.Guest
import com.example.bnianchorcheckinbackend.repositories.GuestRepository

/** Shared guest CSV import helpers (bulk import + in-memory fallback). */
object GuestImportSupport {
    private val placeholderPhones = setOf("12345678", "87654321", "00000000")

    fun normalizeEventDate(raw: String?): String? {
        val t = raw?.trim().orEmpty()
        if (t.isBlank()) return null
        return when {
            t.length == 8 && t.all { it.isDigit() } ->
                "${t.take(4)}-${t.substring(4, 6)}-${t.takeLast(2)}"
            else -> t
        }
    }

    /** Placeholder phones from templates are stored as null so multiple guests can share a row. */
    fun sanitizeGuestPhone(raw: String?): String? {
        val p = raw?.trim().orEmpty()
        if (p.isBlank() || placeholderPhones.contains(p)) return null
        return p
    }

    fun resolveExistingGuest(guestRepository: GuestRepository, record: ImportRecord, chapterId: Int = 1): Guest? {
        val name = record.name.trim()
        val eventDate = normalizeEventDate(record.eventDate)
        if (!eventDate.isNullOrBlank()) {
            guestRepository.findByChapterIdAndNameIgnoreCaseAndEventDateTrimmed(chapterId, name, eventDate).orElse(null)?.let { return it }
        }
        return guestRepository.findByChapterIdAndNameIgnoreCase(chapterId, name).orElse(null)
    }

    fun applyGuestFields(guest: Guest, record: ImportRecord) {
        guest.profession = record.profession
        guest.referrer = record.referrer?.trim()?.takeIf { it.isNotBlank() }
        guest.email = record.email?.trim()?.takeIf { it.isNotBlank() }
        guest.phoneNumber = sanitizeGuestPhone(record.phoneNumber)
        guest.eventDate = normalizeEventDate(record.eventDate)
    }

    fun newGuestEntity(record: ImportRecord, chapterId: Int = 1): Guest =
        Guest(
            chapterId = chapterId,
            name = record.name.trim(),
            profession = record.profession,
            referrer = record.referrer?.trim()?.takeIf { it.isNotBlank() },
            email = record.email?.trim()?.takeIf { it.isNotBlank() },
            phoneNumber = sanitizeGuestPhone(record.phoneNumber),
            eventDate = normalizeEventDate(record.eventDate)
        )
}
