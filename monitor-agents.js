#!/usr/bin/env node
// Real-time agent monitoring to ensure all agents are working

const { exec } = require('child_process');
const readline = require('readline');

class AgentMonitor {
  constructor() {
    this.agents = new Map();
    this.activities = [];
    this.startTime = Date.now();
  }

  async start() {
    console.clear();
    console.log('🐝 Claude Flow Agent Monitor v1.0');
    console.log('=================================\n');
    
    // Start monitoring loops
    setInterval(() => this.updateDisplay(), 1000);
    setInterval(() => this.checkAgentActivity(), 2000);
    setInterval(() => this.checkMemoryCoordination(), 3000);
    
    // Initial check
    await this.checkAgentActivity();
  }

  async checkAgentActivity() {
    // Check swarm status
    exec('npx claude-flow swarm status --json', (error, stdout) => {
      if (!error && stdout) {
        try {
          const status = JSON.parse(stdout);
          this.updateAgentStatus(status);
        } catch (e) {
          // Fallback to text parsing
          this.parseTextStatus(stdout);
        }
      }
    });

    // Check recent hooks
    exec('npx claude-flow hooks history --last 10 --json', (error, stdout) => {
      if (!error && stdout) {
        try {
          const hooks = JSON.parse(stdout);
          this.processHookActivity(hooks);
        } catch (e) {}
      }
    });
  }

  async checkMemoryCoordination() {
    exec('npx claude-flow memory list --pattern "swarm/*" --json', (error, stdout) => {
      if (!error && stdout) {
        try {
          const memories = JSON.parse(stdout);
          this.updateMemoryStats(memories);
        } catch (e) {}
      }
    });
  }

  updateAgentStatus(status) {
    if (status.agents) {
      status.agents.forEach(agent => {
        this.agents.set(agent.name, {
          type: agent.type,
          status: agent.status || 'idle',
          lastActivity: agent.lastActivity || Date.now(),
          tasksCompleted: agent.tasksCompleted || 0,
          currentTask: agent.currentTask || 'none'
        });
      });
    }
  }

  processHookActivity(hooks) {
    hooks.forEach(hook => {
      const agentName = this.extractAgentFromHook(hook);
      if (agentName && this.agents.has(agentName)) {
        const agent = this.agents.get(agentName);
        agent.lastActivity = Date.now();
        agent.status = 'active';
        
        this.activities.unshift({
          time: new Date().toLocaleTimeString(),
          agent: agentName,
          action: hook.type,
          details: hook.details
        });
        
        // Keep only last 20 activities
        if (this.activities.length > 20) {
          this.activities.pop();
        }
      }
    });
  }

  extractAgentFromHook(hook) {
    // Extract agent name from hook context
    if (hook.context && hook.context.agent) {
      return hook.context.agent;
    }
    // Try to parse from command
    const match = hook.command?.match(/--agent[= ]"?([^" ]+)"?/);
    return match ? match[1] : null;
  }

  updateDisplay() {
    console.clear();
    
    // Header
    console.log('🐝 Claude Flow Agent Monitor');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`⏱️  Uptime: ${this.formatUptime()} | 📊 Agents: ${this.agents.size}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Agent Status Table
    console.log('📋 AGENT STATUS');
    console.log('───────────────────────────────────────────────────────────────');
    console.log('Agent Name          | Type       | Status   | Last Active | Tasks');
    console.log('───────────────────────────────────────────────────────────────');
    
    this.agents.forEach((agent, name) => {
      const statusIcon = this.getStatusIcon(agent.status);
      const lastActive = this.formatLastActive(agent.lastActivity);
      console.log(
        `${statusIcon} ${name.padEnd(16)} | ${agent.type.padEnd(10)} | ${agent.status.padEnd(8)} | ${lastActive.padEnd(11)} | ${agent.tasksCompleted}`
      );
    });

    // Activity Feed
    console.log('\n\n📡 RECENT ACTIVITY');
    console.log('───────────────────────────────────────────────────────────────');
    
    this.activities.slice(0, 10).forEach(activity => {
      console.log(`${activity.time} | ${activity.agent} | ${activity.action}`);
    });

    // Warnings
    this.checkForIssues();
  }

  checkForIssues() {
    const now = Date.now();
    let orchestratorOnly = true;
    let inactiveAgents = [];

    this.agents.forEach((agent, name) => {
      if (name !== 'orchestrator' && now - agent.lastActivity < 60000) {
        orchestratorOnly = false;
      }
      if (now - agent.lastActivity > 120000) {
        inactiveAgents.push(name);
      }
    });

    if (orchestratorOnly && this.agents.size > 1) {
      console.log('\n⚠️  WARNING: Only orchestrator is active!');
      console.log('   Other agents may not be properly coordinating.');
      console.log('   Check: 1) Hooks in agent prompts 2) Memory usage 3) Task distribution');
    }

    if (inactiveAgents.length > 0) {
      console.log(`\n⚠️  INACTIVE AGENTS: ${inactiveAgents.join(', ')}`);
    }
  }

  getStatusIcon(status) {
    switch (status) {
      case 'active': return '🟢';
      case 'idle': return '🟡';
      case 'error': return '🔴';
      default: return '⚪';
    }
  }

  formatUptime() {
    const seconds = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  formatLastActive(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }

  parseTextStatus(output) {
    // Fallback parser for text output
    const lines = output.split('\n');
    lines.forEach(line => {
      if (line.includes('Agent:') || line.includes('agent:')) {
        // Extract agent info from text
        const match = line.match(/(\w+).*?(active|idle|working)/i);
        if (match) {
          this.agents.set(match[1], {
            type: 'unknown',
            status: match[2].toLowerCase(),
            lastActivity: Date.now(),
            tasksCompleted: 0
          });
        }
      }
    });
  }
}

// Start monitor
const monitor = new AgentMonitor();
monitor.start();

// Handle exit
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping agent monitor...');
  process.exit(0);
});