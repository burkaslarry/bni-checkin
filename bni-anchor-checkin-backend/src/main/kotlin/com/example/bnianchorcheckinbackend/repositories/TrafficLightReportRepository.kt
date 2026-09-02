package com.example.bnianchorcheckinbackend.repositories

import com.example.bnianchorcheckinbackend.entities.TrafficLightReport
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

/**
 * Traffic Light snapshots. Latest-by-id is an indexed lookup on `chapter_id` + insert order
 * (no full table scan expected; one row per upload).
 */
@Repository
interface TrafficLightReportRepository : JpaRepository<TrafficLightReport, Long> {
    /** Newest snapshot for a chapter (highest `id`). */
    fun findTopByChapterIdOrderByIdDesc(chapterId: Int): TrafficLightReport?

    /** Upload history, newest first. Full `rows_json` is loaded; keep the list short in the service. */
    fun findAllByChapterIdOrderByIdDesc(chapterId: Int): List<TrafficLightReport>

    fun findByIdAndChapterId(id: Long, chapterId: Int): TrafficLightReport?
}
