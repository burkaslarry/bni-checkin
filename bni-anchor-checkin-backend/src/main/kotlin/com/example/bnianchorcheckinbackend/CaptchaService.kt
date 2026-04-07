package com.example.bnianchorcheckinbackend

import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.random.Random

data class CaptchaChallenge(
    val a: Int,
    val b: Int,
    val op: String = "+",
    val nonce: String,
    val signature: String
)

/**
 * Issues and verifies a simple arithmetic CAPTCHA with server-side integrity.
 *
 * Design:
 * - Server issues {a,b,nonce,signature}; client submits answer + nonce + signature.
 * - Signature is HMAC(secret, "nonce|a|b|op") so clients cannot forge challenges.
 * - Nonce embeds issue time (epoch millis) for expiry checks.
 */
@Service
class CaptchaService(
    @Value("\${captcha.secret:dev-captcha-secret}") private val secret: String,
    @Value("\${captcha.ttlSeconds:600}") private val ttlSeconds: Long
) {
    fun issue(): CaptchaChallenge {
        val a = Random.nextInt(1, 10)
        val b = Random.nextInt(1, 10)
        val op = "+"
        val nonce = "${Instant.now().toEpochMilli()}-${Random.nextLong().toString(16)}"
        val signature = sign(nonce, a, b, op)
        return CaptchaChallenge(a = a, b = b, op = op, nonce = nonce, signature = signature)
    }

    fun verify(nonce: String, signature: String, a: Int, b: Int, op: String, answer: Int): Boolean {
        if (nonce.isBlank() || signature.isBlank()) return false
        if (!isFresh(nonce)) return false
        val expectedSig = sign(nonce, a, b, op)
        if (!constantTimeEquals(expectedSig, signature)) return false
        val expectedAnswer = when (op) {
            "+" -> a + b
            else -> return false
        }
        return answer == expectedAnswer
    }

    private fun isFresh(nonce: String): Boolean {
        val tsPart = nonce.substringBefore("-", "")
        val issuedAt = tsPart.toLongOrNull() ?: return false
        val now = Instant.now().toEpochMilli()
        return (now - issuedAt) in 0..(ttlSeconds * 1000)
    }

    private fun sign(nonce: String, a: Int, b: Int, op: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        val payload = "$nonce|$a|$b|$op".toByteArray(Charsets.UTF_8)
        val raw = mac.doFinal(payload)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw)
    }

    private fun constantTimeEquals(a: String, b: String): Boolean {
        if (a.length != b.length) return false
        var result = 0
        for (i in a.indices) {
            result = result or (a[i].code xor b[i].code)
        }
        return result == 0
    }
}

