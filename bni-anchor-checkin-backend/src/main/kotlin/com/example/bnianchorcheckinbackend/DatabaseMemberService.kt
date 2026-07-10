package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.Member
import com.example.bnianchorcheckinbackend.entities.Guest
import com.example.bnianchorcheckinbackend.entities.Observer
import com.example.bnianchorcheckinbackend.entities.MemberStanding
import com.example.bnianchorcheckinbackend.repositories.AttendanceRepository
import com.example.bnianchorcheckinbackend.repositories.MemberRepository
import com.example.bnianchorcheckinbackend.repositories.GuestRepository
import com.example.bnianchorcheckinbackend.repositories.ObserverRepository
import com.example.bnianchorcheckinbackend.repositories.ProfessionGroupRepository
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@ConditionalOnProperty(name = ["spring.datasource.url"])
class DatabaseMemberService(
    private val memberRepository: MemberRepository,
    private val guestRepository: GuestRepository,
    private val observerRepository: ObserverRepository,
    private val professionGroupRepository: ProfessionGroupRepository,
    private val attendanceRepository: AttendanceRepository
) {

    fun getAllMembers(): List<Map<String, Any>> {
        val groupByName = professionGroupRepository.findAll().associate { it.code to it.name }
        return memberRepository.findAllByOrderByNameAsc().map { member ->
            mapOf(
                "id" to (member.id!!.toInt()),
                "name" to member.name,
                "domain" to (member.profession ?: ""),
                "standing" to member.standing.name,
                "professionCode" to member.professionCode.toString(),
                "professionGroupName" to (groupByName[member.professionCode] ?: "")
            )
        }
    }

    fun getAllGuests(): List<Map<String, String>> {
        return guestRepository.findAllByOrderByNameAsc().map { guest ->
            mapOf(
                "name" to guest.name,
                "profession" to guest.profession,
                "referrer" to (guest.referrer ?: ""),
                "eventDate" to (guest.eventDate ?: "")
            )
        }
    }

    /**
     * Guests for a specific event date (for onsite support: check-in form, export). Used when eventDate query param is provided.
     */
    fun getGuestsForEventDate(eventDate: String): List<Map<String, String>> {
        if (eventDate.isBlank()) return emptyList()
        return guestRepository.findByEventDate(eventDate).map { guest ->
            mapOf(
                "name" to guest.name,
                "profession" to guest.profession,
                "referrer" to (guest.referrer ?: ""),
                "eventDate" to (guest.eventDate ?: "")
            )
        }
    }

    fun getMemberByName(name: String): MemberData? {
        val member = memberRepository.findByNameIgnoreCase(name).orElse(null) ?: return null
        return MemberData(
            name = member.name,
            domain = member.profession ?: "",
            type = "Member",
            membershipId = member.membershipId,
            referrer = null,
            standing = member.standing
        )
    }

    fun getGuestByName(name: String): GuestData? {
        val guest = guestRepository.findByNameIgnoreCase(name).orElse(null) ?: return null
        return GuestData(
            name = guest.name,
            profession = guest.profession,
            referrer = guest.referrer ?: ""
        )
    }

    fun isValidProfessionCode(code: String): Boolean =
        professionGroupRepository.existsById(code.uppercase().take(1))

    @Transactional
    fun updateMemberStanding(name: String, standing: MemberStanding): Member? {
        val member = memberRepository.findByNameIgnoreCase(name).orElse(null) ?: return null
        member.standing = standing
        return memberRepository.save(member)
    }

    @Transactional
    fun updateMember(
        name: String,
        newName: String? = null,
        profession: String? = null,
        standing: MemberStanding? = null,
        professionCode: String? = null
    ): Member? {
        val member = memberRepository.findByNameIgnoreCase(name).orElse(null) ?: return null
        if (newName != null && !newName.equals(member.name, ignoreCase = true)) {
            if (memberRepository.existsByNameIgnoreCase(newName)) {
                throw IllegalArgumentException("Member already exists")
            }
            member.name = newName
        }
        if (profession != null) {
            member.profession = profession
        }
        if (standing != null) {
            member.standing = standing
        }
        if (professionCode != null) {
            val code = professionCode.uppercase().take(1)
            if (!isValidProfessionCode(code)) {
                throw IllegalArgumentException("Invalid profession code")
            }
            member.professionCode = code
        }
        return memberRepository.save(member)
    }

    @Transactional
    fun createMember(
        name: String,
        profession: String,
        standing: MemberStanding = MemberStanding.GREEN,
        professionCode: String = "A",
        membershipId: String? = null,
        position: String = "Member"
    ): Member {
        if (memberRepository.existsByNameIgnoreCase(name)) {
            throw IllegalArgumentException("Member already exists")
        }
        return memberRepository.save(
            Member(
                name = name,
                profession = profession,
                professionCode = professionCode.uppercase().take(1).ifBlank { "A" },
                position = position.ifBlank { "Member" },
                membershipId = membershipId?.trim()?.takeIf { it.isNotEmpty() },
                standing = standing
            )
        )
    }

    @Transactional
    fun deleteMember(name: String): Boolean {
        val member = memberRepository.findByNameIgnoreCase(name).orElse(null) ?: return false
        attendanceRepository.deleteByMemberId(member.id!!.toInt())
        memberRepository.delete(member)
        return true
    }

    @Transactional
    fun updateGuest(name: String, profession: String?, referrer: String?, eventDate: String?): Guest? {
        val guest = guestRepository.findByNameIgnoreCase(name).orElse(null) ?: return null
        profession?.let { guest.profession = it }
        referrer?.let { guest.referrer = it }
        eventDate?.let { guest.eventDate = it }
        return guestRepository.save(guest)
    }

    @Transactional
    fun createGuest(name: String, profession: String, referrer: String?, eventDate: String): Guest {
        val existing = guestRepository.findByNameIgnoreCaseAndEventDate(name, eventDate).orElse(null)
        if (existing != null) {
            existing.profession = profession
            existing.referrer = referrer
            return guestRepository.save(existing)
        }
        return guestRepository.save(
            Guest(
                name = name,
                profession = profession,
                referrer = referrer,
                eventDate = eventDate
            )
        )
    }

    @Transactional
    fun deleteGuest(name: String): Boolean {
        val guest = guestRepository.findByNameIgnoreCase(name).orElse(null) ?: return false
        guestRepository.delete(guest)
        return true
    }

    fun getAllObservers(): List<Map<String, Any>> {
        return observerRepository.findAllByOrderByNameAsc().map { toObserverMap(it) }
    }

    fun getObserversForEventDate(eventDate: String): List<Map<String, Any>> {
        if (eventDate.isBlank()) return emptyList()
        return observerRepository.findByEventDateTrimmed(eventDate).map { toObserverMap(it) }
    }

    private fun toObserverMap(observer: Observer): Map<String, Any> = mapOf(
        "id" to (observer.id!!.toInt()),
        "name" to observer.name,
        "profession" to observer.profession,
        "eventDate" to observer.eventDate,
        "attended" to observer.attended
    )

    @Transactional
    fun createObserver(name: String, profession: String, eventDate: String): Observer {
        val existing = observerRepository.findByNameIgnoreCaseAndEventDate(name, eventDate).orElse(null)
        if (existing != null) {
            existing.profession = profession
            return observerRepository.save(existing)
        }
        return observerRepository.save(
            Observer(
                name = name,
                profession = profession,
                eventDate = eventDate,
                attended = false
            )
        )
    }

    @Transactional
    fun updateObserver(name: String, profession: String?, eventDate: String?): Observer? {
        val observer = observerRepository.findByNameIgnoreCase(name).orElse(null) ?: return null
        profession?.let { observer.profession = it }
        eventDate?.let { observer.eventDate = it }
        return observerRepository.save(observer)
    }

    @Transactional
    fun deleteObserver(name: String): Boolean {
        val observer = observerRepository.findByNameIgnoreCase(name).orElse(null) ?: return false
        observerRepository.delete(observer)
        return true
    }

    @Transactional
    fun markObserverAttendance(observerId: Int?, observerName: String, eventDate: String): Observer {
        val observer = when {
            observerId != null -> observerRepository.findById(observerId.toLong()).orElse(null)
            else -> observerRepository.findByNameIgnoreCaseAndEventDate(observerName.trim(), eventDate).orElse(null)
        } ?: throw IllegalArgumentException("觀察員不存在 Observer not found")

        if (observer.attended) {
            throw IllegalStateException("${observer.name} 已經簽到")
        }
        observer.attended = true
        return observerRepository.save(observer)
    }
}
