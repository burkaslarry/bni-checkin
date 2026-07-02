package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.repositories.GuestRepository
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.concurrent.ConcurrentHashMap

data class GuestData(
    val name: String,
    val profession: String,
    val referrer: String,
    val source: String = "guest",
    val eventDate: String? = null
)

@Service
class GuestService(
    @Autowired(required = false) private val guestRepository: GuestRepository? = null
) {

    private val bulkImportedGuests = ConcurrentHashMap<String, GuestData>()

    fun getGuestByName(name: String): GuestData? =
        bulkImportedGuests.values.find { it.name.equals(name, ignoreCase = true) }

    fun getAllGuestsWithDomain(): List<Map<String, String>> {
        return bulkImportedGuests.values
            .map {
                mapOf(
                    "name" to it.name,
                    "profession" to it.profession,
                    "referrer" to it.referrer,
                    "type" to "guest",
                    "eventDate" to (it.eventDate ?: "")
                )
            }
            .sortedBy { it["name"] }
    }

    private fun normalizeEventDate(s: String?): String? {
        val t = s?.trim() ?: return null
        if (t.isBlank()) return null
        return when {
            t.length == 8 && t.all { it.isDigit() } -> "${t.take(4)}-${t.takeLast(4).take(2)}-${t.takeLast(2)}"
            t.contains("-") -> t
            else -> t
        }
    }

    @Transactional
    fun addBulkImportedGuests(records: List<ImportRecord>): ImportResult {
        var inserted = 0
        val errors = mutableListOf<String>()
        for (record in records) {
            try {
                val eventDate = normalizeEventDate(record.eventDate) ?: ""
                val key = "${record.name.lowercase()}|$eventDate"
                val sampleGuest = GuestData(
                    name = record.name,
                    profession = record.profession,
                    referrer = record.referrer?.takeIf { it.isNotBlank() } ?: "",
                    source = "bulk-import",
                    eventDate = eventDate.ifBlank { null }
                )
                bulkImportedGuests[key] = sampleGuest

                if (guestRepository != null) {
                    val normalizedRecord = record.copy(eventDate = eventDate.ifBlank { record.eventDate })
                    val existing = GuestImportSupport.resolveExistingGuest(guestRepository, normalizedRecord)
                    val guestEntity = if (existing != null) {
                        existing.also { GuestImportSupport.applyGuestFields(it, normalizedRecord) }
                    } else {
                        GuestImportSupport.newGuestEntity(normalizedRecord)
                    }
                    guestRepository.save(guestEntity)
                }
                inserted++
            } catch (e: Exception) {
                errors.add("Failed to add ${record.name}: ${e.message}")
            }
        }
        return ImportResult(total = records.size, inserted = inserted, updated = 0, failed = records.size - inserted, errors = errors)
    }
}
