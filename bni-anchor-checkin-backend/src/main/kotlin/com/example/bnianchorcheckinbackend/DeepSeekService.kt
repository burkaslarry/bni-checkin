package com.example.bnianchorcheckinbackend

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

@Service
class DeepSeekService(
    private val objectMapper: ObjectMapper
) {
    
    @Value("\${deepseek.api.key:}")
    private lateinit var apiKey: String
    
    @Value("\${deepseek.api.url:https://api.deepseek.com/v1/chat/completions}")
    private lateinit var apiUrl: String
    
    private val httpClient = HttpClient.newBuilder().build()
    
    data class DeepSeekRequest(
        val model: String = "deepseek-reasoner",
        val messages: List<Message>,
        val temperature: Double = 0.7,
        val max_tokens: Int = 2000,
        val response_format: ResponseFormat? = null
    )
    
    data class ResponseFormat(
        val type: String = "json_object"
    )
    
    data class Message(
        val role: String,
        val content: String
    )
    
    data class DeepSeekResponse(
        val choices: List<Choice>
    )
    
    data class Choice(
        val message: Message
    )
    
    fun generateInsight(prompt: String): String {
        if (apiKey.isBlank()) {
            return "DeepSeek API key not configured. Please set deepseek.api.key in application.properties"
        }
        
        return try {
            val request = DeepSeekRequest(
                messages = listOf(
                    Message(
                        role = "system",
                        content = "You are a BNI networking event analyst. Provide insights based on attendance data."
                    ),
                    Message(
                        role = "user",
                        content = prompt
                    )
                )
            )
            
            val requestBody = objectMapper.writeValueAsString(request)
            
            val httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer $apiKey")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build()
            
            val response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString())
            
            if (response.statusCode() == 200) {
                val deepSeekResponse = objectMapper.readValue(response.body(), DeepSeekResponse::class.java)
                deepSeekResponse.choices.firstOrNull()?.message?.content 
                    ?: "No response from DeepSeek API"
            } else {
                "DeepSeek API error: ${response.statusCode()} - ${response.body()}"
            }
        } catch (e: Exception) {
            "Error calling DeepSeek API: ${e.message}"
        }
    }
    
    fun analyzeGuestMatch(
        guestName: String,
        guestProfession: String,
        membersProfessions: List<String>
    ): String {
        val prompt = """
        Guest Information:
        - Name: $guestName
        - Profession: $guestProfession
        
        Available Members' Professions:
        ${membersProfessions.joinToString("\n") { "- $it" }}
        
        Task: Analyze which members would benefit most from networking with this guest. 
        Provide 3-5 specific reasons why certain professions would synergize well.
        Format: Brief, actionable insights in Traditional Chinese.
        """.trimIndent()
        
        return generateInsight(prompt)
    }
    
    fun generateRetentionStrategy(
        attendanceRate: Double,
        lateRate: Double,
        absentMembers: List<String>
    ): String {
        val prompt = """
        BNI Chapter Statistics:
        - Overall Attendance Rate: ${String.format("%.1f", attendanceRate * 100)}%
        - Late Arrival Rate: ${String.format("%.1f", lateRate * 100)}%
        - Frequently Absent Members: ${absentMembers.take(5).joinToString(", ")}
        
        Task: Provide 3-5 actionable retention strategies to improve attendance and engagement.
        Focus on practical, BNI-specific recommendations.
        Format: Brief bullet points in Traditional Chinese.
        """.trimIndent()
        
        return generateInsight(prompt)
    }
    
    data class MemberMatchRequest(
        val guestName: String,
        val guestProfession: String,
        val guestTargetProfession: String?,
        val guestBottlenecks: List<String>,
        val guestRemarks: String?,
        val members: List<MemberInfo>
    )
    
    data class MemberInfo(
        val name: String,
        val profession: String
    )
    
    /**
     * 使用 DeepSeek API 進行會員匹配
     * 返回 JSON 格式的匹配結果
     */
    fun matchMembersWithAI(request: MemberMatchRequest): String {
        if (apiKey.isBlank()) {
            return """{"error": "DeepSeek API key not configured"}"""
        }
        
        val memberList = request.members.joinToString("\n") { "- ${it.name} (${it.profession})" }
        
        val prompt = buildMatchPrompt(
            guestName = request.guestName,
            guestProfession = request.guestProfession,
            guestTargetProfession = request.guestTargetProfession,
            guestBottlenecks = request.guestBottlenecks,
            guestRemarks = request.guestRemarks,
            memberList = memberList
        )
        
        return try {
            val deepSeekRequest = DeepSeekRequest(
                model = "deepseek-reasoner",
                messages = listOf(
                    Message(
                        role = "user",
                        content = prompt
                    )
                ),
                temperature = 0.7,
                max_tokens = 2000,
                response_format = ResponseFormat(type = "json_object")
            )
            
            val requestBody = objectMapper.writeValueAsString(deepSeekRequest)
            
            val httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer $apiKey")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build()
            
            val response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString())
            
            if (response.statusCode() == 200) {
                val deepSeekResponse = objectMapper.readValue(response.body(), DeepSeekResponse::class.java)
                val content = deepSeekResponse.choices.firstOrNull()?.message?.content 
                    ?: """{"error": "No response from DeepSeek API"}"""
                
                // Extract JSON from response
                val jsonMatch = Regex("""\[[\s\S]*\]""").find(content)
                if (jsonMatch != null) {
                    jsonMatch.value
                } else {
                    content
                }
            } else {
                """{"error": "DeepSeek API error: ${response.statusCode()}"}"""
            }
        } catch (e: Exception) {
            """{"error": "Error calling DeepSeek API: ${e.message}"}"""
        }
    }
    
    private fun buildMatchPrompt(
        guestName: String,
        guestProfession: String,
        guestTargetProfession: String?,
        guestBottlenecks: List<String>,
        guestRemarks: String?,
        memberList: String
    ): String {
        return """
You are an elite strategic networking consultant for a BNI-style business event. Your mission is to identify HIGH-VALUE connections that lead to immediate referrals and long-term partnerships.

【來賓檔案 Guest Profile】
姓名: $guestName
職業: $guestProfession
${if (guestTargetProfession != null) "目標對接: $guestTargetProfession" else ""}
瓶頸/需求: ${if (guestBottlenecks.isNotEmpty()) guestBottlenecks.joinToString(", ") else "未指定"}
${if (guestRemarks != null) "價值交換: $guestRemarks" else ""}

【可配對會員列表 Available Members】
$memberList

【核心配對原則 Core Matching Principles】
1. **價值互補 (Value Complementarity)**: 優先推薦能解決來賓「瓶頸」的專業人士
2. **目標對接 (Target Alignment)**: 如果來賓有明確的「目標職業」，尋找該領域或能引薦該領域的會員
3. **資源交換 (Resource Exchange)**: 關注備註中的「價值提供」，推薦能產生雙向價值的人脈
4. **行業互補 (Industry Synergy)**: 尋找上下游產業鏈、異業合作機會

【配對策略 Matching Strategy】
- **High Match**: 會員能直接解決來賓瓶頸，或其職業正是來賓的目標對接對象
- **Medium Match**: 會員能提供相關協助，或行業高度相關
- **Low Match**: 會員可提供一般人脈拓展，但無直接業務契合點

【輸出要求 Output Format】
請推薦最適合與來賓配對的會員（最多10位），並說明配對原因。以 JSON 格式回應：

[
  {
    "memberName": "會員姓名",
    "matchStrength": "High",
    "reason": "[會員姓名] ([職業]) 能直接解決來賓的 [具體瓶頸]，或在 [目標領域] 有豐富資源，可提供精準引薦和業務合作機會。"
  }
]

**重要提醒**: 
- 只推薦真正有價值的配對（不一定要推薦全部會員）
- 每個 reason 必須具體說明該會員能提供什麼價值給來賓
- 按照配對價值排序（最佳在前）
- 必須返回有效的 JSON 陣列格式
        """.trimIndent()
    }
}
