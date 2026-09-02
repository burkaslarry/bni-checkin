package com.example.bnianchorcheckinbackend.repositories

import com.example.bnianchorcheckinbackend.entities.Event
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.LocalDate

@Repository
interface EventRepository : JpaRepository<Event, Long> {
    fun findTopByOrderByEventDateDesc(): Event?
    fun findTopByDeletedAtIsNullOrderByEventDateDescStartTimeDesc(): Event?
    fun findTopByStatusAndIsActiveTrueAndDeletedAtIsNullOrderByEventDateAscStartTimeAsc(status: String): Event?
    fun findAllByOrderByIdDesc(): List<Event>
    fun findAllByDeletedAtIsNullOrderByIdDesc(): List<Event>
    fun findByEventDate(eventDate: LocalDate): Event?
    fun findByEventDateAndDeletedAtIsNull(eventDate: LocalDate): Event?
    fun existsByEventDateBetween(start: LocalDate, end: LocalDate): Boolean
    fun existsByEventDateBetweenAndDeletedAtIsNull(start: LocalDate, end: LocalDate): Boolean
    fun findAllByStatusAndDeletedAtIsNullOrderByEventDateAscStartTimeAsc(status: String): List<Event>
    fun findByChapterIdAndId(chapterId: Int, id: Long): Event?
    fun findTopByChapterIdAndStatusAndIsActiveTrueAndDeletedAtIsNullOrderByEventDateAscStartTimeAsc(chapterId: Int, status: String): Event?
    fun findTopByChapterIdAndDeletedAtIsNullOrderByEventDateDescStartTimeDesc(chapterId: Int): Event?
    fun findAllByChapterIdAndDeletedAtIsNullOrderByIdDesc(chapterId: Int): List<Event>
    fun findAllByChapterIdAndStatusAndDeletedAtIsNullOrderByEventDateAscStartTimeAsc(chapterId: Int, status: String): List<Event>
    fun findByChapterIdAndEventDate(chapterId: Int, eventDate: LocalDate): Event?
    fun findByChapterIdAndEventDateAndDeletedAtIsNull(chapterId: Int, eventDate: LocalDate): Event?
    fun findAllByChapterIdAndEventDateAndDeletedAtIsNullOrderByIdDesc(chapterId: Int, eventDate: LocalDate): List<Event>
    fun existsByChapterIdAndEventDateBetween(chapterId: Int, start: LocalDate, end: LocalDate): Boolean
    fun existsByChapterIdAndEventDateBetweenAndDeletedAtIsNull(chapterId: Int, start: LocalDate, end: LocalDate): Boolean
}
