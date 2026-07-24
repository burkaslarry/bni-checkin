package com.example.bnianchorcheckinbackend.repositories

import com.example.bnianchorcheckinbackend.entities.Chapter
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.Optional

@Repository
interface ChapterRepository : JpaRepository<Chapter, Long> {
    fun findByTagIgnoreCase(tag: String): Optional<Chapter>
    fun findByAdminLoginIgnoreCase(adminLogin: String): Optional<Chapter>
    fun findAllByStatusOrderByTagAsc(status: String): List<Chapter>
}
