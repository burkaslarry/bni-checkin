package com.example.bnianchorcheckinbackend

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
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
        ChapterService.validateNewAdminPassword("longenough12")
        assertThrows(IllegalArgumentException::class.java) {
            ChapterService.validateNewAdminPassword("root1234")
        }
        assertThrows(IllegalArgumentException::class.java) {
            ChapterService.validateNewAdminPassword("ROOT1234")
        }
    }

    @Test
    fun `bcrypt round-trip and legacy MD5 still verify`() {
        val service = ChapterService(org.mockito.Mockito.mock(com.example.bnianchorcheckinbackend.repositories.ChapterRepository::class.java))
        val bcrypt = service.hashPassword("longenough12")
        assertTrue(bcrypt.length >= 4 && bcrypt[0] == '$' && bcrypt[1] == '2')
        assertTrue(service.passwordMatches("longenough12", bcrypt))
        assertFalse(service.passwordMatches("wrong-password", bcrypt))
        assertTrue(service.passwordMatches("root1234", "aabb2100033f0352fe7458e412495148"))
        assertTrue(service.isLegacyMd5Hash("aabb2100033f0352fe7458e412495148"))
        assertFalse(service.isLegacyMd5Hash(bcrypt))
    }

    @Test
    fun `md5 of known password matches seed hash for root1234`() {
        val digest = MessageDigest.getInstance("MD5").digest("root1234".toByteArray(Charsets.UTF_8))
        val hex = String.format("%032x", BigInteger(1, digest))
        assertEquals("aabb2100033f0352fe7458e412495148", hex)
    }
}
