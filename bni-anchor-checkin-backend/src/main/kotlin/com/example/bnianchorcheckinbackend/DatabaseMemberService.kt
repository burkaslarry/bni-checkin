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
    private val attendanceRepository: AttendanceRepository,
    private val chapterService: ChapterService
) {

    fun getAllMembers(chapterTag: String? = null): List<Map<String, Any>> {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val groupByName = professionGroupRepository.findAll().associate { it.code to it.name }
        return memberRepository.findAllByChapterIdOrderByNameAsc(chapterId).map { member ->
            mapOf(
                "id" to (member.id!!.toInt()),
                "name" to member.name,
                "domain" to (member.profession ?: ""),
                "standing" to member.standing.name,
                "professionCode" to member.professionCode.toString(),
                "professionGroupName" to (groupByName[member.professionCode] ?: ""),
                "membershipId" to (member.membershipId ?: ""),
                "position" to member.position,
                "chapterId" to member.chapterId
            )
        }
    }

    fun getAllGuests(chapterTag: String? = null): List<Map<String, String>> {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        return guestRepository.findAllByChapterIdOrderByNameAsc(chapterId).map { guest ->
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
    fun getGuestsForEventDate(eventDate: String, chapterTag: String? = null): List<Map<String, String>> {
        if (eventDate.isBlank()) return emptyList()
        val chapterId = chapterService.resolveChapterId(chapterTag)
        return guestRepository.findByChapterIdAndEventDate(chapterId, eventDate).map { guest ->
            mapOf(
                "name" to guest.name,
                "profession" to guest.profession,
                "referrer" to (guest.referrer ?: ""),
                "eventDate" to (guest.eventDate ?: "")
            )
        }
    }

    fun getMemberByName(name: String, chapterTag: String? = null): MemberData? {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val member = memberRepository.findByChapterIdAndNameIgnoreCase(chapterId, name).orElse(null) ?: return null
        return MemberData(
            name = member.name,
            domain = member.profession ?: "",
            type = "Member",
            membershipId = member.membershipId,
            referrer = null,
            standing = member.standing
        )
    }

    fun getGuestByName(name: String, chapterTag: String? = null): GuestData? {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val guest = guestRepository.findByChapterIdAndNameIgnoreCase(chapterId, name).orElse(null) ?: return null
        return GuestData(
            name = guest.name,
            profession = guest.profession,
            referrer = guest.referrer ?: ""
        )
    }

    fun isValidProfessionCode(code: String): Boolean =
        professionGroupRepository.existsById(code.uppercase().take(1))

    @Transactional
    fun updateMemberStanding(name: String, standing: MemberStanding, chapterTag: String? = null): Member? {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val member = memberRepository.findByChapterIdAndNameIgnoreCase(chapterId, name).orElse(null) ?: return null
        member.standing = standing
        return memberRepository.save(member)
    }

    @Transactional
    fun updateMemberById(
        memberId: Long,
        newName: String? = null,
        profession: String? = null,
        standing: MemberStanding? = null,
        professionCode: String? = null
    ): Member? {
        val member = memberRepository.findById(memberId).orElse(null) ?: return null
        return applyMemberChanges(member, newName, profession, standing, professionCode)
    }

    @Transactional
    fun updateMember(
        name: String,
        newName: String? = null,
        profession: String? = null,
        standing: MemberStanding? = null,
        professionCode: String? = null,
        chapterTag: String? = null
    ): Member? {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val member = memberRepository.findByChapterIdAndNameIgnoreCase(chapterId, name).orElse(null) ?: return null
        return applyMemberChanges(member, newName, profession, standing, professionCode)
    }

    private fun applyMemberChanges(
        member: Member,
        newName: String?,
        profession: String?,
        standing: MemberStanding?,
        professionCode: String?
    ): Member {
        if (newName != null && !newName.equals(member.name, ignoreCase = true)) {
            if (memberRepository.existsByChapterIdAndNameIgnoreCase(member.chapterId, newName)) {
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
        position: String = "Member",
        chapterTag: String? = null
    ): Member {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        if (memberRepository.existsByChapterIdAndNameIgnoreCase(chapterId, name)) {
            throw IllegalArgumentException("Member already exists")
        }
        return memberRepository.save(
            Member(
                chapterId = chapterId,
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
    fun deleteMemberById(memberId: Long): Boolean {
        val member = memberRepository.findById(memberId).orElse(null) ?: return false
        attendanceRepository.deleteByMemberId(member.id!!.toInt())
        memberRepository.delete(member)
        return true
    }

    @Transactional
    fun deleteMember(name: String, chapterTag: String? = null): Boolean {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val member = memberRepository.findByChapterIdAndNameIgnoreCase(chapterId, name).orElse(null) ?: return false
        attendanceRepository.deleteByMemberId(member.id!!.toInt())
        memberRepository.delete(member)
        return true
    }

    @Transactional
    fun updateGuest(
        currentName: String,
        currentEventDate: String? = null,
        newName: String? = null,
        profession: String? = null,
        referrer: String? = null,
        eventDate: String? = null,
        chapterTag: String? = null
    ): Guest? {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val guest = if (!currentEventDate.isNullOrBlank()) {
            guestRepository.findByChapterIdAndNameIgnoreCaseAndEventDateTrimmed(chapterId, currentName, currentEventDate).orElse(null)
        } else {
            guestRepository.findByChapterIdAndNameIgnoreCase(chapterId, currentName).orElse(null)
        } ?: return null

        val resolvedEventDate = eventDate?.trim()?.takeIf { it.isNotEmpty() } ?: guest.eventDate
        if (newName != null && !newName.equals(guest.name, ignoreCase = true)) {
            if (!resolvedEventDate.isNullOrBlank()) {
                val duplicate = guestRepository
                    .findByChapterIdAndNameIgnoreCaseAndEventDateTrimmed(chapterId, newName, resolvedEventDate)
                    .orElse(null)
                if (duplicate != null && duplicate.id != guest.id) {
                    throw IllegalArgumentException("Guest already exists for this event date")
                }
            }
            guest.name = newName
        }
        profession?.let { guest.profession = it }
        referrer?.let { guest.referrer = it }
        eventDate?.let { guest.eventDate = it }
        return guestRepository.save(guest)
    }

    @Transactional
    fun createGuest(name: String, profession: String, referrer: String?, eventDate: String, chapterTag: String? = null): Guest {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val existing = guestRepository.findByChapterIdAndNameIgnoreCaseAndEventDateTrimmed(chapterId, name, eventDate).orElse(null)
        if (existing != null) {
            existing.profession = profession
            existing.referrer = referrer
            return guestRepository.save(existing)
        }
        return guestRepository.save(
            Guest(
                chapterId = chapterId,
                name = name,
                profession = profession,
                referrer = referrer,
                eventDate = eventDate
            )
        )
    }

    @Transactional
    fun deleteGuest(name: String, chapterTag: String? = null): Boolean {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val guest = guestRepository.findByChapterIdAndNameIgnoreCase(chapterId, name).orElse(null) ?: return false
        guestRepository.delete(guest)
        return true
    }

    fun getAllObservers(chapterTag: String? = null): List<Map<String, Any>> {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        return observerRepository.findAllByChapterIdOrderByNameAsc(chapterId).map { toObserverMap(it) }
    }

    fun getObserversForEventDate(eventDate: String, chapterTag: String? = null): List<Map<String, Any>> {
        if (eventDate.isBlank()) return emptyList()
        val chapterId = chapterService.resolveChapterId(chapterTag)
        return observerRepository.findByChapterIdAndEventDateTrimmed(chapterId, eventDate).map { toObserverMap(it) }
    }

    private fun toObserverMap(observer: Observer): Map<String, Any> = mapOf(
        "id" to (observer.id!!.toInt()),
        "name" to observer.name,
        "profession" to observer.profession,
        "eventDate" to observer.eventDate,
        "attended" to observer.attended
    )

    @Transactional
    fun createObserver(name: String, profession: String, eventDate: String, chapterTag: String? = null): Observer {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val existing = observerRepository.findByChapterIdAndNameIgnoreCaseAndEventDate(chapterId, name, eventDate).orElse(null)
        if (existing != null) {
            existing.profession = profession
            return observerRepository.save(existing)
        }
        return observerRepository.save(
            Observer(
                chapterId = chapterId,
                name = name,
                profession = profession,
                eventDate = eventDate,
                attended = false
            )
        )
    }

    @Transactional
    fun updateObserver(name: String, profession: String?, eventDate: String?, chapterTag: String? = null): Observer? {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val observer = observerRepository.findByChapterIdAndNameIgnoreCase(chapterId, name).orElse(null) ?: return null
        profession?.let { observer.profession = it }
        eventDate?.let { observer.eventDate = it }
        return observerRepository.save(observer)
    }

    @Transactional
    fun deleteObserver(name: String, chapterTag: String? = null): Boolean {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val observer = observerRepository.findByChapterIdAndNameIgnoreCase(chapterId, name).orElse(null) ?: return false
        observerRepository.delete(observer)
        return true
    }

    @Transactional
    fun markObserverAttendance(observerId: Int?, observerName: String, eventDate: String, chapterTag: String? = null): Observer {
        val chapterId = chapterService.resolveChapterId(chapterTag)
        val observer = when {
            observerId != null -> observerRepository.findById(observerId.toLong()).orElse(null)?.takeIf { it.chapterId == chapterId }
            else -> observerRepository.findByChapterIdAndNameIgnoreCaseAndEventDate(chapterId, observerName.trim(), eventDate).orElse(null)
        } ?: throw IllegalArgumentException("觀察員不存在 Observer not found")

        if (observer.attended) {
            throw IllegalStateException("${observer.name} 已經簽到")
        }
        observer.attended = true
        return observerRepository.save(observer)
    }
}
