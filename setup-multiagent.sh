#!/bin/bash
# Complete setup sequence for proper multi-agent execution

echo "🚀 Claude Flow Multi-Agent Setup"
echo "================================"

# Step 1: Add MCP server to Claude Code
echo -e "\n📋 Step 1: Adding claude-flow MCP server..."
claude mcp add claude-flow "npx claude-flow mcp start"

# Step 2: Verify MCP server is listed
echo -e "\n✅ Step 2: Verifying MCP server configuration..."
claude mcp list

# Step 3: Initialize claude-flow with proper settings
echo -e "\n🔧 Step 3: Initializing claude-flow..."
npx claude-flow init --enable-hooks --enable-telemetry --enable-memory

# Step 4: Test the swarm system
echo -e "\n🐝 Step 4: Testing swarm initialization..."
npx claude-flow swarm init \
  --topology hierarchical \
  --max-agents 6 \
  --strategy parallel \
  --enable-hooks true \
  --telemetry detailed

# Step 5: Verify memory system is working
echo -e "\n💾 Step 5: Testing memory coordination..."
npx claude-flow memory store --key "test/setup" --value "Memory system active"
npx claude-flow memory list --pattern "test/*"

# Step 6: Test hooks are properly configured
echo -e "\n🪝 Step 6: Testing coordination hooks..."
npx claude-flow hooks test --all

# Step 7: Run a simple multi-agent test
echo -e "\n🧪 Step 7: Running multi-agent coordination test..."
npx claude-flow swarm test --agents 3 --verify-coordination

# Step 8: Show current configuration
echo -e "\n📊 Step 8: Current configuration status..."
npx claude-flow config show

# Step 9: Enable real-time monitoring
echo -e "\n📡 Step 9: Starting agent monitor (press Ctrl+C to stop)..."
echo "Run this in a separate terminal to monitor agents:"
echo "  node /workspaces/claude-flow/claude-flow-upstream/monitor-agents.js"

echo -e "\n✅ Setup complete! Next steps:"
echo "1. Restart Claude Code to load MCP server"
echo "2. Run the monitor in a separate terminal"
echo "3. Use the example coordination pattern when spawning agents"
echo "4. Check telemetry with: npx claude-flow telemetry show --by-agent"