# 🎯 EventXP - Intelligent Event Management Platform

> **Transform your events with AI-powered networking, real-time insights, and seamless check-in experiences.**

EventXP is a next-generation event management platform that combines intelligent attendee matching, real-time analytics, and automated networking to create exceptional event experiences.

---

## ✨ Key Features

### 🤖 AI-Powered Networking
- **Smart Member Matching**: DeepSeek AI analyzes attendee profiles to suggest high-value connections
- **Strategic Seating**: Automated recommendations based on professional synergies
- **Contextual Introductions**: AI-generated conversation starters and networking insights

### 📊 Real-Time Analytics
- **Live Dashboard**: Monitor attendance, engagement, and networking patterns
- **VIP Tracking**: Special attention for guests and key stakeholders
- **Export & Reporting**: Comprehensive data export for post-event analysis

### ✅ Seamless Check-In
- **QR Code Scanner**: Fast, contactless check-in
- **Offline Support**: Works without internet connection
- **Multi-Device**: Sync across tablets, phones, and desktops

### 🎨 Modern UX
- **Progressive Web App**: Install on any device
- **Responsive Design**: Works on all screen sizes
- **Dark/Light Mode**: Comfortable viewing in any environment

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Java 17+ (for backend)
- Modern web browser

### One-Command Launch
```bash
git clone <your-repo-url>
cd bni-checkin
sh run.sh
```

Access the platform:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:10000
- **API Docs**: http://localhost:10000/swagger-ui.html

---

## 📦 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    EventXP Platform                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Frontend (React + TypeScript + Vite)               │
│  ├─ Real-time Dashboard                             │
│  ├─ AI Networking Matchmaker                        │
│  ├─ QR Code Check-in Scanner                        │
│  └─ Progressive Web App (PWA)                       │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Backend API (Kotlin + Spring Boot)                 │
│  ├─ RESTful API Endpoints                           │
│  ├─ WebSocket Real-time Updates                     │
│  ├─ DeepSeek AI Integration                         │
│  └─ CSV Data Management                             │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  AI Engine (DeepSeek v3)                            │
│  ├─ Profile Analysis                                │
│  ├─ Match Scoring                                   │
│  └─ Networking Insights                             │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **PWA** - Offline-first architecture
- **WebSocket** - Real-time updates

### Backend
- **Kotlin** - Modern JVM language
- **Spring Boot 3** - Enterprise-grade framework
- **Java HttpClient** - HTTP/2 support
- **Jackson** - JSON processing

### AI & Analytics
- **DeepSeek Reasoner** - Advanced AI matching
- **CSV Analytics** - Member data processing
- **Real-time WebSocket** - Live updates

---

## 📚 Documentation

### Setup Guides
- [**Complete Setup Guide**](./SETUP.md) - Detailed installation and configuration
- [**Quick Reference**](./QUICK_REFERENCE.md) - Common commands and workflows
- [**DeepSeek AI Setup**](./DEEPSEEK_SETUP.md) - AI configuration guide

### User Guides
- [**User Guide**](./USER_GUIDE.md) - Feature walkthrough
- [**Admin Guide**](./ADMIN_GUIDE.md) - Administrative features
- [**Strategic Networking**](./STRATEGIC_SEATING_GUIDE.md) - AI matching best practices

### Technical Documentation
- [**API Documentation**](./bni-anchor-checkin-backend/README.md) - Backend API reference
- [**Frontend Architecture**](./bni-anchor-checkin/README.md) - Frontend structure
- [**Deployment Guide**](./DEPLOYMENT.md) - Production deployment

---

## 🎯 Use Cases

### 1. Business Networking Events
Perfect for BNI chapters, chambers of commerce, and professional associations:
- Automated member matching based on business synergies
- Real-time attendance tracking for accountability
- VIP guest management and personalized introductions

### 2. Corporate Events
Ideal for conferences, seminars, and team-building:
- Department-wise seating arrangements
- Speaker and VIP tracking
- Post-event networking analytics

