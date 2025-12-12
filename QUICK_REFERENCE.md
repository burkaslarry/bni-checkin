# Quick Reference Guide - QR Check-in System

## File Structure

```
src/
├── components/
│   ├── CheckinFormPanel.tsx     ← NEW: Main check-in form component
│   ├── MemberCheckinPanel.tsx   (Kept for compatibility)
│   ├── GuestCheckinPanel.tsx    (Kept for compatibility)
│   ├── ScanPanel.tsx
│   ├── NotificationStack.tsx
│   └── ...other components
├── pages/
│   ├── HomePage.tsx             ← UPDATED: QR-first landing page
│   ├── AdminPage.tsx
│   └── ReportPage.tsx
├── api.ts
├── App.tsx
├── styles.css                   ← UPDATED: Mobile-friendly styles
└── ...
```

## Component: CheckinFormPanel

**Import**:
```tsx
import { CheckinFormPanel } from "../components/CheckinFormPanel";
```

**Usage**:
```tsx
<CheckinFormPanel onNotify={handlePanelNotification} />
```

**Props**:
```tsx
type CheckinFormPanelProps = {
  onNotify: (message: string, type: "success" | "error" | "info") => void;
};
```

**Features**:
- 📱 Auto-starting QR scanner
- 🔄 Auto-scanning every 300ms
- 👤 Member dropdown selection
- 🎫 Guest manual entry (name + domain)
- ✅ Form validation & submission
- ⏰ Event time validation
- 🌐 API integration with offline support

## CSS Classes

**New Classes for CheckinFormPanel**:
```css
.checkin-form-panel
  ├── .qr-scanner-section
  │   ├── .scanner-container
  │   ├── .video-wrapper
  │   ├── .qr-scan-overlay
  │   ├── .qr-guide
  │   └── .scanner-hint
  └── .checkin-form-section
      ├── .checkin-type-selector
      │   └── .radio-button
      │       └── .radio-label
      ├── .form-group
      ├── .form-label
      ├── .form-input
      ├── .form-select
      ├── .form-help
      ├── .button-primary
      ├── .button-secondary
      └── .alert (alert-success, alert-warning, alert-error)
```

**Responsive Breakpoints**:
```css
/* Desktop/Tablet (default) */
/* ≤640px - Mobile */
@media (max-width: 640px) { ... }

/* ≤360px - Small phones */
@media (max-width: 360px) { ... }
```

## State Variables

**Form State**:
```tsx
const [checkinType, setCheckinType] = useState<"member" | "guest">("member");
const [selectedMember, setSelectedMember] = useState("");
const [guestName, setGuestName] = useState("");
const [guestDomain, setGuestDomain] = useState("");
```

**Scanner State**:
```tsx
const [showQRScanner, setShowQRScanner] = useState(true);
const [lastScanned, setLastScanned] = useState("");
const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success">("idle");
const [supportsDetector, setSupportsDetector] = useState(false);
```

**Event State**:
```tsx
const [eventInfo, setEventInfo] = useState<{ eventName: string; eventDate: string } | null>(null);
const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
const [isEventEnded, setIsEventEnded] = useState(false);
```

**Data State**:
```tsx
const [members, setMembers] = useState<MemberInfo[]>([]);
const [isSubmitting, setIsSubmitting] = useState(false);
```

## Key Functions

### `processQRCode(qrData: string): boolean`
Processes scanned QR code data. Validates format and extracts information.

**Returns**: `true` if processing was successful, `false` otherwise

**Handles**:
- Event QR codes: `{"eventName": "...", "eventDate": "..."}`
- Member QR codes: `{"name": "...", "type": "member"}`
- Guest QR codes: `{"name": "...", "type": "guest"}`
- Text format: `{name}-ANCHOR` or `{name}-GUEST`

### `performAutoScan(): Promise<void>`
Auto-scan function that runs every 300ms. Attempts BarcodeDetector API first, falls back to jsQR.

