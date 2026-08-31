package com.example.bnianchorcheckinbackend.repositories

import com.example.bnianchorcheckinbackend.entities.TrafficLightReport
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface TrafficLightReportRepository : JpaRepository<TrafficLightReport, Long> {
    fun findTopByChapterIdOrderByIdDesc(chapterId: Int): TrafficLightReport?
}