### 3. Trade Shows & Exhibitions
Enhanced for large-scale events:
- Exhibitor-visitor matching
- Booth traffic analytics
- Lead generation insights

### 4. Educational Events
Optimized for workshops and training sessions:
- Participant skill matching
- Session attendance tracking
- Engagement analytics

---

## 🔐 Security & Privacy

- ✅ **Secure API Keys**: Backend-only storage
- ✅ **CORS Protection**: Configurable origins
- ✅ **Data Encryption**: HTTPS in production
- ✅ **GDPR Compliance**: Export and delete capabilities
- ✅ **Role-Based Access**: Admin, staff, and user roles

---

## 🌟 Key Differentiators

| Feature | EventXP | Traditional Platforms |
|---------|---------|----------------------|
| **AI Matching** | ✅ DeepSeek-powered | ❌ Manual or basic |
| **Offline Mode** | ✅ Full functionality | ❌ Online only |
| **Real-time Updates** | ✅ WebSocket | ❌ Polling/refresh |
| **Strategic Insights** | ✅ AI-generated | ❌ Basic reports |
| **Cost** | 💰 Open-source prototype | 💰💰💰 Enterprise pricing |

---

## 🚦 Roadmap

### Phase 1: Core Platform ✅
- [x] Check-in system
- [x] Real-time dashboard
- [x] Basic reporting

### Phase 2: AI Integration ✅
- [x] DeepSeek AI matching
- [x] Strategic networking
- [x] Smart recommendations

### Phase 3: Enterprise Features (In Progress)
- [ ] Supabase integration
- [ ] Multi-tenant support
- [ ] Advanced analytics dashboard
- [ ] Email notifications

### Phase 4: Scaling (Planned)
- [ ] Mobile native apps
- [ ] Calendar integrations
- [ ] CRM integrations
- [ ] White-label solution

---

## 💼 Pricing (Future Commercial Version)

### 🎯 Tier 1: Essentials - $480/year
- Basic check-in
- Real-time dashboard
- CSV export
- Up to 100 attendees/event

### 🚀 Tier 2: Professional - $2,880/year
- **All Tier 1 features**
- AI-powered networking
- Strategic seating
- VIP management
- Up to 500 attendees/event

### 🏢 Tier 3: Enterprise - Custom Pricing
- **All Tier 2 features**
- Multi-event support
- Custom branding
- Dedicated support
- Unlimited attendees

---

## 🤝 Contributing

This is a prototype for commercial development. For partnership or licensing inquiries:

📧 **Email**: [your-email@example.com]  
🌐 **Website**: [your-website.com]  
💼 **LinkedIn**: [Your LinkedIn Profile]

---

## 📄 License

**Proprietary Software** - EventXP Prototype  
© 2026 EventXP. All rights reserved.

This software is a commercial prototype. Unauthorized copying, distribution, or use is prohibited.

For licensing inquiries, please contact: [your-email@example.com]

---

## 🙏 Acknowledgments

Built with:
- [React](https://react.dev/) - UI Framework
- [Spring Boot](https://spring.io/projects/spring-boot) - Backend Framework
- [DeepSeek AI](https://www.deepseek.com/) - AI Engine
- [Vite](https://vitejs.dev/) - Build Tool

Special thanks to the open-source community for making this possible.

---

## 📞 Support

### Getting Started
1. Read the [Setup Guide](./SETUP.md)
2. Check [Quick Reference](./QUICK_REFERENCE.md)
3. Review [User Guide](./USER_GUIDE.md)

### Need Help?
- 📖 Documentation: [View all guides](./docs/)
- 🐛 Issues: [Report a bug](#)
- 💬 Discussions: [Ask questions](#)
- 📧 Email: [support@eventxp.com](#)

---

<div align="center">

**Made with ❤️ by EventXP Team**

[Website](#) • [Documentation](#) • [Demo](#) • [Contact](#)

</div>
