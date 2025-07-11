#!/bin/bash
# Test script to verify multi-agent execution

echo "🧪 Testing Multi-Agent Coordination..."
echo "====================================="

# 1. Initialize swarm with proper settings
echo "📋 Step 1: Initializing swarm..."
npx claude-flow swarm init \
  --topology hierarchical \
  --max-agents 6 \
  --strategy parallel \
  --enable-hooks true \
  --telemetry detailed

# 2. Check swarm status
echo -e "\n📊 Step 2: Checking swarm status..."
npx claude-flow swarm status

# 3. Test memory coordination
echo -e "\n💾 Step 3: Testing memory system..."
npx claude-flow memory store --key "test/orchestrator" --value "Orchestrator active"
npx claude-flow memory store --key "test/agent1" --value "Agent 1 active"
npx claude-flow memory list --pattern "test/*"

# 4. Check telemetry to see agent distribution
echo -e "\n📈 Step 4: Checking telemetry..."
npx claude-flow telemetry show --by-agent --last-session

# 5. Verify hooks are working
echo -e "\n🪝 Step 5: Testing coordination hooks..."
npx claude-flow hooks test --all

# 6. Show agent metrics
echo -e "\n📊 Step 6: Agent performance metrics..."
npx claude-flow agent metrics --all

echo -e "\n✅ Test complete! Check output above for:"
echo "   - Multiple active agents (not just orchestrator)"
echo "   - Memory coordination between agents"
echo "   - Hook execution logs"
echo "   - Token distribution across agents"