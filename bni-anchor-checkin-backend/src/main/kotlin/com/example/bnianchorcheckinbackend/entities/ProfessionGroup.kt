package com.example.bnianchorcheckinbackend.entities

import jakarta.persistence.*
import java.io.Serializable

data class ProfessionGroupId(
    val code: String = "",
    val chapterId: Int = 1
) : Serializable

@Entity
@IdClass(ProfessionGroupId::class)
@Table(name = "bni_eventxp_profession_groups")
data class ProfessionGroup(
    @Id
    @Column(name = "code", length = 1)
    val code: String,

    @Id
    @Column(name = "chapter_id", nullable = false)
    var chapterId: Int = 1,

    @Column(nullable = false)
    var name: String
)
