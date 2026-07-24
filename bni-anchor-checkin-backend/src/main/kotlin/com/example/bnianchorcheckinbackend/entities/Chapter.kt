package com.example.bnianchorcheckinbackend.entities

import jakarta.persistence.*
import java.time.OffsetDateTime

@Entity
@Table(name = "bni_eventxp_chapters")
data class Chapter(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, unique = true)
    var tag: String,

    @Column(name = "display_name", nullable = false)
    var displayName: String,

    @Column(name = "admin_login", nullable = false, unique = true)
    var adminLogin: String,

    @Column(name = "admin_password_md5", nullable = false)
    var adminPasswordMd5: String,

    @Column(nullable = false)
    var timezone: String = "Asia/Hong_Kong",

    @Column(nullable = false)
    var status: String = "active",

    @Column(name = "created_at", insertable = false, updatable = false)
    var createdAt: OffsetDateTime? = null,

    @Column(name = "updated_at", insertable = false, updatable = false)
    var updatedAt: OffsetDateTime? = null
)
