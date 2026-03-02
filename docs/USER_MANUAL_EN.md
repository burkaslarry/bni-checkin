# EventXP for BNI Anchor — User Manual

## Table of Contents

1. [Overview](#1-overview)
2. [Quick Start](#2-quick-start)
3. [Event Management](#3-event-management)
4. [QR Code Generation & Sharing](#4-qr-code-generation--sharing)
5. [Member Management](#5-member-management)
6. [Guest Management](#6-guest-management)
7. [Bulk Import](#7-bulk-import)
8. [Check-in Process](#8-check-in-process)
9. [Admin Manual Check-in](#9-admin-manual-check-in)
10. [Live Attendance Report](#10-live-attendance-report)
11. [Records & CSV Export](#11-records--csv-export)
12. [Strategic Seating](#12-strategic-seating)
13. [FAQ](#13-faq)

---

## 1. Overview

EventXP for BNI Anchor is an attendance management system designed for BNI chapters, featuring:

- QR Code self-service check-in
- Live attendance report with WebSocket updates
- Member and guest management
- CSV bulk import/export
- Admin batch check-in
- VIP / Speaker role tagging
- Automatic on-time / late determination
- PWA support (installable to home screen)

### Architecture

| Component | Description |
|-----------|-------------|
| Frontend | React + Vite (deployed on Vercel) |
| Backend | Spring Boot + Kotlin (deployed on Render) |
| Database | PostgreSQL |

---

## 2. Quick Start

### For Attendees (Members/Guests)

1. Scan the QR code shared by the organizer
2. Select "Member" or "Guest"
3. Search for and select your name
4. Tap "Confirm Check-in"

### For Administrators

1. Open the admin page at `/admin`
2. Create this week's event (Add Event and QR Code)
3. Import the guest list (if needed)
4. Share the QR code with attendees
5. Monitor the live report

---

## 3. Event Management

### Creating an Event

Path: Admin Page > **Add Event and QR Code**

| Field | Description | Default |
|-------|-------------|---------|
| Event Name | e.g. "Weekly Meeting" | EventXP for BNI Anchor |
| Event Date | Date of the event | Today |
| Registration Start | Check-in opens at this time | 06:30 |
| Event Start | Auto-set to registration + 30 min | 07:00 |
| On-time Cutoff | Check-ins after this are marked late | 07:05 |
| Event End | Auto-calculated | 09:00 |

After clicking "Create Event":
- All members are automatically set to "absent"
- A QR code is generated
- A PDF with the QR code is automatically downloaded

### View/Delete Event

Path: Admin Page > **Event Management**

Displays current event info including event ID, date, and time settings.

Actions:
- **View Live Report** — Opens the report page
- **Refresh** — Reload event data
- **Delete Event** — Removes the event and all attendance records (confirmation required)

---

## 4. QR Code Generation & Sharing

After creating an event, the system generates a QR code. Share it using:

| Action | Description |
|--------|-------------|
| Download PDF | Full document with event info and QR code |
| Download PNG | QR code image only |
| Copy Link | Copy the check-in URL |
| WhatsApp Share | Open WhatsApp to send |
| Email Share | Open email client to send |

The QR code contains the check-in page URL: `https://your-domain/?event=YYYY-MM-DD`

---

## 5. Member Management

Path: Admin Page > **Member Management** or `/admin/members`

### Member List

Displays all members with:
- Name
- Profession/Domain
- Standing

### Member Standing

| Standing | Color | Description |
|----------|-------|-------------|
| GREEN | Green | Active, good attendance |
| YELLOW | Yellow | Under observation |
| RED | Red | Suspended |
| BLACK | Black | Departed from chapter |

### Actions

- **Edit** — Modify profession and standing
- **Delete** — Remove member (confirmation required)
- **Reload** — Refresh from database

---

## 6. Guest Management

Path: Admin Page > **Guest Management** or `/admin/guests`

### Guest List

Displays all registered guests, filterable by event date.

Fields:
- Name
- Profession
- Referrer (inviting member)
- Event Date

### Actions

- **Filter by Event** — Dropdown to select event date
- **Edit** — Modify guest details
- **Delete** — Remove guest (confirmation required)

---

## 7. Bulk Import

Path: Admin Page > **Bulk Import** or `/admin/import`

### Import Types

- **Import Members** — Bulk add/update members
- **Import Guests** — Bulk add/update guests

### Steps

1. Select import type (Members/Guests)
2. Download the CSV template
3. Fill in the data
4. Upload the CSV file (drag-and-drop or click to browse)
5. Preview parsed results and check for errors
6. Click "Start Import" to proceed

### CSV Format

**Members CSV:**
```
name,profession
Alice Chan,Interior Designer
Bob Wong,Software Engineer
```

**Guests CSV:**
```
name,profession,phone,referrer,event_date
Alice Chan,Interior Designer,91234567,Larry Lo,2026-03-02
```

---

## 8. Check-in Process

### Self-Service Check-in (For Attendees)

1. Scan the QR code or open the check-in link
2. The page shows "EventXP for BNI Anchor Check-in"
3. Select identity: **Member** or **Guest**
4. Type your name or profession in the search bar
5. Select yourself from the list
6. Tap "Confirm Check-in"
7. A success message appears

### Check-in Rules

| Check-in Time | Status |
|---------------|--------|
| Before on-time cutoff | On-time |
| After on-time cutoff | Late |

### Duplicate Check-ins

- **Members:** Updates the check-in time (database upsert)
- **Guests:** Displays "Already checked in" — no duplicates allowed

---

## 9. Admin Manual Check-in

Path: Admin Page > **Manual Entry**

Prerequisite: An event must be created for the current week.

### Single Entry

1. Enter name and profession
2. Select identity (Member/Guest)
3. For guests, choose role: Regular / VIP / Speaker
4. Optionally enter referrer
5. Optionally adjust check-in time
6. Click "Confirm"

### Batch Check-in

1. Set the check-in time
2. Select people from the list (Members and Guests in two columns)
3. Use quick-select buttons: Select All / All Members / All Guests / Clear
4. Click "Batch Check-in"

---

## 10. Live Attendance Report

Path: `/report` or click "Live Report" from any page

### Attendance Report Tab

Real-time attendance overview:

**Stats Cards:**
- Total attendees
- On-time
- Late
- Absent
- VIP arrived
- Guest count

**Filters:** All / Members / Guests / VIP

**Attendees List:**
- Name, role badge (VIP/Guest/Speaker)
- Check-in time
- Late indicator

**Absentees List:**
- Members who have not checked in

### Real-time Updates

- WebSocket connection for instant updates
- Automatic polling every 10 seconds as backup
- Status indicator: "Connected" / "Reconnecting"

---

## 11. Records & CSV Export

Path: Report Page > **Check-in Records CSV** Tab

### Records Table

| Column | Description |
|--------|-------------|
| # | Row number |
| Name | Attendee name |
| Profession | Domain/profession |
| Type | Member / Guest |
| Check-in Time | Local time (HKT) |
| Action | Delete (guest records only) |

### Features

- **Search** — Search by name
- **Filter** — All / Members / Guests
- **Export CSV** — Custom filename, downloads complete attendance record
- **Clear All Records** — Removes all check-in records (double confirmation required)

### CSV Export Contents

```
Name,Profession,Type,Status,Check-in Time
Larry Lo,Customer Service Systems,member,On-time,22:49:10
...
Alice Chan,Interior Designer,guest,Late,22:50:05
Bob Wong,Software Engineer,vip,Late,22:50:20
```

Includes:
- All checked-in members (on-time/late with check-in time)
- All absent members (absent, no check-in time)
- All guests/VIP/speakers (role + status + check-in time)

---

## 12. Strategic Seating

Path: Admin Page > **Strategic Seating**

AI-assisted guest-to-member matching:

1. Enter guest name and profession
2. Optionally fill in target profession, bottlenecks, remarks
3. System automatically suggests best-matching members
4. Match strength shown (High/Medium/Low)
5. Supports batch matching via CSV upload

---

## 13. FAQ

### Q: Check-in page shows "No event created"?
**A:** The admin has not created an event for today. Ask the organizer to create an event from the admin page.

### Q: Cannot find my name in the search?
**A:** Make sure you selected the correct identity (Member/Guest). If you're a guest, confirm the admin has registered your name.

### Q: QR code scan shows a blank page?
**A:** Ensure your phone has an internet connection. Try refreshing the page or opening the URL directly.

### Q: How do I export the attendance record?
**A:** Open the Report page > Switch to "Check-in Records CSV" tab > Enter a filename > Click "Export CSV".

### Q: Can I modify a check-in time?
**A:** Admins can use the "Manual Entry" feature to re-check-in with a custom time.

### Q: What's the difference between Guest and VIP?
**A:** Guests are regular visitors; VIP is for distinguished guests. They display different badges in the report and are labeled separately in CSV exports.

### Q: Does the system work offline?
**A:** The system is a PWA and can be installed on your home screen. However, check-ins require an internet connection to record to the server.

### Q: What browsers are supported?
**A:** All modern browsers — Chrome, Safari, Firefox, Edge. For the best mobile experience, use Chrome (Android) or Safari (iOS).

---

*EventXP for BNI Anchor — Making every event check-in more efficient*
