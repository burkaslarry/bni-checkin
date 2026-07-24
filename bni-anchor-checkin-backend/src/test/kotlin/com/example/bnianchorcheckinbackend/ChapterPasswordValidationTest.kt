package com.example.bnianchorcheckinbackend

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.math.BigInteger
import java.security.MessageDigest

class ChapterPasswordValidationTest {

    @Test
    fun `validateNewAdminPassword rejects blank and short passwords`() {
        assertThrows(IllegalArgumentException::class.java) {
            ChapterService.validateNewAdminPassword("")
        }
        assertThrows(IllegalArgumentException::class.java) {
            ChapterService.validateNewAdminPassword("short")
        }
        ChapterService.validateNewAdminPassword("longenough")
    }

    @Test
    fun `md5 of known password matches seed hash for root1234`() {
        val digest = MessageDigest.getInstance("MD5").digest("root1234".toByteArray(Charsets.UTF_8))
        val hex = String.format("%032x", BigInteger(1, digest))
        assertEquals("aabb2100033f0352fe7458e412495148", hex)
    }
}
