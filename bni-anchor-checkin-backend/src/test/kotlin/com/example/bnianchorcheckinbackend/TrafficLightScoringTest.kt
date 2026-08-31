package com.example.bnianchorcheckinbackend

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class TrafficLightScoringTest {
    @Test
    fun `july export thresholds`() {
        assertEquals("GREEN", TrafficLightScoring.lightFromPts(70))
        assertEquals("YELLOW", TrafficLightScoring.lightFromPts(65))
        assertEquals("YELLOW", TrafficLightScoring.lightFromPts(40))
        assertEquals("RED", TrafficLightScoring.lightFromPts(35))
        assertEquals("BLACK", TrafficLightScoring.lightFromPts(25))
    }

    @Test
    fun `scoring sheet buckets`() {
        assertEquals(15, TrafficLightScoring.scoreAbsences(0))
        assertEquals(0, TrafficLightScoring.scoreLates(2))
        assertEquals(20, TrafficLightScoring.scoreReferralsPerWeek(1.6))
        assertEquals(0, TrafficLightScoring.scoreVisitorsPerWeek(0.09))
        assertEquals(10, TrafficLightScoring.scoreOneToOnesPerWeek(1.9))
        assertEquals(15, TrafficLightScoring.scoreBizGive(1_300_000.0))
    }
}
