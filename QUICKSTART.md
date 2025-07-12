# 🚀 Claude-Flow Quick Start

## One-Command Setup

For new codespaces, just run:

```bash
./quickstart.sh
```

This script will:
- ✅ Install all dependencies
- ✅ Set proper permissions
- ✅ Verify everything is working
- ✅ Show you 87 available MCP tools
- ✅ Give you interactive options to start

## What You'll See

The script provides 5 options:
1. **Start orchestrator** (interactive mode)
2. **Start with UI** interface  
3. **Start as daemon** (background)
4. **Show status** and exit
5. **Open help** menu

## Manual Commands (Alternative)

If you prefer manual setup:

```bash
# Basic setup
npm install
chmod +x claude-flow

# Test it works
./claude-flow --help
./claude-flow status

# Start the system
./claude-flow start
```

## Available After Setup

Once running, you can use:

```bash
# Spawn an AI agent
./claude-flow agent spawn researcher --name "MyBot"

# Create tasks
./claude-flow task create research "Analyze data"

# View MCP tools (87 available)
./claude-flow mcp tools

# Check system status
./claude-flow status
```

## Features Ready

- 🐝 **Swarm Coordination** (12 tools)
- 🧠 **Neural Networks** (15 tools) 
- 💾 **Memory Management** (12 tools)
- 📊 **Analysis & Monitoring** (13 tools)
- 🔧 **Workflow Automation** (11 tools)
- 🐙 **GitHub Integration** (8 tools)
- 🤖 **Dynamic Agents** (8 tools)
- ⚙️ **System Utilities** (8 tools)

Total: **87 MCP tools** ready to use!

---

*Run `./quickstart.sh` and you'll be up and running in under 30 seconds!*