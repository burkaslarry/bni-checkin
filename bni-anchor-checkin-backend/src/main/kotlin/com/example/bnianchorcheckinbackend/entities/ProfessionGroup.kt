package com.example.bnianchorcheckinbackend.entities

import jakarta.persistence.*

@Entity
@Table(name = "bni_eventxp_profession_groups")
data class ProfessionGroup(
    @Id
    @Column(name = "code", length = 1)
    val code: String,

    @Column(nullable = false, unique = true)
    var name: String,

    @Column(name = "chapter_id", nullable = false)
    var chapterId: Int = 1
)
