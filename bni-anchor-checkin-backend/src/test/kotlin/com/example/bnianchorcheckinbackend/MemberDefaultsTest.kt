package com.example.bnianchorcheckinbackend

import com.example.bnianchorcheckinbackend.entities.Member
import com.example.bnianchorcheckinbackend.entities.MemberStanding
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class MemberDefaultsTest {
    @Test
    fun `new member defaults to black light`() {
        val member = Member(name = "New Member", profession = "Consulting")

        assertEquals(MemberStanding.BLACK, member.standing)
    }
}
