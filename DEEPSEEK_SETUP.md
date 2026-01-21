# DeepSeek AI Integration Guide

## Overview

The system integrates DeepSeek AI to provide intelligent insights for:
- Guest-Member matching recommendations
- Community retention strategies
- Event attendance analysis

## Step 1: Get DeepSeek API Key

1. Visit https://platform.deepseek.com/
2. Sign up / Log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key (starts with `sk-...`)

## Step 2: Configure API Key

### Local Development

Set environment variable:

```bash
export DEEPSEEK_API_KEY="sk-your-api-key-here"
```

Or add to `application.properties`:

```properties
deepseek.api.key=sk-your-api-key-here
```

### Production (Render/Vercel)

Add environment variable:

```
DEEPSEEK_API_KEY=sk-your-api-key-here
```

## Step 3: API Endpoints

### Generate AI Insights

```bash
POST /api/insights/generate
Content-Type: application/json

{
  "eventId": 1,
  "analysisType": "retention"
}
```

**Analysis Types:**
- `interest` - Analyze guest interests and matching
- `retention` - Generate retention strategies
- `target_audience` - Identify high-potential returnees

### Response Example

```json
{
  "eventId": 1,
  "analysisType": "retention",
  "generatedAt": "2026-01-22T00:00:00",
  "insights": [
    {
      "title": "社群留存建議",
      "description": "基於出席時間分析，建議優化活動時段安排",
      "confidence": 0.82,
      "dataPoints": {
        "on_time_rate": 0.85,
        "suggested_start_time": "07:00"
      }
    }
  ],
  "recommendations": [
    "出席率高於80%的會員可作為核心推廣對象",
    "建議針對連續缺席的會員進行回訪關懷"
  ]
}
```

## Features

### 1. Guest-Member Matching

When a guest checks in, the system can analyze which members would benefit most from networking:

```kotlin
deepSeekService.analyzeGuestMatch(
    guestName = "John Doe",
    guestProfession = "Digital Marketing",
    membersProfessions = listOf("SEO Services", "Web Design", "Social Media Management")
)
```

### 2. Retention Strategy

Analyzes attendance patterns and provides actionable retention strategies:

```kotlin
deepSeekService.generateRetentionStrategy(
    attendanceRate = 0.85,
    lateRate = 0.12,
    absentMembers = listOf("Member A", "Member B")
)
```

## Rate Limits

DeepSeek API has the following limits:
- Free tier: 200 requests/day
- Standard plan: Check current pricing at https://platform.deepseek.com/pricing

## Error Handling

If API key is not configured, the system will return:

```
"DeepSeek API key not configured. Please set deepseek.api.key in application.properties"
```

If API call fails:

```
"Error calling DeepSeek API: <error message>"
```

## Testing

Test the AI integration:

```bash
# Start backend
./gradlew bootRun

# Generate insights
curl -X POST http://localhost:10000/api/insights/generate \
  -H "Content-Type: application/json" \
  -d '{"eventId": 1, "analysisType": "retention"}'
```
