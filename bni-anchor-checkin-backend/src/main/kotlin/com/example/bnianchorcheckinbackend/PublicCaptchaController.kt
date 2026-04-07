package com.example.bnianchorcheckinbackend

import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/public")
@Tag(name = "Public Captcha", description = "Public endpoints for human verification challenges")
class PublicCaptchaController(
    private val captchaService: CaptchaService
) {
    @GetMapping("/captcha")
    @Operation(summary = "Issue a CAPTCHA challenge for public forms")
    fun issue(): ResponseEntity<CaptchaChallenge> {
        return ResponseEntity.ok(captchaService.issue())
    }
}

