# Strategic Seating Matchmaker V2 - Complete Implementation Guide

## Overview

The Strategic Seating Matchmaker is an AI-powered system designed for BNI-style networking events that intelligently assigns guests to tables based on their professional profiles, target professions, and bottlenecks. Version 2 introduces a fixed seating model with enhanced UI/UX, comprehensive testing, and robust error handling.

## Features

### Core Functionality
- **AI-Powered Matching**: Uses DeepSeek-V3/R1 API (primary) and Google Gemini 1.5 Pro (fallback) for semantic matching
- **Keyword Fallback**: Simple string-based matching algorithm when both AI APIs fail
- **Constraint Enforcement**: Max 8 people per table, prefers tables with available seats
- **Ranked Results**: Provides top alternative table options with match quality scores
- **Match History**: Tracks and exports previous seating assignments

### UI/UX Components
- **Guest Input Form**: Collect guest profile data (name, profession, target profession, bottlenecks)
- **Seating Dashboard**: Visual representation of table assignments with capacity indicators
- **Match Confirmation**: Displays reasoning and alternative options
- **Capacity Overview**: Real-time table occupancy visualization
- **History Management**: View and export previous matches as CSV

### Admin Integration
- Accessible from Admin Page under "Strategic Seating" menu
- Can be triggered after event creation
- Integrates with existing member management system

## Project Structure

```
bni-anchor-checkin/
├── src/
│   ├── types/
│   │   └── seating.ts              # Core TypeScript interfaces
│   ├── lib/
│   │   ├── aiClient.ts             # AI API calls (DeepSeek, Gemini)
│   │   ├── assignGuestToTable.ts   # Main matching logic
│   │   ├── keywordMatch.ts         # Fallback keyword matching
│   │   ├── matchGuestAPI.ts        # API service and validation
│   │   └── sampleData.ts           # Sample guests and members
│   ├── components/
│   │   ├── StrategicPlanningPanel.tsx  # Main panel with forms
│   │   └── SeatingDashboard.tsx         # Dashboard visualization
│   ├── pages/
│   │   └── AdminPage.tsx           # Integration point
│   ├── __tests__/
│   │   ├── assignGuestToTable.test.ts    # Matching logic tests
│   │   ├── matchGuestAPI.test.ts         # API validation tests
│   │   └── integration.helpers.ts        # Test utilities
│   ├── styles.css                  # All styling including dashboard
│   ├── App.tsx                      # Router setup
│   └── main.tsx
├── env.example                      # Example environment variables
├── package.json                     # Updated with test scripts
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts                # Test configuration
```

## Data Models

### Guest
```typescript
type Guest = {
  id: string;
  name: string;
  profession: string;
  targetProfession: string;
  bottlenecks: string[];
  remarks?: string;
};
```

### Member
```typescript
type Member = {
  id: string;
  name: string;
  profession: string;
  tableNumber: number; // 1-indexed
};
```

### MatchResult
```typescript
type MatchResult = {
  assignedTableNumber: number | null;
  matchStrength: "High" | "Medium" | "Low";
  matchNote: string;
  rankedTables: RankedTable[];
};
```

## API Configuration

### Environment Variables
Create `.env.local` in the project root:

```env
# DeepSeek API (Primary - Recommended for HK)
VITE_DEEPSEEK_API_KEY=your_deepseek_api_key_here
VITE_DEEPSEEK_MODEL=deepseek-v3

# Google Gemini API (Fallback)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Backend API
VITE_API_BASE=http://localhost:10000
```

### Getting API Keys

**DeepSeek API:**
1. Visit https://platform.deepseek.com
2. Sign up and create API key
3. Current model: deepseek-v3 or deepseek-r1

**Google Gemini API:**
1. Visit https://ai.google.dev
2. Create API key from Google AI Studio
3. Model: gemini-1.5-pro

## Implementation Details

### Matching Algorithm Flow

1. **Group Members by Table**: Organize all members into table groups
2. **Send to AI API**:
   - Build detailed prompt with guest profile and table info
   - Include constraint info (max 8 per table)
   - Request ranking by "Referral Potential" and "Problem Solving"
3. **Parse AI Response**: Extract JSON array of ranked tables
4. **Select Best Available Table**: Pick highest-ranked table with available seats
5. **Fallback to Keyword Matching**: If both AI APIs fail, use simple keyword matching
6. **Generate Match Note**: Explain assignment reasoning

### Keyword Matching Algorithm

If AI is unavailable, the system uses basic scoring:
- Target profession match: +3 points per keyword match
- Bottleneck resolution: +2 points per keyword match
- Available seats: +1 point per seat
- Tables scored 8+ → "High", 4-7 → "Medium", <4 → "Low"

### Constraints

- **Max Table Size**: 8 people per table
- **Preference**: Favor tables with available seats
- **Fallback**: If all tables full, assign to smallest table with notification

## Usage Guide

### For Admins

1. **Navigate to Admin Page**: Click "Strategic Seating" menu item
2. **Enter Guest Profile**:
   - Name: Guest's full name
   - Profession: Their current profession
   - Target Profession: Professional category they're seeking
   - Bottlenecks: Comma-separated pain points
   - Remarks (Optional): Additional context
