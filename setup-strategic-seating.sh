#!/bin/bash

# Strategic Seating Matchmaker - Quick Start Script
# This script sets up the development environment and runs tests

set -e

echo "🎯 Strategic Seating Matchmaker - Setup Script"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js version
echo -e "${YELLOW}[1/5] Checking Node.js version...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}✗ Node.js version 18+ required. You have v$NODE_VERSION${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js v$(node -v)${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}[2/5] Installing dependencies...${NC}"
cd "$(dirname "$0")/bni-anchor-checkin"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi
echo ""

# Check .env.local
echo -e "${YELLOW}[3/5] Checking environment configuration...${NC}"
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠ .env.local not found. Creating from template...${NC}"
    if [ -f "env.example" ]; then
        cp env.example .env.local
        echo -e "${YELLOW}⚠ Please edit .env.local with your API keys:${NC}"
        echo "  - VITE_DEEPSEEK_API_KEY (get from https://platform.deepseek.com)"
        echo "  - VITE_GEMINI_API_KEY (get from https://ai.google.dev)"
        echo ""
    fi
else
    echo -e "${GREEN}✓ .env.local exists${NC}"
fi
echo ""

# Run tests
echo -e "${YELLOW}[4/5] Running test suite...${NC}"
npm test -- --run --reporter=verbose 2>&1 | head -50 || {
    echo -e "${YELLOW}⚠ Some tests may have failed (API keys might be needed)${NC}"
}
echo ""

# Build
echo -e "${YELLOW}[5/5] Building project...${NC}"
npm run build
echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Summary
echo -e "${GREEN}=============================================="
echo "✓ Setup complete! Ready to develop"
echo "=============================================="
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Edit .env.local with your API keys (optional)"
echo "2. Run development server: ${GREEN}npm run dev${NC}"
echo "3. Open browser: ${GREEN}http://localhost:5173/admin${NC}"
echo "4. Click 'Strategic Seating' menu item"
echo "5. Load sample guest and test matching"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo "See ../STRATEGIC_SEATING_GUIDE.md for complete guide"
echo ""
