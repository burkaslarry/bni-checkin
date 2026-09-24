package com.example.bnianchorcheckinbackend.entities

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "bni_eventxp_guests")
data class Guest(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "chapter_id", nullable = false)
    var chapterId: Int = 1,

    @Column(nullable = false)
    var name: String,

    @Column(nullable = false)
    var profession: String,

    @Column
    var referrer: String? = null,

    @Column
    var email: String? = null,

    @Column(name = "phone_number")
    var phoneNumber: String? = null,

    @Column(name = "event_date")
    var eventDate: String? = null,

    /**
     * [F003][S303]
     * Feature: Guest Registration
     * Step: Store guest row
     * Description: Leadership Team term (第 N 屆). Kept in sync with [eventDate].
     */
    @Column(name = "lt_term")
    var ltTerm: Int? = null,

    @Column(name = "check_in_time")
    var checkInTime: OffsetDateTime? = null,

    @Column(name = "created_at", insertable = false, updatable = false)
    var createdAt: OffsetDateTime? = null,

    @Column(name = "updated_at", insertable = false, updatable = false)
    var updatedAt: OffsetDateTime? = null
)
