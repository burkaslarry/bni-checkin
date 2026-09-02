package com.example.bnianchorcheckinbackend

/**
 * Anchor 6-month Traffic Light row scoring.
 *
 * Cutoffs (from chapter Excel practice, not the “Green Goal: 60” KPI banner):
 * green ≥ 70, yellow 40–69, red 30–39, black &lt; 30.
 * Green-path maxima: A&lt;1 (15), L=0 (10), G ≥1.5/week (20), V ≥0.75/week (20),
 * 1-2-1 ≥1/week (10), T ≥2 modules (10), TYFCB ≥ HK$500k (15).
 *
 * Keep in sync with `bni-anchor-checkin/src/lib/trafficLight.ts`.
 */
object TrafficLightScoring {
    const val GREEN_PTS = 70
    const val YELLOW_PTS = 40
    const val RED_PTS = 30

    /** Row colour from total points when Excel fill is missing. */
    fun lightFromPts(pts: Int): String = when {
        pts >= GREEN_PTS -> "GREEN"
        pts >= YELLOW_PTS -> "YELLOW"
        pts >= RED_PTS -> "RED"
        else -> "BLACK"
    }

    fun lightLabelZh(light: String): String = when (light.uppercase()) {
        "GREEN" -> "綠燈"
        "YELLOW" -> "黃燈"
        "RED" -> "紅燈"
        else -> "黑燈"
    }

    fun scoreAbsences(absent: Int): Int = when {
        absent > 2 -> 0
        absent == 2 -> 5
        absent == 1 -> 10
        else -> 15
    }

    fun scoreLates(late: Int): Int = when {
        late >= 2 -> 0
        late == 1 -> 5
        else -> 10
    }

    fun scoreReferralsPerWeek(rate: Double): Int = when {
        rate >= 1.5 -> 20
        rate >= 1.2 -> 15
        rate >= 1.0 -> 10
        rate >= 0.75 -> 5
        else -> 0
    }

    fun scoreVisitorsPerWeek(rate: Double): Int = when {
        rate >= 0.75 -> 20
        rate >= 0.5 -> 15
        rate >= 0.25 -> 10
        rate >= 0.1 -> 5
        else -> 0
    }

    fun scoreOneToOnesPerWeek(rate: Double): Int = when {
        rate >= 1.0 -> 10
        rate > 0.5 -> 5
        else -> 0
    }

    fun scoreTraining(modules: Int): Int = when {
        modules >= 2 -> 10
        modules == 1 -> 5
        else -> 0
    }

    fun scoreBizGive(value: Double): Int = when {
        value >= 500_000 -> 15
        value >= 200_000 -> 10
        value >= 100_000 -> 5
        else -> 0
    }
}
