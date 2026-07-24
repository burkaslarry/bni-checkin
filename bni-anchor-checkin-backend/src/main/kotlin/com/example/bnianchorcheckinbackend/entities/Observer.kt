package com.example.bnianchorcheckinbackend.entities

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(
    name = "bni_eventxp_observers",
    uniqueConstraints = [UniqueConstraint(columnNames = ["chapter_id", "name", "event_date"])]
)
data class Observer(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "chapter_id", nullable = false)
    var chapterId: Int = 1,

    @Column(nullable = false)
    var name: String,

    @Column(nullable = false)
    var profession: String,

    @Column(name = "event_date", nullable = false)
    var eventDate: String,

    @Column(nullable = false)
    var attended: Boolean = false,

    @Column(name = "created_at", insertable = false, updatable = false)
    var createdAt: OffsetDateTime? = null,

    @Column(name = "updated_at", insertable = false, updatable = false)
    var updatedAt: OffsetDateTime? = null
)
