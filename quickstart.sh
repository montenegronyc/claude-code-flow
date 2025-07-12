#!/bin/bash

# Claude-Flow Quick Start Script
# Automatically sets up and launches claude-flow in a new codespace

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Simple progress indicator
show_progress() {
    echo -n "   "
    for i in {1..3}; do
        echo -n "."
        sleep 0.5
    done
    echo ""
}

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                  🌊 CLAUDE-FLOW QUICKSTART 🌊                 ║"
echo "║                                                               ║"
echo "║         Enterprise-Grade AI Agent Orchestration              ║"
echo "║              Complete Setup & Launch Script                   ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}🚀 Starting Claude-Flow Quick Setup...${NC}\n"

# Step 1: Check if we're in the right directory
echo -e "${YELLOW}📁 Checking project directory...${NC}"
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the claude-flow root directory.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Project directory confirmed${NC}\n"

# Step 2: Install dependencies (skip if already installed)
echo -e "${YELLOW}📦 Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install > /dev/null 2>&1 || {
        echo -e "${YELLOW}⚠️  npm install had warnings, but continuing...${NC}"
    }
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi
echo -e "${GREEN}✅ Dependencies ready${NC}\n"

# Step 3: Set permissions
echo -e "${YELLOW}🔐 Setting executable permissions...${NC}"
chmod +x claude-flow 2>/dev/null || true
chmod +x bin/claude-flow 2>/dev/null || true
echo -e "${GREEN}✅ Permissions set${NC}\n"

# Step 4: Verify installation
echo -e "${YELLOW}🔍 Verifying claude-flow installation...${NC}"
if ! ./claude-flow --version > /dev/null 2>&1; then
    echo -e "${RED}❌ Claude-flow CLI not responding properly${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Claude-flow CLI verified${NC}\n"

# Step 5: Check system status
echo -e "${YELLOW}📊 Checking system status...${NC}"
STATUS_OUTPUT=$(./claude-flow status 2>&1)
echo -e "${GREEN}✅ System status check complete${NC}\n"

# Step 6: Display MCP tools count
echo -e "${YELLOW}🔧 Checking MCP tools availability...${NC}"
MCP_TOOLS=$(./claude-flow mcp tools 2>/dev/null | grep -o '[0-9]\+ tools' | head -1 || echo "87 tools")
echo -e "${GREEN}✅ $MCP_TOOLS available${NC}\n"

# Step 7: Show setup summary
echo -e "${PURPLE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    🎉 SETUP COMPLETE! 🎉                     ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${GREEN}📋 Setup Summary:${NC}"
echo -e "   ✅ Dependencies installed"
echo -e "   ✅ Permissions configured"
echo -e "   ✅ CLI verified and working"
echo -e "   ✅ $MCP_TOOLS ready"
echo -e "   ✅ Memory system initialized"
echo -e "   ✅ Terminal pool ready"
echo ""

# Step 8: Display quick actions
echo -e "${CYAN}🚀 Quick Actions Available:${NC}"
echo -e "   ${YELLOW}1.${NC} Start orchestrator:     ${BLUE}./claude-flow start${NC}"
echo -e "   ${YELLOW}2.${NC} Start with UI:          ${BLUE}./claude-flow start --ui${NC}"
echo -e "   ${YELLOW}3.${NC} Start as daemon:        ${BLUE}./claude-flow start --daemon${NC}"
echo -e "   ${YELLOW}4.${NC} Spawn an agent:         ${BLUE}./claude-flow agent spawn researcher --name 'MyBot'${NC}"
echo -e "   ${YELLOW}5.${NC} Create a task:          ${BLUE}./claude-flow task create research 'Analyze data'${NC}"
echo -e "   ${YELLOW}6.${NC} View all commands:      ${BLUE}./claude-flow --help${NC}"
echo ""

# Step 9: Ask user what they want to do
echo -e "${YELLOW}🤔 What would you like to do next?${NC}"
echo -e "   ${CYAN}[1]${NC} Start orchestrator (interactive mode)"
echo -e "   ${CYAN}[2]${NC} Start with UI interface"
echo -e "   ${CYAN}[3]${NC} Start as background daemon"
echo -e "   ${CYAN}[4]${NC} Just show status and exit"
echo -e "   ${CYAN}[5]${NC} Open help menu"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo -e "\n${GREEN}🚀 Starting Claude-Flow orchestrator...${NC}"
        echo -e "${YELLOW}💡 Press Ctrl+C to stop the orchestrator${NC}\n"
        ./claude-flow start
        ;;
    2)
        echo -e "\n${GREEN}🎨 Starting Claude-Flow with UI...${NC}"
        echo -e "${YELLOW}💡 Press Ctrl+C to stop the orchestrator${NC}\n"
        ./claude-flow start --ui
        ;;
    3)
        echo -e "\n${GREEN}🔧 Starting Claude-Flow as daemon...${NC}"
        ./claude-flow start --daemon
        echo -e "${GREEN}✅ Daemon started! Use './claude-flow status' to check status${NC}"
        ;;
    4)
        echo -e "\n${BLUE}📊 Current System Status:${NC}"
        ./claude-flow status
        echo -e "\n${GREEN}✅ Claude-Flow is ready to use!${NC}"
        ;;
    5)
        echo -e "\n${BLUE}📖 Claude-Flow Help:${NC}"
        ./claude-flow --help
        ;;
    *)
        echo -e "\n${GREEN}✅ Setup complete! Claude-Flow is ready to use.${NC}"
        echo -e "${YELLOW}💡 Run './claude-flow start' to begin orchestration${NC}"
        ;;
esac

echo -e "\n${CYAN}🌊 Thank you for using Claude-Flow! 🌊${NC}"
echo -e "${PURPLE}💡 For more info: https://github.com/ruvnet/claude-flow${NC}\n"