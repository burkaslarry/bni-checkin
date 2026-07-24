package com.example.bnianchorcheckinbackend.repositories

import com.example.bnianchorcheckinbackend.entities.Guest
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.util.Optional

@Repository
interface GuestRepository : JpaRepository<Guest, Long> {
    fun findByName(name: String): Optional<Guest>
    fun findByNameIgnoreCase(name: String): Optional<Guest>
    fun findByNameIgnoreCaseAndEventDate(name: String, eventDate: String): Optional<Guest>
    fun existsByNameIgnoreCase(name: String): Boolean
    fun existsByPhoneNumberAndEventDate(phoneNumber: String, eventDate: String): Boolean
    fun findAllByOrderByNameAsc(): List<Guest>
    fun findByEventDate(eventDate: String): List<Guest>
    fun findAllByChapterIdOrderByNameAsc(chapterId: Int): List<Guest>
    fun findByChapterIdAndEventDate(chapterId: Int, eventDate: String): List<Guest>
    fun findByChapterIdAndNameIgnoreCase(chapterId: Int, name: String): Optional<Guest>
    fun existsByChapterIdAndPhoneNumberAndEventDate(chapterId: Int, phoneNumber: String, eventDate: String): Boolean

    /** Match guests even when `event_date` has stray whitespace vs API `YYYY-MM-DD`. */
    @Query("SELECT g FROM Guest g WHERE TRIM(g.eventDate) = TRIM(:eventDate)")
    fun findGuestsByEventDateTrimmed(@Param("eventDate") eventDate: String): List<Guest>
    @Query("SELECT g FROM Guest g WHERE g.chapterId = :chapterId AND TRIM(g.eventDate) = TRIM(:eventDate)")
    fun findGuestsByChapterIdAndEventDateTrimmed(@Param("chapterId") chapterId: Int, @Param("eventDate") eventDate: String): List<Guest>

    fun findAllByCheckInTimeIsNotNull(): List<Guest>
    fun findAllByChapterIdAndCheckInTimeIsNotNull(chapterId: Int): List<Guest>

    /** All rows for this display name (case-insensitive, trimmed); newest id first for tie-breaks. */
    @Query("SELECT g FROM Guest g WHERE LOWER(TRIM(g.name)) = LOWER(TRIM(:name)) ORDER BY g.id DESC")
    fun findAllByNameNormalized(@Param("name") name: String): List<Guest>
    @Query("SELECT g FROM Guest g WHERE g.chapterId = :chapterId AND LOWER(TRIM(g.name)) = LOWER(TRIM(:name)) ORDER BY g.id DESC")
    fun findAllByChapterIdAndNameNormalized(@Param("chapterId") chapterId: Int, @Param("name") name: String): List<Guest>

    /** Upsert key for bulk import: same guest name on the same event date. */
    @Query(
        "SELECT g FROM Guest g WHERE LOWER(TRIM(g.name)) = LOWER(TRIM(:name)) " +
            "AND TRIM(g.eventDate) = TRIM(:eventDate)"
    )
    fun findByNameIgnoreCaseAndEventDateTrimmed(
        @Param("name") name: String,
        @Param("eventDate") eventDate: String
    ): Optional<Guest>
    @Query("SELECT g FROM Guest g WHERE g.chapterId = :chapterId AND LOWER(TRIM(g.name)) = LOWER(TRIM(:name)) AND TRIM(g.eventDate) = TRIM(:eventDate)")
    fun findByChapterIdAndNameIgnoreCaseAndEventDateTrimmed(
        @Param("chapterId") chapterId: Int,
        @Param("name") name: String,
        @Param("eventDate") eventDate: String
    ): Optional<Guest>
}
