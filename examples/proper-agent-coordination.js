// Example: Proper Multi-Agent Coordination Pattern

// STEP 1: Initialize swarm with proper topology
const swarmInit = {
  topology: "hierarchical",  // Best for complex tasks with clear delegation
  maxAgents: 8,
  strategy: "parallel",      // Ensures agents work simultaneously
  enableHooks: true          // Critical for coordination
};

// STEP 2: Agent spawn template with MANDATORY coordination
const agentPromptTemplate = `
You are the [AGENT_TYPE] agent in a coordinated swarm.

🔴 MANDATORY COORDINATION PROTOCOL:

1️⃣ BEFORE starting ANY work:
   npx claude-flow hooks pre-task --description "[your specific task]" --auto-spawn-agents false
   npx claude-flow memory retrieve --pattern "swarm/*/completed" # Check what others have done

2️⃣ DURING work (after EVERY major step):
   npx claude-flow hooks post-edit --file "[file]" --memory-key "swarm/[agent]/[step]"
   npx claude-flow memory store --key "swarm/[agent]/progress" --value "[what you completed]"
   
3️⃣ BEFORE making decisions:
   npx claude-flow memory list --pattern "swarm/*/decisions" # Check other agents' decisions
   
4️⃣ AFTER completing work:
   npx claude-flow hooks post-task --task-id "[task]" --analyze-performance true
   npx claude-flow memory store --key "swarm/[agent]/completed" --value "[final results]"

YOUR SPECIFIC TASK: [DETAILED_TASK_DESCRIPTION]

IMPORTANT: You must coordinate with other agents through memory. Do NOT duplicate work!
`;

// STEP 3: Example multi-agent task with proper distribution
const exampleTask = {
  mainGoal: "Build a REST API with authentication",
  
  agents: [
    {
      type: "architect",
      name: "System Designer",
      task: "Design the overall API structure, database schema, and authentication flow. Store design decisions in memory for other agents."
    },
    {
      type: "coder",
      name: "API Developer",
      task: "Implement the REST endpoints based on architect's design. Check memory for schema before starting."
    },
    {
      type: "coder", 
      name: "Auth Expert",
      task: "Implement JWT authentication system. Coordinate with API Developer through memory to avoid conflicts."
    },
    {
      type: "analyst",
      name: "DB Designer",
      task: "Create and optimize database queries. Use architect's schema from memory."
    },
    {
      type: "tester",
      name: "QA Engineer",
      task: "Write tests for all endpoints. Monitor memory for completed endpoints to test."
    },
    {
      type: "coordinator",
      name: "Project Manager",
      task: "Monitor all agents' progress through memory. Identify bottlenecks and dependencies."
    }
  ]
};

// STEP 4: Monitoring pattern to verify agent participation
const monitoringCommands = [
  "npx claude-flow swarm monitor --real-time",           // Live agent activity
  "npx claude-flow memory list --pattern 'swarm/*'",     // All coordination points
  "npx claude-flow telemetry show --by-agent",           // Token usage per agent
  "npx claude-flow hooks history --last 50"              // Recent coordination events
];

// STEP 5: Common mistakes that cause orchestrator to do everything
const commonMistakes = {
  "No coordination hooks": "Agents can't share progress without hooks",
  "Sequential spawning": "Spawn ALL agents in ONE message for parallel work",
  "Missing memory usage": "Agents must store/retrieve from shared memory",
  "No task breakdown": "Give each agent SPECIFIC, non-overlapping tasks",
  "Wrong topology": "Use hierarchical or mesh for complex multi-agent tasks"
};

module.exports = { swarmInit, agentPromptTemplate, exampleTask, monitoringCommands };