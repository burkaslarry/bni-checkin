# 📁 Assets Directory

This directory contains visual assets for EventXP documentation and marketing materials.

## 📂 Directory Structure

```
docs/assets/
├── logos/              # EventXP logos and branding
├── screenshots/        # Product screenshots
├── diagrams/          # Architecture and flow diagrams
└── videos/            # Demo videos (links)
```

---

## 🎨 Logos

### Primary Logo
- **File**: `eventxp-logo.svg` (to be added)
- **Formats**: SVG (vector), PNG (raster)
- **Sizes**: 
  - Full: 1200x300px
  - Square: 512x512px (for favicons)
  - Small: 128x128px (for mobile)

### Brand Colors
```css
--primary: #38bdf8;    /* Sky Blue - Technology, Trust */
--secondary: #22c55e;  /* Green - Success, Growth */
--accent: #f59e0b;     /* Orange - Energy, Innovation */
--dark: #1e293b;       /* Slate - Professional */
```

---

## 📸 Screenshots

### Dashboard
- [ ] `dashboard-overview.png` - Main dashboard view
- [ ] `dashboard-realtime.png` - Real-time updates
- [ ] `dashboard-analytics.png` - Analytics view

### Check-in System
- [ ] `checkin-qr-scan.png` - QR code scanning
- [ ] `checkin-manual.png` - Manual entry
- [ ] `checkin-guest.png` - Guest check-in

### AI Matchmaker
- [ ] `ai-matchmaker-input.png` - Guest profile input
- [ ] `ai-matchmaker-results.png` - Match results (grouped)
- [ ] `ai-matchmaker-details.png` - Individual match details

### Admin Panel
- [ ] `admin-event-management.png` - Event setup
- [ ] `admin-batch-checkin.png` - Batch check-in
- [ ] `admin-export.png` - Data export

---

## 🗺️ Diagrams

### Architecture Diagrams
- [ ] `architecture-overview.svg` - Full system architecture
- [ ] `architecture-frontend.svg` - Frontend structure
- [ ] `architecture-backend.svg` - Backend API structure

### Flow Diagrams
- [ ] `flow-checkin.svg` - Check-in process
- [ ] `flow-ai-matching.svg` - AI matching workflow
- [ ] `flow-realtime-updates.svg` - WebSocket flow

### Data Flow
- [ ] `data-flow.svg` - Data pipeline
- [ ] `ai-integration.svg` - DeepSeek AI integration

---

## 🎥 Videos

### Demo Videos (to be created)
- [ ] Product Overview (2-3 minutes)
- [ ] AI Matchmaker Demo (1-2 minutes)
- [ ] Real-time Dashboard (1 minute)
- [ ] Check-in Process (30 seconds)

**Storage**: YouTube or Vimeo (embed links in documentation)

---

## 📝 How to Add Assets

### 1. Screenshots
```bash
# Take screenshots at 2x resolution (for Retina displays)
# Recommended size: 2400x1600px
# Format: PNG or JPG (PNG preferred for UI)

# Save to:
docs/assets/screenshots/feature-name.png
```

### 2. Logos
```bash
# Create vector versions (SVG) first
# Export to PNG for compatibility

# Save to:
docs/assets/logos/eventxp-logo.svg
docs/assets/logos/eventxp-logo-512.png
docs/assets/logos/eventxp-icon-128.png
```

### 3. Diagrams
```bash
# Tools:
# - Figma (design tool)
# - Excalidraw (simple diagrams)
# - draw.io / diagrams.net (flowcharts)

# Export as SVG for scalability
# Save to:
docs/assets/diagrams/diagram-name.svg
```

---

## 🔗 Using Assets in Documentation

### In Markdown
```markdown
# Screenshot
![Dashboard Overview](./docs/assets/screenshots/dashboard-overview.png)

# Logo
<img src="./docs/assets/logos/eventxp-logo.svg" alt="EventXP" width="200">

# Diagram
![Architecture](./docs/assets/diagrams/architecture-overview.svg)
```

### In HTML
```html
<!-- Logo -->
<img src="docs/assets/logos/eventxp-logo.svg" alt="EventXP Logo" class="logo">

<!-- Screenshot with caption -->
<figure>
  <img src="docs/assets/screenshots/dashboard-overview.png" alt="Dashboard">
  <figcaption>EventXP Real-time Dashboard</figcaption>
</figure>
```

---

## 📊 Asset Guidelines

### Screenshots
- **Resolution**: 2400x1600px (2x) or 1920x1080px (1x)
- **Format**: PNG with transparency where needed
- **Compression**: Use TinyPNG or similar
- **Context**: Show realistic data, not "Lorem Ipsum"
- **Annotations**: Add arrows/highlights for key features

### Logos
- **Formats**: Primary SVG, fallback PNG
- **Variants**: 
  - Full logo (with text)
  - Icon only (for favicons)
  - Light/dark versions
- **Clear space**: Maintain 1x logo height around logo

### Diagrams
- **Style**: Consistent with brand colors
- **Format**: SVG for scalability
- **Labels**: Clear, concise text
- **Flow**: Left-to-right or top-to-bottom

---

## 📦 Asset Checklist

### Critical (for MVP)
- [ ] EventXP logo (SVG + PNG)
- [ ] Favicon (128x128, 512x512)
- [ ] Dashboard screenshot
- [ ] AI Matchmaker screenshot
- [ ] Architecture diagram

### Nice to Have
- [ ] Additional screenshots
- [ ] Video demos
- [ ] Social media images
- [ ] Presentation slides

### Future
- [ ] White-label templates
- [ ] Marketing materials
- [ ] Email templates
- [ ] Print materials

---

## 🎨 Design Resources

### Tools
- **Logos**: Figma, Adobe Illustrator, Canva
- **Screenshots**: macOS Screenshot (Cmd+Shift+4), Windows Snipping Tool
- **Diagrams**: Excalidraw, draw.io, Figma
- **Editing**: Photoshop, GIMP, Photopea (online)
- **Compression**: TinyPNG, ImageOptim, Squoosh

### Inspiration
- dribbble.com - UI/UX inspiration
- awwwards.com - Web design
- producthunt.com - Product pages

---

<div align="center">

**EventXP Assets**  
Keep it professional, keep it simple, keep it scalable.

[Back to Main README](../README.md)

</div>
