# BNI Anchor Check-in Backend

A Kotlin/Spring Boot backend API for the BNI Anchor Chapter attendance check-in system.

## 🎯 Features

- **Member Management**: Load and manage BNI Anchor members from CSV
- **Check-in Recording**: Record member and guest check-ins with timestamps
- **Duplicate Prevention**: Prevents same person from checking in twice
- **Real-time Updates**: WebSocket support for live updates
- **CSV Export**: Export attendance records to CSV format
- **RESTful API**: Clean REST endpoints for all operations

## 🛠️ Tech Stack

- **Kotlin** - Programming language
- **Spring Boot 3.4** - Application framework
- **Gradle** - Build tool
- **Docker** - Containerization
- **WebSocket** - Real-time communication

## 🚀 Getting Started

### Prerequisites

- Java 17+
- Gradle (wrapper included)

### Local Development

```bash
# Run the application
./gradlew bootRun

# Server starts at http://localhost:8080
```

### Docker

```bash
# Build
docker build -t bni-checkin-backend .

# Run
docker run -p 8080:8080 bni-checkin-backend
```

## 📡 API Reference

### Members

```bash
# Get all members (with id, profession, standing, category)
GET /api/members

# Response
{
  "members": [
    {
      "id": 3,
      "name": "Max Chan/William Lai",
      "domain": "區塊鏈系統開發",
      "standing": "GREEN",
      "professionCode": "A",
      "professionGroupName": "資訊及創新科技"
    }
  ]
}

# Update member — prefer memberId; currentName supports names with /
PUT /api/members?memberId=3
PUT /api/members?currentName=Max%20Chan%2FWilliam%20Lai
Content-Type: application/json

{
  "name": "Max Chan/William Lai",
  "profession": "區塊鏈系統開發",
  "standing": "GREEN",
  "professionCode": "A"
}

# Delete member
DELETE /api/members?memberId=3
DELETE /api/members?name=Max%20Chan%2FWilliam%20Lai
```

Names containing `/` must use query parameters. Path-based `PUT /api/members/{name}` fails when the slash is URL-encoded.

### Check-in

```bash
# Create check-in
POST /api/checkin
Content-Type: application/json

{
  "name": "Larry Lo",
  "type": "member",  // or "guest"
  "currentTime": "2025-11-30T10:00:00Z"
}

# Success Response
{"status": "success", "message": "Check-in successful"}

# Duplicate Error
{"status": "error", "message": "Larry Lo 已經簽到過了 (Already checked in)"}
```

### Records

```bash
# Get all records
GET /api/records

# Delete specific record
DELETE /api/records/{index}

# Clear all records
DELETE /api/records

# Export as CSV
GET /api/export
```

## 📁 Member Data

Members are loaded from `src/main/resources/members.csv`:

```csv
Name | Domain | Type | Membership | Referrer
Jessica Cheung | 陪月服務 | Member | ANCHOR-001 |
Larry Lo | 客戶服務系統 | Member | ANCHOR-007 |
...
```

## 🌐 Deployment

Production API: <https://bni-anchor-checkin-backend.onrender.com>

Render deploys from the separate GitHub repo `burkaslarry/bni-anchor-checkin-backend` on branch `main`. When developing in the monorepo, sync `bni-anchor-checkin-backend/` to that repo before pushing. Latest backend production tag: `prod/5.1.2`.

### Render.com

1. Create new Web Service
2. Connect GitHub repository (`bni-anchor-checkin-backend`)
3. Select **Docker** runtime
4. Deploy

### Environment Variables

- `SERVER_PORT`: defaults to `8080`; controls the server port.
- `JAVA_OPTS`: defaults to `-Xmx256m`; controls JVM options.

## 📖 Related

- [Frontend PWA](../bni-anchor-checkin) - React frontend application
- [API Documentation](./swagger-server) - Swagger UI

## 📄 License

Proprietary commercial prototype. See [the root license](../LICENSE.md) before distribution, reuse, or production deployment.
