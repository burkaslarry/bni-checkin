package com.example.bnianchorcheckinbackend

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Test
import java.io.File

class TrafficLightXlsxParserTest {
    @Test
    fun `parses July Anchor traffic light export`() {
        val file = File("/Users/larrylo/Downloads/Member Traffic Light - Anchor (Chinese) (2026-07).xlsx")
        assumeTrue(file.exists(), "July traffic-light workbook not on this machine")
        val parsed = TrafficLightXlsxParser.parse(file.readBytes())
        assertTrue(parsed.rows.size >= 40)
        val larry = parsed.rows.first { it.name.equals("Larry Lo", ignoreCase = true) }
        assertEquals(60, larry.totalPts)
        assertEquals("YELLOW", larry.light)
        val jessica = parsed.rows.first { it.name.equals("Jessica Cheung", ignoreCase = true) }
        assertEquals("GREEN", jessica.light)
        assertTrue(parsed.periodLabel.contains("2026"))
    }
}
