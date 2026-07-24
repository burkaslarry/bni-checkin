package com.example.bnianchorcheckinbackend.repositories

import com.example.bnianchorcheckinbackend.entities.ProfessionGroup
import com.example.bnianchorcheckinbackend.entities.ProfessionGroupId
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface ProfessionGroupRepository : JpaRepository<ProfessionGroup, ProfessionGroupId> {
    fun findAllByChapterIdOrderByCodeAsc(chapterId: Int): List<ProfessionGroup>
    fun existsByChapterIdAndCode(chapterId: Int, code: String): Boolean
}