3. **Click "🎯 開始配對"**: Trigger matching algorithm
4. **Review Results**: See assigned table and alternatives
5. **Confirm Assignment**: Click ✓ to save to history

### For Event Planners

- **Sample Data**: Click "📝 載入範例" to test with example guest
- **Add Members**: Click "➕ 添加會員" to add members to tables
- **View History**: Click "📊 History" to see previous assignments
- **Export Data**: Click "💾 Export" to download CSV of assignments

## Testing

### Run Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Test Coverage

- **assignGuestToTable.test.ts**: 
  - Core matching logic
  - Constraint enforcement
  - Fallback mechanisms
  - Edge cases
  - Performance benchmarks

- **matchGuestAPI.test.ts**:
  - Guest validation
  - Members validation
  - Request validation
  - Error handling

- **Integration tests** available in `integration.helpers.ts`

## Local Development

### Prerequisites
- Node.js 18+
- npm or yarn
- API keys for DeepSeek or Gemini (optional, falls back to keyword matching)

### Setup

```bash
cd bni-anchor-checkin

# Install dependencies
npm install

# Create .env.local with API keys
cp env.example .env.local
# Edit .env.local with your API keys

# Start development server
npm run dev

# Navigate to: http://localhost:5173/admin
# Click "Strategic Seating" menu
```

### Development Workflow

1. Make changes to components or logic
2. Run tests: `npm test`
3. Check console for errors: Open DevTools (F12)
4. Test UI: Manually enter data and verify matching
5. Build: `npm run build`

## Features Walkthrough

### Guest Assignment Flow
```
1. Enter Guest Profile
   ↓
2. Click "🎯 開始配對"
   ↓
3. System calls AI API (DeepSeek/Gemini)
   ├─ If success: Use AI ranking
   └─ If failure: Use keyword fallback
   ↓
4. Select best available table
   ├─ Check if table has seats
   └─ Pick next best if full
   ↓
5. Display Result Card
   ├─ Assigned table
   ├─ Match strength
   ├─ Reasoning
   └─ Alternative options
   ↓
6. Click ✓ to confirm and record
   ↓
7. View in Seating Chart
   ├─ Table highlighted
   ├─ Key connections shown
   └─ Capacity updated
   ↓
8. (Optional) View/Export History
```

### Key UI Components

**Match Confirmation Card**
- Shows guest name, profession, target
- Assigned table with color-coded strength
- Detailed reasoning from AI
- Top 3 alternative options

**Seating Chart**
- Grid of table cards
- Each table shows members and professions
- Assigned table has special highlight
- Shows "KEY CONNECTIONS" for new guest

**Capacity Overview**
- Progress bars for each table
- Color coding: Green (≤75%), Orange (75-99%), Red (100%)
- Seat count display

**History Panel**
- Timeline of recent assignments
- Quick export to CSV
- Timestamp, guest name, assigned table

## Troubleshooting

### AI API Failures

**Problem**: Matching always falls back to keyword matching

**Solution**:
1. Check `.env.local` file exists and has API keys
2. Verify API keys are correct and have quota
3. Check browser console (F12) for specific error messages
4. Temporarily disable API keys to test fallback logic

### Table Assignment Issues

**Problem**: Guest not assigned to expected table

**Solution**:
1. Check member list - ensure you have added members
2. Verify table numbers are sequential (1, 2, 3...)
3. Check for "all tables full" message
4. Review "Alternative Options" for ranked order

### Test Failures

**Problem**: Tests fail when running `npm test`

**Solution**:
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Check Node version: Should be 18+ 
3. Run specific test: `npm test -- assignGuestToTable.test.ts`
4. Check test output for detailed error messages

## Performance Notes

- Keyword matching: <100ms
- DeepSeek API: 1-3 seconds (typical)
- Gemini API: 1-2 seconds (typical)
- Batch processing 10+ guests: System handles efficiently

## Browser Compatibility

- Chrome/Chromium: ✅ Fully supported
- Firefox: ✅ Fully supported
- Safari: ✅ Fully supported
- Edge: ✅ Fully supported
- Mobile browsers: ✅ Responsive design

## Security Considerations

- API keys stored in `.env.local` (never committed to git)
- `.gitignore` includes `.env.local`
- No sensitive data stored in localStorage
- All API calls over HTTPS

## Future Enhancements

- Multi-event seating planning
- Dietary restrictions and preferences
- Conflict detection (competitors at same table)
- Seating optimization for networking efficiency
- Real-time adjustments during event
- Integration with QR code check-in system
- Statistical analysis of match success rates

## Support & Issues

For bugs or feature requests:
1. Check existing GitHub issues
2. Create detailed bug report with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/OS info
   - Screenshot if applicable
3. Include test data examples

## License

Same as parent BNI Anchor Checkin project

---

**Last Updated**: January 2026
**Version**: 2.0.0 (Fixed Seating Model)
**Status**: Production Ready
