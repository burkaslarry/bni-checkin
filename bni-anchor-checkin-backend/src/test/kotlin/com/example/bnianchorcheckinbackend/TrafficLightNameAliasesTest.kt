package com.example.bnianchorcheckinbackend

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class TrafficLightNameAliasesTest {
    @Test
    fun `maps Excel names used on the Anchor traffic light export`() {
        assertEquals("Dr. Chow C.K.", TrafficLightNameAliases.rosterNameForExcel("Chow Chong Kwan"))
        assertEquals("Dr. Wade Suen", TrafficLightNameAliases.rosterNameForExcel("Wade Suen"))
        assertEquals(
            "Max Chan/William Lai/Eddie Chou",
            TrafficLightNameAliases.rosterNameForExcel("Eddie Chou")
        )
    }

    @Test
    fun `leaves unlisted Excel names unchanged`() {
        assertEquals("Wayne Lo", TrafficLightNameAliases.rosterNameForExcel("Wayne Lo"))
        assertEquals("Kevin Ho", TrafficLightNameAliases.rosterNameForExcel("Kevin Ho"))
    }
}
