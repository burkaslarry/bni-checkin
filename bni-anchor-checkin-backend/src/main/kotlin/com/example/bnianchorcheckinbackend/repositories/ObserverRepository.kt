package com.example.bnianchorcheckinbackend.repositories

import com.example.bnianchorcheckinbackend.entities.Observer
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.util.Optional

@Repository
interface ObserverRepository : JpaRepository<Observer, Long> {
    fun findByEventDate(eventDate: String): List<Observer>
    fun findAllByOrderByNameAsc(): List<Observer>
    fun findByNameIgnoreCase(name: String): Optional<Observer>
    fun findByNameIgnoreCaseAndEventDate(name: String, eventDate: String): Optional<Observer>

    @Query("SELECT o FROM Observer o WHERE TRIM(o.eventDate) = TRIM(:eventDate) ORDER BY o.name ASC")
    fun findByEventDateTrimmed(@Param("eventDate") eventDate: String): List<Observer>
}
