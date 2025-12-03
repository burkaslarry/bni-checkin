# Kotlin Backend Configuration

## API Integration Setup

The BNI Anchor Checkin PWA is now configured to fetch data from a **Kotlin backend running on port 8080**.

### Current Configuration

**Frontend (React PWA)**
- Port: `5173`
- URL: `http://localhost:5173`

**Backend (Kotlin)**
- Port: `8080`
- Base URL: `http://localhost:8080`
- CORS: Enabled (using `mode: "cors"`)

---

## API Endpoints

All requests are made to the Kotlin backend at `http://localhost:8080`:

### 1. Record Attendance (Scan QR Code)
```
POST http://localhost:8080/api/attendance/scan
Content-Type: application/json

{
  "qrPayload": "{\"name\":\"larrylo\",\"time\":\"2025-11-16T10:30:00.000Z\",\"type\":\"member\",\"membershipId\":\"ANCHOR-001\"}"
}
```

**Response (Success):**
```json
{
  "message": "Attendance recorded successfully"
}
```

---

### 2. Search Member Attendance
```
GET http://localhost:8080/api/attendance/member?name=larrylo
```

**Response:**
```json
[
  {
    "eventName": "Weekly Meeting",
    "eventDate": "2025-11-16",
    "status": "Present"
  }
]
```

---

### 3. Search Event Attendance
```
GET http://localhost:8080/api/attendance/event?date=2025-11-16
```

**Response:**
```json
[
  {
    "memberName": "larrylo",
    "membershipId": "ANCHOR-001",
    "status": "Present"
  },
  {
    "memberName": "karinyeung",
    "membershipId": null,
    "status": "Present"
  }
]
```

---

## Environment Configuration

### Development
Uses default: `http://localhost:8080`

### Production
Set environment variable before building:

```bash
VITE_API_BASE=https://api.yourdomain.com npm run build
```

Or in `.env`:
```
VITE_API_BASE=https://api.yourdomain.com
```

---

## CORS Requirements

The Kotlin backend must enable CORS to accept requests from `http://localhost:5173` (or your production domain).

### Example Kotlin Configuration (Spring Boot)

```kotlin
@Configuration
class CorsConfig {
    @Bean
    fun corsConfigurer(): WebMvcConfigurer {
        return object : WebMvcConfigurer {
            override fun addCorsMappings(registry: CorsRegistry) {
                registry.addMapping("/api/**")
                    .allowedOrigins("http://localhost:5173", "http://localhost:3000")
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                    .allowedHeaders("*")
                    .allowCredentials(true)
                    .maxAge(3600)
            }
        }
    }
}
```

---

## Testing the Integration

### 1. Start the Kotlin Backend
```bash
# Ensure backend is running on port 8080
java -jar your-app.jar --server.port=8080
```

### 2. Start the PWA Dev Server
```bash
npm run dev
# Runs on http://localhost:5173
```

### 3. Test Scanning
1. Navigate to `http://localhost:5173`
2. Go to **Scan QR Code** section
3. Click **Member** or **Guest** button
4. Click **Submit**
5. Check browser console for API calls to `http://localhost:8080`

### 4. Test Search
1. Go to **Search by Member Name** section
2. Type a member name
3. Verify API calls to `http://localhost:8080/api/attendance/member?name=...`

---

## TypeScript Configuration

Updated `tsconfig.json` to include Vite client types for proper `import.meta.env` support:

```json
{
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

This enables proper type checking for:
- `import.meta.env.VITE_API_BASE`
- Other Vite environment variables

---

## API Base URL Resolution

The app resolves the API base URL in this order:

1. **Environment Variable**: `VITE_API_BASE` (if set)
2. **Default**: `http://localhost:8080`

```typescript
// In src/api.ts
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:8080";
```

---

## Building for Production

### With Default Backend
```bash
npm run build
```
Uses: `http://localhost:8080`

### With Custom Backend URL
```bash
VITE_API_BASE=https://api.yourdomain.com npm run build
```

### Docker Example
```dockerfile
FROM node:22 as builder
WORKDIR /app
COPY . .
RUN npm install
RUN VITE_API_BASE=https://api.yourdomain.com npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

---

## Troubleshooting

### CORS Errors
**Error**: `Access to XMLHttpRequest blocked by CORS policy`

**Solution**: Ensure Kotlin backend has CORS configured for your frontend domain.

### 404 Errors
**Error**: `Failed to fetch... 404`

**Solution**: 
- Verify Kotlin backend is running on port 8080
- Check endpoint URLs match Kotlin backend routes
- Check network tab in DevTools

### Connection Refused
**Error**: `Failed to fetch... ERR_CONNECTION_REFUSED`

**Solution**:
- Start Kotlin backend: `java -jar app.jar --server.port=8080`
- Verify backend is listening on port 8080: `lsof -i :8080`

### Wrong API Base
**Check**: `http://localhost:5173` → Open DevTools → Network tab → Check request URLs

Should see: `http://localhost:8080/api/...`

---

## API Response Handling

All API calls are wrapped with error handling:

```typescript
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      text || "Attendance service returned an unexpected response."
    );
  }
  return response.json();
}
```

**Error notifications** are shown automatically when requests fail.

---

## Files Modified

- `src/api.ts` - Updated all endpoints to use `${API_BASE}/api/...`
- `tsconfig.json` - Added Vite client types for `import.meta.env`
- All API calls now include `mode: "cors"` for proper CORS handling

---

## Next Steps

1. ✅ Start Kotlin backend on port 8080
2. ✅ Ensure backend endpoints match API expectations
3. ✅ Configure CORS on backend for `http://localhost:5173`
4. ✅ Test attendance recording
5. ✅ Test search functionality
6. ✅ Deploy to production with `VITE_API_BASE` set

---

**The PWA is now fully configured to communicate with your Kotlin backend! 🚀**

