# QR Code Data Format Guide

## Overview
Simple JSON format for BNI Anchor member and guest check-ins.

## Supported Types

### 1. **Member Check-in** (BNI Anchor Member)
```json
{
  "name": "larrylo",
  "time": "2025-11-16T10:30:00.000Z",
  "type": "member",
  "membershipId": "ANCHOR-001"
}
```
- Use for all BNI Anchor members
- `membershipId`: Unique member ID (e.g., ANCHOR-001, ANCHOR-002)

---

### 2. **Guest Check-in** (Visitor/Guest)
```json
{
  "name": "karinyeung",
  "time": "2025-11-16T10:30:00.000Z",
  "type": "guest",
  "referrer": "larrylo"
}
```
- Use for guests/visitors
- `referrer`: BNI member who referred/brought the guest

---

## How to Test

### Option 1: Use Built-in Test Buttons
1. Go to **Scan QR Code** section
2. Scroll to **"Quick Test Payloads"** section
3. Click buttons to auto-fill:
   - 👤 **Member** - BNI member check-in
   - 👥 **Guest** - Guest/visitor check-in

### Option 2: Manual Entry
1. Copy one of the JSON examples above
2. Go to **Scan QR Code** section
3. Paste into **"Manual payload"** field
4. Click **Submit**

### Option 3: Generate Real QR Codes
Use https://www.qr-code-generator.com/:
1. Select "Text" mode
2. Paste one of the JSON examples
3. Generate the QR code
4. Scan with the app

---

## Quick Reference

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `name` | string | "larrylo" | Member or guest name |
| `time` | string | "2025-11-16T10:30:00.000Z" | ISO 8601 format |
| `type` | string | "member" or "guest" | Check-in type |
| `membershipId` | string | "ANCHOR-001" | Required for members |
| `referrer` | string | "larrylo" | Required for guests |

---

## Features

- ✅ **Offline Support**: Scans queue automatically when offline
- ✅ **Auto-Sync**: Syncs when connectivity restored
- ✅ **Real-time Feedback**: Success/error notifications
- ✅ **Manual Fallback**: Type or paste payloads manually

---

## API Endpoint

```bash
POST /api/attendance/scan
Content-Type: application/json

{
  "qrPayload": "{\"name\":\"larrylo\",\"time\":\"2025-11-16T10:30:00.000Z\",\"type\":\"member\",\"membershipId\":\"ANCHOR-001\"}"
}
```

Response (Success):
```json
{
  "message": "Attendance recorded successfully"
}
```

---

## Examples for Your Use

### Your Member QR:
```json
{
  "name": "larrylo",
  "time": "2025-11-16T10:30:00.000Z",
  "type": "member",
  "membershipId": "ANCHOR-001"
}
```

### Guest Example (referred by you):
```json
{
  "name": "karinyeung",
  "time": "2025-11-16T10:30:00.000Z",
  "type": "guest",
  "referrer": "larrylo"
}
```
