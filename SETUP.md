# 🚀 EventXP Setup Guide

Complete installation and configuration guide for EventXP platform.

---

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Quick Installation](#quick-installation)
3. [Manual Installation](#manual-installation)
4. [Configuration](#configuration)
5. [AI Integration](#ai-integration)
6. [Database Setup](#database-setup)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## 💻 System Requirements

### Minimum Requirements
- **OS**: macOS 10.15+, Windows 10+, or Linux
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 2GB free space

### Software Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Java**: 17 or higher (OpenJDK recommended)
- **Git**: 2.30 or higher

### Optional
- **PostgreSQL**: 14+ (for production)
- **Docker**: 20+ (for containerized deployment)

---

## ⚡ Quick Installation

### One-Command Setup

```bash
# Clone repository
git clone https://github.com/your-org/eventxp.git
cd eventxp

# Start everything
sh run.sh
```

That's it! The platform will:
1. ✅ Kill any conflicting processes
2. ✅ Start backend (port 10000)
3. ✅ Start frontend (port 5173)
4. ✅ Open your browser automatically

**Access Points**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:10000
- API Health: http://localhost:10000/api/matching/health

---

## 🔧 Manual Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/eventxp.git
cd eventxp
```

### Step 2: Backend Setup

```bash
cd bni-anchor-checkin-backend

# Test Java installation
java -version  # Should be 17+

# Build backend
./gradlew build

# Run backend
./gradlew bootRun
```

Backend will start on http://localhost:10000

### Step 3: Frontend Setup

```bash
# Open new terminal
cd bni-anchor-checkin

# Test Node installation
node --version  # Should be 18+
npm --version   # Should be 9+

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend will start on http://localhost:5173

### Step 4: Verify Installation

```bash
# Test backend health
curl http://localhost:10000/api/matching/health

# Expected response:
# {"status":"ok","service":"matching","timestamp":"..."}

# Test frontend
curl -I http://localhost:5173

# Expected: HTTP/1.1 200 OK
```

---

## ⚙️ Configuration

### Backend Configuration

Edit `bni-anchor-checkin-backend/src/main/resources/application.properties`:

```properties
# Server Configuration
server.port=${PORT:10000}

# DeepSeek AI Configuration
deepseek.api.key=your-api-key-here
deepseek.api.url=https://api.deepseek.com/v1/chat/completions

# Database (Optional - for production)
# spring.datasource.url=jdbc:postgresql://localhost:5432/eventxp
# spring.datasource.username=postgres
# spring.datasource.password=your-password

# CORS Configuration
# cors.allowed-origins=https://your-domain.com
```

### Frontend Configuration

Create `bni-anchor-checkin/.env.local`:

```bash
# Backend API URL
VITE_BACKEND_API_URL=http://localhost:10000

# WebSocket URL (optional)
VITE_WS_URL=ws://localhost:10000/ws

# Feature Flags (optional)
VITE_ENABLE_OFFLINE=true
VITE_ENABLE_PWA=true
```

### Member Data

Edit `bni-anchor-checkin-backend/src/main/resources/members.csv`:

```csv
name,domain,mobile,email,company,location,birthday
John Doe,Marketing,+1234567890,john@example.com,Acme Corp,New York,1990-01-01
Jane Smith,IT Consulting,+0987654321,jane@example.com,Tech Solutions,San Francisco,1985-05-15
```

---

## 🤖 AI Integration

### DeepSeek API Setup

#### 1. Get API Key

Visit [DeepSeek Platform](https://platform.deepseek.com/):
1. Create account
2. Navigate to API Keys
3. Generate new key
4. Copy key (starts with `sk-`)

#### 2. Configure Backend

```bash
cd bni-anchor-checkin-backend
vi src/main/resources/application.properties

# Add your key:
deepseek.api.key=sk-your-actual-api-key-here
```

#### 3. Test AI Integration

```bash
# Start backend
./gradlew bootRun

# In another terminal, test API
curl -X POST http://localhost:10000/api/matching/members \
  -H "Content-Type: application/json" \
  -d '{
    "guestName": "Test User",
    "guestProfession": "Software Engineer",
    "guestTargetProfession": "CTO",
    "guestBottlenecks": ["需要技術合作夥伴"],
    "guestRemarks": "專注於 AI 應用開發",
    "members": [
      {"name": "Alice Tech", "profession": "AI Researcher"},
      {"name": "Bob Dev", "profession": "Full Stack Developer"}
    ]
  }'
```

#### 4. Verify Response

You should see JSON with matched members:
```json
{
  "matches": "[{\"memberName\":\"Alice Tech\",\"matchStrength\":\"High\",\"reason\":\"...\"}]",
  "provider": "deepseek"
}
```

### AI Models

EventXP uses **DeepSeek Reasoner** by default:
- Model: `deepseek-reasoner`
- Max Tokens: 2000
- Temperature: 0.7

To change model, edit `DeepSeekService.kt`:
```kotlin
data class DeepSeekRequest(
    val model: String = "deepseek-chat",  // or "deepseek-reasoner"
    // ...
)
```

---

## 🗄️ Database Setup

### Development (CSV - Default)

No setup needed! EventXP uses CSV files for rapid prototyping.

Data location: `bni-anchor-checkin-backend/src/main/resources/members.csv`

### Production (PostgreSQL - Optional)

#### 1. Install PostgreSQL

```bash
# macOS
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian
sudo apt-get install postgresql-14
sudo systemctl start postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

#### 2. Create Database

```bash
psql -U postgres

CREATE DATABASE eventxp;
CREATE USER eventxp_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE eventxp TO eventxp_user;
\q
```

#### 3. Run Migration

```bash
cd bni-anchor-checkin-backend
psql -U eventxp_user -d eventxp < ../init-database.sql
```

#### 4. Update Configuration

Edit `application.properties`:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/eventxp
spring.datasource.username=eventxp_user
spring.datasource.password=secure_password
spring.jpa.hibernate.ddl-auto=update
```

---

## 🚢 Deployment

### Vercel (Frontend Only)

```bash
cd bni-anchor-checkin

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Render (Backend)

1. Create `render.yaml` (already included)
2. Push to GitHub
3. Connect to Render.com
4. Deploy automatically

### Docker (Full Stack)

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Checklist

- [ ] Set environment variables
- [ ] Configure CORS origins
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure monitoring
- [ ] Set up error tracking
- [ ] Enable rate limiting
- [ ] Review security settings

---

## 🐛 Troubleshooting

### Backend Won't Start

**Problem**: Port 10000 already in use
```bash
# Find process
lsof -i :10000

# Kill process
kill -9 <PID>

# Or use run script
sh run.sh  # Automatically kills old processes
```

**Problem**: Java version mismatch
```bash
# Check version
java -version

# Should be 17+
# Install OpenJDK 17:
# macOS: brew install openjdk@17
# Ubuntu: sudo apt install openjdk-17-jdk
```

### Frontend Won't Start

**Problem**: Port 5173 already in use
```bash
# Kill Vite processes
pkill -f vite

# Or change port in vite.config.ts
export default defineConfig({
  server: { port: 3000 }
})
```

**Problem**: Module not found errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### AI Matching Not Working

**Problem**: All matches are "Medium" (keyword fallback)

**Solution**: Check DeepSeek API:

```bash
# 1. Verify API key
cd bni-anchor-checkin-backend
grep deepseek.api.key src/main/resources/application.properties

# 2. Check backend logs
tail -f backend.log | grep DeepSeekService

# Look for:
# ✅ [DeepSeekService] API key configured
# ❌ [DeepSeekService] API error 401  (Bad key)
# ❌ [DeepSeekService] Exception  (Network issue)

# 3. Test API key manually
curl https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"test"}]}'
```

### WebSocket Connection Failed

**Problem**: Real-time updates not working

```bash
# Check WebSocket endpoint
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://localhost:10000/ws

# Expected: HTTP/1.1 101 Switching Protocols
```

### Build Errors

**Frontend Build Fails**:
```bash
# Clear cache
npm run clean  # or rm -rf dist .vite

# Rebuild
npm run build
```

**Backend Build Fails**:
```bash
# Clean Gradle cache
./gradlew clean

# Rebuild
./gradlew build --refresh-dependencies
```

---

## 📊 Performance Tuning

### Backend Optimization

Edit `application.properties`:
```properties
# Connection pool
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.minimum-idle=5

# JVM options (in gradlew or startup script)
-Xms512m -Xmx2g
```

### Frontend Optimization

Edit `vite.config.ts`:
```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['html2canvas', 'qr-scanner']
        }
      }
    }
  }
})
```

---

## 🔒 Security Hardening

### Production Environment Variables

```bash
# Never commit these to Git!
DEEPSEEK_API_KEY=sk-production-key
DATABASE_PASSWORD=strong-random-password
JWT_SECRET=random-256-bit-key
```

### CORS Configuration

Edit `CorsConfig.kt`:
```kotlin
@Bean
fun corsConfigurer(): WebMvcConfigurer {
    return object : WebMvcConfigurer {
        override fun addCorsMappings(registry: CorsRegistry) {
            registry.addMapping("/**")
                .allowedOrigins("https://your-domain.com")  // Specific domain only!
                .allowedMethods("GET", "POST", "PUT", "DELETE")
        }
    }
}
```

---

## 📞 Getting Help

### Check Logs

**Backend**:
```bash
cd bni-anchor-checkin-backend
tail -f backend.log
```

**Frontend**:
```bash
cd bni-anchor-checkin
tail -f frontend.log
```

**Browser Console**:
- Press `F12` → Console tab
- Look for `[Frontend]` or `[DeepSeekService]` messages

### Common Issues

See [Troubleshooting Section](#troubleshooting) or:

- 📖 [User Guide](./USER_GUIDE.md)
- 📖 [Quick Reference](./QUICK_REFERENCE.md)
- 📖 [API Documentation](./bni-anchor-checkin-backend/README.md)

### Contact Support

- 📧 Email: support@eventxp.com
- 💬 Discord: [EventXP Community](#)
- 🐛 Issues: [GitHub Issues](#)

---

<div align="center">

**EventXP Setup Guide**  
Version 1.0 | Last Updated: January 2026

[Back to Main README](./README.md)

</div>
