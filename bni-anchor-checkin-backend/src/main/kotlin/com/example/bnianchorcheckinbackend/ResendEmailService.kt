package com.example.bnianchorcheckinbackend

import com.fasterxml.jackson.databind.ObjectMapper
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.Base64

/**
 * Thin Resend HTTP client for sending emails with optional Base64 attachments.
 * Requires [resend.api.key] (env RESEND_API_KEY). Does not log the API key.
 */
@Service
@ConditionalOnProperty(name = ["spring.datasource.url"])
class ResendEmailService(
    @Value("\${resend.api.key:}") private val apiKey: String,
    @Value("\${resend.api.url:https://api.resend.com/emails}") private val apiUrl: String,
    private val objectMapper: ObjectMapper
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(15))
        .build()

    data class Attachment(
        val filename: String,
        val bytes: ByteArray,
        val contentType: String = "text/csv"
    )

    fun isConfigured(): Boolean = apiKey.isNotBlank()

    /**
     * Send email via Resend. Throws [IllegalStateException] if API key missing or Resend returns error.
     */
    fun sendEmail(
        from: String,
        to: List<String>,
        subject: String,
        textBody: String,
        attachments: List<Attachment> = emptyList()
    ): String {
        if (apiKey.isBlank()) {
            throw IllegalStateException("RESEND_API_KEY is not configured")
        }
        if (to.isEmpty() || to.any { it.isBlank() }) {
            throw IllegalArgumentException("Email recipient (to) is required")
        }

        val payload = linkedMapOf<String, Any>(
            "from" to from,
            "to" to to,
            "subject" to subject,
            "text" to textBody
        )
        if (attachments.isNotEmpty()) {
            payload["attachments"] = attachments.map { att ->
                mapOf(
                    "filename" to att.filename,
                    "content" to Base64.getEncoder().encodeToString(att.bytes),
                    "content_type" to att.contentType
                )
            }
        }

        val bodyJson = objectMapper.writeValueAsString(payload)
        val request = HttpRequest.newBuilder()
            .uri(URI.create(apiUrl))
            .timeout(Duration.ofSeconds(45))
            .header("Authorization", "Bearer $apiKey")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofString())
        if (response.statusCode() !in 200..299) {
            val snippet = response.body().take(400)
            log.error("Resend API error HTTP {}: {}", response.statusCode(), snippet)
            throw IllegalStateException("Resend API error (${response.statusCode()}): $snippet")
        }
        log.info("Resend email accepted (HTTP {}) to={}", response.statusCode(), to.joinToString(","))
        return response.body()
    }
}