### `handleMemberSubmit(): Promise<void>`
Validates member selection and submits check-in via API.

### `handleGuestSubmit(): Promise<void>`
Validates guest fields (name + domain) and submits check-in via API.

## API Integration

### getMembers()
```tsx
const data = await getMembers();
// Returns: { members: MemberInfo[] }
// MemberInfo = { name: string; domain: string }
```

### getCurrentEvent()
```tsx
const event = await getCurrentEvent();
// Returns: EventData = { date: string; startTime: string; endTime: string }
```

### checkIn()
```tsx
const result = await checkIn({
  name: string;
  type: "member" | "guest";
  domain?: string;  // For guests
  currentTime: string;
});
// Returns: { status: "success" | "error"; message: string }
```

## Workflow Diagram

```
1. User opens HomePage
        ↓
2. CheckinFormPanel mounts & initializes camera
        ↓
3. Auto-scanning starts (every 300ms)
        ↓
4. QR code detected → processQRCode()
        ↓
5. Form section appears with type selector
        ↓
6. User selects "會員" or "嘉賓"
        ↓
7a. If Member:          7b. If Guest:
    - Dropdown appears      - Text inputs appear
    - Select member         - Fill name & domain
        ↓                       ↓
    handleMemberSubmit()   handleGuestSubmit()
        ↓                       ↓
8. API call & validation
        ↓
9. Success notification + form reset
        ↓
10. Ready for next scan (back to step 3)
```

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 88+ | ✅ Full | BarcodeDetector API |
| Edge 88+ | ✅ Full | BarcodeDetector API |
| Android Chrome | ✅ Full | Optimal experience |
| Safari 13+ | ✅ Good | jsQR fallback |
| Firefox | ✅ Good | jsQR fallback |
| IE 11 | ❌ No | Legacy browser |

## Testing Checklist

- [ ] **QR Scanning**
  - [ ] Can scan valid event QR codes
  - [ ] Can scan member QR codes
  - [ ] Can scan guest QR codes
  - [ ] Handles invalid/corrupted QR gracefully
  
- [ ] **Member Check-in**
  - [ ] Member dropdown populates correctly
  - [ ] Can select member from dropdown
  - [ ] Submit button validates (member required)
  - [ ] API call succeeds and resets form
  
- [ ] **Guest Check-in**
  - [ ] Guest form fields appear when guest is selected
  - [ ] Name field accepts input
  - [ ] Domain field accepts input
  - [ ] Submit validates both fields are filled
  - [ ] API call succeeds and resets form
  
- [ ] **Mobile Responsiveness**
  - [ ] Works on iPhone (various sizes)
  - [ ] Works on Android phones
  - [ ] Portrait and landscape modes
  - [ ] Touch-friendly button sizes
  - [ ] No layout shifts or scrolling issues
  
- [ ] **Event Validation**
  - [ ] Detects when event has ended
  - [ ] Shows warning when event ended
  - [ ] Disables submit button when ended
  
- [ ] **Offline Support**
  - [ ] Shows offline indicator
  - [ ] Queues check-ins when offline
  - [ ] Syncs when connection restored
  
- [ ] **Error Handling**
  - [ ] Shows errors for failed API calls
  - [ ] Shows errors for camera access denied
  - [ ] Shows errors for invalid QR codes
  - [ ] Allows user to retry/continue

## Troubleshooting

**Camera not working**
- Check browser camera permissions
- Ensure HTTPS in production
- Try refreshing page
- Fallback to manual selection

**QR code not detected**
- Ensure QR code is within frame
- Check lighting conditions
- Try moving phone closer/farther
- Verify QR code format is valid

**API call fails**
- Check network connection
- Verify backend server is running
- Check API endpoint URLs in `.env.local`
- Check browser console for CORS errors

**Mobile layout issues**
- Clear browser cache
- Update to latest browser version
- Check viewport meta tag in HTML
- Verify CSS media queries load

---

**Documentation**: See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) and [UX_FEATURES.md](./UX_FEATURES.md)
