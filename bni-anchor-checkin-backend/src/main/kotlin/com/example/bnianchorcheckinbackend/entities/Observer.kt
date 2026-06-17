package com.example.bnianchorcheckinbackend.entities

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(
    name = "bni_anchor_observers",
    uniqueConstraints = [UniqueConstraint(columnNames = ["name", "event_date"])]
)
data class Observer(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

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
