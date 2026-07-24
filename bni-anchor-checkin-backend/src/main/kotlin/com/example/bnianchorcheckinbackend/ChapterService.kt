package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.Chapter
import com.example.bnianchorcheckinbackend.repositories.ChapterRepository
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import java.math.BigInteger
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

data class ChapterInfo(
    val id: Int,
    val tag: String,
    val displayName: String,
    val timezone: String,
    val status: String,
    /** Preferred meeting weekday: 0=Sunday … 6=Saturday (JS Date.getDay). */
    val meetingWeekday: Int = 4
)

data class ClientLoginResult(
    val token: String,
    val chapter: ChapterInfo,
    val expiresAtEpochMs: Long
)

@Service
@ConditionalOnProperty(name = ["spring.datasource.url"])
class ChapterService(
    private val chapterRepository: ChapterRepository
) {
    private val sessions = ConcurrentHashMap<String, Session>()
    private val secureRandom = SecureRandom()

    private data class Session(
        val chapterId: Long,
        val chapterTag: String,
        val expiresAtEpochMs: Long
    )

    fun reservedTags(): Set<String> =
        setOf("admin", "report", "api", "root", "public", "client")

    fun normalizeTag(raw: String?): String {
        val tag = raw?.trim()?.lowercase().orEmpty()
        if (tag.isBlank()) return "anchor"
        if (tag in reservedTags()) {
            throw IllegalArgumentException("Reserved chapter tag: $tag")
        }
        return tag
    }

    fun requireChapter(tagRaw: String?): Chapter {
        val tag = normalizeTag(tagRaw)
        return chapterRepository.findByTagIgnoreCase(tag).orElseThrow {
            IllegalArgumentException("Unknown chapter: $tag")
        }
    }

    fun resolveChapterId(tagRaw: String?): Int =
        requireChapter(tagRaw).id!!.toInt()

    /** Prefer explicit chapterId (e.g. 1 = Anchor); fall back to chapter tag. */
    fun resolveChapterId(chapterId: Int?, tagRaw: String?): Int {
        if (chapterId != null && chapterId > 0) {
            return chapterRepository.findById(chapterId.toLong()).orElseThrow {
                IllegalArgumentException("Unknown chapter id: $chapterId")
            }.id!!.toInt()
        }
        return resolveChapterId(tagRaw)
    }

    fun toInfo(chapter: Chapter): ChapterInfo =
        ChapterInfo(
            id = chapter.id!!.toInt(),
            tag = chapter.tag,
            displayName = chapter.displayName,
            timezone = chapter.timezone,
            status = chapter.status,
            meetingWeekday = chapter.meetingWeekday.coerceIn(0, 6)
        )

    fun listActiveChapters(): List<ChapterInfo> =
        chapterRepository.findAllByStatusOrderByTagAsc("active").map { toInfo(it) }

    fun md5Hex(raw: String): String {
        val digest = MessageDigest.getInstance("MD5").digest(raw.toByteArray(Charsets.UTF_8))
        return String.format("%032x", BigInteger(1, digest))
    }

    fun login(adminLogin: String, password: String): ClientLoginResult {
        val login = adminLogin.trim()
        if (login.isBlank() || password.isBlank()) {
            throw IllegalArgumentException("AdminLogin and AdminPassword are required")
        }
        val chapter = chapterRepository.findByAdminLoginIgnoreCase(login).orElse(null)
            ?: throw IllegalArgumentException("Invalid login")
        if (!chapter.status.equals("active", ignoreCase = true)) {
            throw IllegalArgumentException("Chapter is not active")
        }
        val hash = md5Hex(password)
        if (!hash.equals(chapter.adminPasswordMd5, ignoreCase = true)) {
            throw IllegalArgumentException("Invalid login or password")
        }
        val token = UUID.randomUUID().toString().replace("-", "") +
            secureRandom.nextInt(0x100000).toString(16)
        val expires = Instant.now().toEpochMilli() + 12L * 60L * 60L * 1000L
        sessions[token] = Session(chapter.id!!, chapter.tag, expires)
        return ClientLoginResult(token = token, chapter = toInfo(chapter), expiresAtEpochMs = expires)
    }

    fun resolveChapterFromSession(token: String?): Chapter? {
        if (token.isNullOrBlank()) return null
        val session = sessions[token] ?: return null
        if (session.expiresAtEpochMs < Instant.now().toEpochMilli()) {
            sessions.remove(token)
            return null
        }
        return chapterRepository.findById(session.chapterId).orElse(null)
    }

    fun logout(token: String?) {
        if (!token.isNullOrBlank()) sessions.remove(token)
    }

    /** Require a valid session belonging to the Anchor chapter. */
    fun requireAnchorSession(token: String?): Chapter {
        val chapter = resolveChapterFromSession(token)
            ?: throw IllegalArgumentException("Not authenticated")
        if (!chapter.tag.equals("anchor", ignoreCase = true)) {
            throw IllegalArgumentException("Only Anchor admin can update chapter passwords")
        }
        return chapter
    }

    /**
     * Anchor-only: set AdminPassword for a non-anchor chapter (stored as MD5).
     * @throws IllegalArgumentException on validation / unknown chapter
     */
    fun updateChapterAdminPassword(targetTagRaw: String?, newPassword: String): ChapterInfo {
        val targetTag = normalizeTag(targetTagRaw)
        if (targetTag == "anchor") {
            throw IllegalArgumentException("Cannot reset Anchor password via this endpoint")
        }
        validateNewAdminPassword(newPassword)
        val chapter = requireChapter(targetTag)
        chapter.adminPasswordMd5 = md5Hex(newPassword)
        return toInfo(chapterRepository.save(chapter))
    }

    companion object {
        const val MIN_ADMIN_PASSWORD_LENGTH = 8

        fun validateNewAdminPassword(password: String) {
            if (password.isBlank()) {
                throw IllegalArgumentException("AdminPassword is required")
            }
            if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
                throw IllegalArgumentException(
                    "AdminPassword must be at least $MIN_ADMIN_PASSWORD_LENGTH characters"
                )
            }
        }
    }
}
