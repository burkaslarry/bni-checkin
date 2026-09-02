package com.example.bnianchorcheckinbackend

import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Require `X-Client-Token` for admin APIs. Kiosk check-in and public guest stay open.
 * Side effects: 401 JSON; logs method + path + IP (never the token).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
@ConditionalOnProperty(name = ["spring.datasource.url"])
class AdminAuthFilter(
    private val chapterService: ChapterService,
    private val objectMapper: ObjectMapper
) : OncePerRequestFilter() {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val path = request.requestURI ?: "/"
        val method = request.method ?: "GET"

        if (ApiAccessPolicy.isPublic(method, path)) {
            if (method.equals("POST", ignoreCase = true) &&
                ApiAccessPolicy.normalizePath(path) == "/api/client/login"
            ) {
                val ip = LoginRateLimiter.clientIp(request.getHeader("X-Forwarded-For"), request.remoteAddr)
                if (!LoginRateLimiter.allow(ip)) {
                    log.warn("Login rate limited ip={}", ip)
                    writeJson(request, response, 429, "Too many login attempts")
                    return
                }
            }
            filterChain.doFilter(request, response)
            return
        }

        val token = request.getHeader("X-Client-Token")
        val chapter = chapterService.resolveChapterFromSession(token)
        if (chapter == null) {
            log.warn(
                "Unauthorized api method={} path={} ip={}",
                method,
                path,
                LoginRateLimiter.clientIp(request.getHeader("X-Forwarded-For"), request.remoteAddr)
            )
            writeJson(request, response, HttpServletResponse.SC_UNAUTHORIZED, "Not authenticated")
            return
        }
        filterChain.doFilter(request, response)
    }

    private fun writeJson(
        request: HttpServletRequest,
        response: HttpServletResponse,
        status: Int,
        message: String
    ) {
        applyCorsHeaders(request, response)
        response.status = status
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = "UTF-8"
        response.writer.write(
            objectMapper.writeValueAsString(mapOf("status" to "error", "message" to message))
        )
    }

    private fun applyCorsHeaders(request: HttpServletRequest, response: HttpServletResponse) {
        val origin = request.getHeader("Origin") ?: return
        if (!isAllowedOrigin(origin)) return
        response.setHeader("Access-Control-Allow-Origin", origin)
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Client-Token, Authorization")
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        response.setHeader("Vary", "Origin")
    }

    private fun isAllowedOrigin(origin: String): Boolean {
        if (origin == "https://bni-anchor-checkin.vercel.app") return true
        if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) return true
        return origin.startsWith("https://") && origin.endsWith(".vercel.app")
    }
}
