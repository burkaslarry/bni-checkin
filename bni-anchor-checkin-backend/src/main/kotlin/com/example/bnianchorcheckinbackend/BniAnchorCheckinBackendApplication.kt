package com.example.bnianchorcheckinbackend

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class BniAnchorCheckinBackendApplication

fun main(args: Array<String>) {
    runApplication<BniAnchorCheckinBackendApplication>(*args)
}
