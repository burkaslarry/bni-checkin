package com.example.bnianchorcheckinbackend.entities

import jakarta.persistence.*
import java.time.LocalDate
import java.time.OffsetDateTime

/**
 * Snapshot of one uploaded Member Traffic Light Excel (table `bni_traffic_light_reports`).
 * [rowsJson] is a JSON array of [com.example.bnianchorcheckinbackend.TrafficLightRowDto].
 * [greenGoal]/[yellowGoal] are Excel chapter KPI banners, not per-member cutoffs.
 */
@Entity
@Table(name = "bni_traffic_light_reports")
data class TrafficLightReport(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "chapter_id", nullable = false)
    var chapterId: Int = 1,

    @Column(name = "period_label", nullable = false)
    var periodLabel: String,

    @Column(name = "period_start")
    var periodStart: LocalDate? = null,

    @Column(name = "period_end")
    var periodEnd: LocalDate? = null,

    @Column(name = "green_goal", nullable = false)
    var greenGoal: Int = 60,

    @Column(name = "yellow_goal", nullable = false)
    var yellowGoal: Int = 40,

    @Column
    var filename: String? = null,

    @Column(name = "rows_json", nullable = false, columnDefinition = "TEXT")
    var rowsJson: String,

    @Column(name = "created_at", insertable = false, updatable = false)
    var createdAt: OffsetDateTime? = null
)
