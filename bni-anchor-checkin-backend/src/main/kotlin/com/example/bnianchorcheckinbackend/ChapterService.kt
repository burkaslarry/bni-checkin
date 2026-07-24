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
    val status: String
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

    fun toInfo(chapter: Chapter): ChapterInfo =
        ChapterInfo(
            id = chapter.id!!.toInt(),
            tag = chapter.tag,
            displayName = chapter.displayName,
            timezone = chapter.timezone,
            status = chapter.status
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
        if (chapter.tag.equals("anchor", ignoreCase = true)) {
            throw IllegalArgumentException("Use /admin for BNI Anchor (do not use client login)")
        }
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
}
