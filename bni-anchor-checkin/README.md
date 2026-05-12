# BNI Anchor Check-in PWA

A Progressive Web App (PWA) for BNI Anchor Chapter meeting attendance check-in.

## 🎯 Features

### Check-in

- **👤 Member Check-in**: Select from dropdown or scan QR code
- **🎫 Guest Check-in**: Manual name entry or QR scan
- **🚫 Duplicate Prevention**: Same person cannot check in twice

### Admin Tools (at `/admin`)

- **🔳 QR Code Generator**: Create events, download PNG/PDF flyers (PDF uses a canvas-safe inline logo)
- **📋 Records Management**: View, search, filter, and delete records
- **📥 CSV Export**: Download attendance as CSV file
- **🔍 Member Search**: Search attendance history

### Live report

- **`/report`**: Real-time attendance dashboard (WebSocket updates). Header links go to public check-in (`/`) and admin (`/admin`).

### PWA Features

- 📱 Mobile-first responsive design
- 🔌 Offline support with sync
- 📲 Add to home screen
- 🔔 Real-time notifications

## 🛠️ Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **PWA** - Progressive Web App

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Development URLs

- Frontend: <http://localhost:5173>
- Admin: <http://localhost:5173/admin>

## 📁 Project Structure

```text
src/
├── App.tsx                    # Router setup
├── api.ts                     # API client
├── main.tsx                   # Entry point
├── styles.css                 # Global styles
├── pages/
│   ├── HomePage.tsx           # Main check-in page
│   └── AdminPage.tsx          # Admin dashboard
└── components/
    ├── MemberCheckinPanel.tsx # Member check-in
    ├── GuestCheckinPanel.tsx  # Guest check-in
    ├── QRGeneratorPanel.tsx   # QR code generator
    ├── RecordsPanel.tsx       # Records management
    ├── ExportPanel.tsx        # CSV export
    └── ...
```

## 🌐 Routes

| Path            | Description                                              |
|-----------------|----------------------------------------------------------|
| `/`             | Main check-in page (Member/Guest)                        |
| `/admin`        | Admin hub (QR, records, export; further `/admin/*` tools) |
| `/report`       | Live attendance report                                   |
| `/public/guest` | Public guest walk-in registration (when enabled)       |

> **Event create:** saving a new event from the QR tab also calls **set current event** on the API when supported, so check-in and exports target the new meeting immediately.

## 📱 Pages

### Home Page (`/`)

Main check-in interface with two options:

- **👤 會員簽到** (Member Check-in)
- **🎫 來賓簽到** (Guest Check-in)

### Admin Page (`/admin`)

Administrative tools:

- **🔳 產生 QR 碼** - Generate event QR codes
- **📋 簽到記錄** - View and manage records
- **📥 匯出資料** - Export to CSV
- **🔍 會員查詢** - Search member history

## ⚙️ Configuration

### Environment Variables

Create `.env.local` for local development:

```env
VITE_API_BASE=http://localhost:10000
```

For production (Vercel):

```env
VITE_API_BASE=https://your-backend.onrender.com
```

## 🚀 Deployment

### Vercel

```bash
# Deploy with Vercel CLI
npx vercel --prod

# Set environment variable
npx vercel env add VITE_API_BASE production
```

### Manual Build

```bash
npm run build
# Output in dist/
```

## 📖 Related

- [Backend API](../bni-anchor-checkin-backend) - Kotlin/Spring Boot backend

## 📄 License

Proprietary commercial prototype. See [the root license](../LICENSE.md) before distribution, reuse, or production deployment.
