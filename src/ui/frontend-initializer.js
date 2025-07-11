/**
 * Frontend Initializer - Comprehensive Frontend System Initialization
 * Coordinates all frontend components, UI systems, and state management
 */

import { initializeEnhancedUI } from './web-ui/index.js';
import { ClaudeCodeConsole } from './console/js/console.js';

export class FrontendInitializer {
  constructor() {
    this.isInitialized = false;
    this.initializationStartTime = Date.now();
    this.components = new Map();
    this.eventBus = new EventTarget();
    this.config = {
      autoDetectEnvironment: true,
      enableConsoleUI: true,
      enableWebUI: true,
      enableRealTimeUpdates: true,
      enableStatePersistence: true,
      fallbackMode: false
    };
    
    // Component status tracking
    this.componentStatus = {
      consoleUI: 'not_started',
      webUI: 'not_started',
      stateManager: 'not_started',
      eventSystem: 'not_started',
      mcpIntegration: 'not_started'
    };
    
    console.log('🚀 Frontend Initializer created');
  }

  /**
   * Initialize all frontend systems
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      console.warn('Frontend already initialized');
      return this.getInitializationResult();
    }

    try {
      console.log('🌟 Starting Frontend Initialization...');
      console.log('═'.repeat(60));
      
      // Merge configuration
      this.config = { ...this.config, ...options };
      
      // Initialize core systems first
      await this.initializeEventSystem();
      await this.initializeStateManagement();
      
      // Detect environment and initialize appropriate UI systems
      const environment = this.detectEnvironment();
      console.log(`🌍 Environment detected: ${environment.type}`);
      
      // Initialize UI systems based on environment
      await this.initializeUIComponents(environment);
      
      // Initialize MCP integration
      await this.initializeMCPIntegration();
      
      // Setup cross-component communication
      await this.setupComponentCommunication();
      
      // Initialize real-time systems
      if (this.config.enableRealTimeUpdates) {
        await this.initializeRealTimeUpdates();
      }
      
      // Setup error handling and recovery
      this.setupErrorHandling();
      
      // Setup cleanup handlers
      this.setupCleanupHandlers();
      
      this.isInitialized = true;
      const initTime = Date.now() - this.initializationStartTime;
      
      console.log('═'.repeat(60));
      console.log(`✅ Frontend Initialization Complete! (${initTime}ms)`);
      console.log('📊 Component Status:');
      Object.entries(this.componentStatus).forEach(([component, status]) => {
        const statusIcon = status === 'initialized' ? '✅' : 
                          status === 'failed' ? '❌' : 
                          status === 'initializing' ? '🔄' : '⭕';
        console.log(`   ${statusIcon} ${component}: ${status}`);
      });
      
      // Emit initialization complete event
      this.eventBus.dispatchEvent(new CustomEvent('frontend:initialized', {
        detail: this.getInitializationResult()
      }));
      
      return this.getInitializationResult();
      
    } catch (error) {
      console.error('❌ Frontend Initialization Failed:', error);
      this.componentStatus.overall = 'failed';
      
      // Attempt graceful fallback
      if (!this.config.fallbackMode) {
        console.log('🔄 Attempting fallback initialization...');
        this.config.fallbackMode = true;
        return await this.initializeFallbackMode();
      }
      
      throw error;
    }
  }

  /**
   * Initialize event system
   */
  async initializeEventSystem() {
    console.log('📡 Initializing Event System...');
    this.componentStatus.eventSystem = 'initializing';
    
    try {
      // Setup global event handling
      this.setupGlobalEventHandlers();
      
      // Create event bus for cross-component communication
      this.eventBus.addEventListener('component:ready', this.handleComponentReady.bind(this));
      this.eventBus.addEventListener('component:error', this.handleComponentError.bind(this));
      this.eventBus.addEventListener('state:changed', this.handleStateChange.bind(this));
      
      this.componentStatus.eventSystem = 'initialized';
      console.log('✅ Event System initialized');
      
    } catch (error) {
      this.componentStatus.eventSystem = 'failed';
      console.error('❌ Event System initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize state management
   */
  async initializeStateManagement() {
    console.log('💾 Initializing State Management...');
    this.componentStatus.stateManager = 'initializing';
    
    try {
      // Initialize state storage
      const stateManager = {
        data: new Map(),
        subscribers: new Map(),
        
        get(key) {
          return this.data.get(key);
        },
        
        set(key, value) {
          this.data.set(key, value);
          this.notifySubscribers(key, value);
          
          // Persist to localStorage if available
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(`claude-flow:${key}`, JSON.stringify(value));
            } catch (e) {
              console.warn('Failed to persist state to localStorage:', e);
            }
          }
        },
        
        subscribe(key, callback) {
          if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
          }
          this.subscribers.get(key).add(callback);
          
          return () => this.subscribers.get(key)?.delete(callback);
        },
        
        notifySubscribers(key, value) {
          const subscribers = this.subscribers.get(key);
          if (subscribers) {
            subscribers.forEach(callback => {
              try {
                callback(value, key);
              } catch (error) {
                console.error('State subscriber error:', error);
              }
            });
          }
        },
        
        // Load persisted state
        loadPersistedState() {
          if (typeof localStorage === 'undefined') return;
          
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('claude-flow:')) {
              try {
                const stateKey = key.replace('claude-flow:', '');
                const value = JSON.parse(localStorage.getItem(key));
                this.data.set(stateKey, value);
              } catch (error) {
                console.warn(`Failed to load persisted state for ${key}:`, error);
              }
            }
          }
        }
      };
      
      // Load any persisted state
      stateManager.loadPersistedState();
      
      this.components.set('stateManager', stateManager);
      this.componentStatus.stateManager = 'initialized';
      console.log('✅ State Management initialized');
      
    } catch (error) {
      this.componentStatus.stateManager = 'failed';
      console.error('❌ State Management initialization failed:', error);
      throw error;
    }
  }

  /**
   * Detect runtime environment
   */
  detectEnvironment() {
    const environment = {
      type: 'unknown',
      hasBrowser: typeof window !== 'undefined',
      hasDocument: typeof document !== 'undefined',
      hasWebSocket: typeof WebSocket !== 'undefined',
      hasLocalStorage: typeof localStorage !== 'undefined',
      isVSCode: typeof window !== 'undefined' && window.acquireVsCodeApi,
      isNode: typeof process !== 'undefined' && process.versions?.node,
      isElectron: typeof window !== 'undefined' && window.electronAPI,
      capabilities: []
    };
    
    // Determine environment type
    if (environment.isVSCode) {
      environment.type = 'vscode';
      environment.capabilities = ['ui', 'state', 'messaging'];
    } else if (environment.isElectron) {
      environment.type = 'electron';
      environment.capabilities = ['ui', 'state', 'messaging', 'filesystem'];
    } else if (environment.hasBrowser && environment.hasDocument) {
      environment.type = 'browser';
      environment.capabilities = ['ui', 'state', 'messaging', 'websocket'];
    } else if (environment.isNode) {
      environment.type = 'node';
      environment.capabilities = ['state', 'messaging', 'filesystem'];
    } else {
      environment.type = 'terminal';
      environment.capabilities = ['messaging'];
    }
    
    return environment;
  }

  /**
   * Initialize UI components based on environment
   */
  async initializeUIComponents(environment) {
    console.log('🎨 Initializing UI Components...');
    
    try {
      // Initialize Console UI (if in browser/electron environment)
      if (environment.capabilities.includes('ui') && this.config.enableConsoleUI) {
        await this.initializeConsoleUI();
      }
      
      // Initialize Enhanced Web UI (if in browser environment)
      if (environment.capabilities.includes('ui') && this.config.enableWebUI) {
        await this.initializeEnhancedWebUI();
      }
      
      // Initialize terminal UI (if in node/terminal environment)
      if (environment.type === 'terminal' || environment.type === 'node') {
        await this.initializeTerminalUI();
      }
      
    } catch (error) {
      console.error('❌ UI Components initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Console UI
   */
  async initializeConsoleUI() {
    console.log('🖥️ Initializing Console UI...');
    this.componentStatus.consoleUI = 'initializing';
    
    try {
      // Check if DOM is ready
      if (typeof document === 'undefined') {
        throw new Error('Console UI requires DOM environment');
      }
      
      // Wait for DOM if needed
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
      }
      
      // Check for required DOM elements
      const requiredElements = ['consoleOutput', 'consoleInput'];
      const missingElements = requiredElements.filter(id => !document.getElementById(id));
      
      if (missingElements.length > 0) {
        console.warn(`Console UI elements not found: ${missingElements.join(', ')}`);
        
        // Create minimal console interface if missing
        await this.createMinimalConsoleInterface();
      }
      
      // Initialize console
      const consoleInstance = new ClaudeCodeConsole();
      await consoleInstance.init();
      
      this.components.set('consoleUI', consoleInstance);
      this.componentStatus.consoleUI = 'initialized';
      
      // Make globally available
      if (typeof window !== 'undefined') {
        window.claudeFlowConsole = consoleInstance;
      }
      
      console.log('✅ Console UI initialized');
      
    } catch (error) {
      this.componentStatus.consoleUI = 'failed';
      console.error('❌ Console UI initialization failed:', error);
      
      // Don't throw - continue with other components
      console.log('⚠️ Continuing without Console UI');
    }
  }

  /**
   * Initialize Enhanced Web UI
   */
  async initializeEnhancedWebUI() {
    console.log('🎨 Initializing Enhanced Web UI...');
    this.componentStatus.webUI = 'initializing';
    
    try {
      const existingConsole = this.components.get('consoleUI');
      const enhancedUI = await initializeEnhancedUI({
        mode: 'auto',
        existingUI: existingConsole,
        enableAllFeatures: true
      });
      
      this.components.set('webUI', enhancedUI);
      this.componentStatus.webUI = 'initialized';
      
      // Make globally available
      if (typeof window !== 'undefined') {
        window.claudeFlowEnhancedUI = enhancedUI;
      }
      
      console.log('✅ Enhanced Web UI initialized');
      
    } catch (error) {
      this.componentStatus.webUI = 'failed';
      console.error('❌ Enhanced Web UI initialization failed:', error);
      
      // Don't throw - continue with other components
      console.log('⚠️ Continuing without Enhanced Web UI');
    }
  }

  /**
   * Initialize Terminal UI for non-browser environments
   */
  async initializeTerminalUI() {
    console.log('⌨️ Initializing Terminal UI...');
    
    try {
      // Simple terminal interface for node environments
      const terminalUI = {
        initialized: true,
        type: 'terminal',
        
        write(message, type = 'info') {
          const prefix = type === 'error' ? '❌' : 
                        type === 'warning' ? '⚠️' : 
                        type === 'success' ? '✅' : 'ℹ️';
          console.log(`${prefix} ${message}`);
        },
        
        clear() {
          console.clear();
        }
      };
      
      this.components.set('terminalUI', terminalUI);
      console.log('✅ Terminal UI initialized');
      
    } catch (error) {
      console.error('❌ Terminal UI initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize MCP integration
   */
  async initializeMCPIntegration() {
    console.log('🔗 Initializing MCP Integration...');
    this.componentStatus.mcpIntegration = 'initializing';
    
    try {
      // Create MCP integration layer
      const mcpIntegration = {
        tools: new Map(),
        isConnected: false,
        
        async initializeTools() {
          // Initialize available tools
          const toolCategories = {
            neural: ['neural_train', 'neural_predict', 'neural_status', 'neural_patterns'],
            memory: ['memory_usage', 'memory_backup', 'memory_restore', 'memory_sync'],
            monitoring: ['performance_report', 'bottleneck_analyze', 'token_usage', 'health_check'],
            workflow: ['workflow_create', 'workflow_execute', 'automation_setup', 'task_orchestrate'],
            github: ['github_repo_analyze', 'github_pr_manage', 'github_issue_track'],
            daa: ['daa_agent_create', 'daa_capability_match', 'daa_resource_alloc'],
            system: ['security_scan', 'backup_create', 'diagnostic_run']
          };
          
          // Register tools
          Object.entries(toolCategories).forEach(([category, tools]) => {
            tools.forEach(tool => {
              this.tools.set(tool, {
                name: tool,
                category,
                available: true,
                lastUsed: null
              });
            });
          });
          
          console.log(`📦 Registered ${this.tools.size} MCP tools`);
        },
        
        async executeTool(toolName, params = {}) {
          const tool = this.tools.get(toolName);
          if (!tool) {
            throw new Error(`Tool not found: ${toolName}`);
          }
          
          // Simulate tool execution
          console.log(`🔧 Executing tool: ${toolName}`, params);
          
          // Update last used timestamp
          tool.lastUsed = Date.now();
          
          // Return mock result
          return {
            success: true,
            tool: toolName,
            params,
            result: `Mock result for ${toolName}`,
            timestamp: Date.now()
          };
        },
        
        getAvailableTools() {
          return Array.from(this.tools.values());
        }
      };
      
      await mcpIntegration.initializeTools();
      
      this.components.set('mcpIntegration', mcpIntegration);
      this.componentStatus.mcpIntegration = 'initialized';
      console.log('✅ MCP Integration initialized');
      
    } catch (error) {
      this.componentStatus.mcpIntegration = 'failed';
      console.error('❌ MCP Integration initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup cross-component communication
   */
  async setupComponentCommunication() {
    console.log('📡 Setting up Component Communication...');
    
    try {
      // Create communication channels between components
      const stateManager = this.components.get('stateManager');
      const consoleUI = this.components.get('consoleUI');
      const webUI = this.components.get('webUI');
      const mcpIntegration = this.components.get('mcpIntegration');
      
      // Setup state synchronization
      if (stateManager) {
        stateManager.subscribe('tool:execute', (data) => {
          if (mcpIntegration) {
            mcpIntegration.executeTool(data.tool, data.params);
          }
        });
        
        stateManager.subscribe('ui:navigate', (data) => {
          if (webUI && webUI.navigateToView) {
            webUI.navigateToView(data.viewId, data.params);
          }
        });
      }
      
      // Setup UI event forwarding
      if (consoleUI && this.eventBus) {
        // Forward console events to global event bus
        ['command', 'message', 'error'].forEach(eventType => {
          if (consoleUI.eventBus) {
            consoleUI.eventBus.addEventListener(eventType, (event) => {
              this.eventBus.dispatchEvent(new CustomEvent(`console:${eventType}`, {
                detail: event.detail
              }));
            });
          }
        });
      }
      
      console.log('✅ Component Communication setup complete');
      
    } catch (error) {
      console.error('❌ Component Communication setup failed:', error);
      throw error;
    }
  }

  /**
   * Initialize real-time updates
   */
  async initializeRealTimeUpdates() {
    console.log('⚡ Initializing Real-time Updates...');
    
    try {
      // Setup periodic updates
      const updateInterval = setInterval(() => {
        this.updateComponentStatus();
        this.emitStatusUpdate();
      }, 5000);
      
      // Store interval for cleanup
      this.components.set('updateInterval', updateInterval);
      
      // Setup immediate updates for critical events
      this.eventBus.addEventListener('tool:executed', this.handleToolExecuted.bind(this));
      this.eventBus.addEventListener('component:error', this.handleComponentError.bind(this));
      
      console.log('✅ Real-time Updates initialized');
      
    } catch (error) {
      console.error('❌ Real-time Updates initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create minimal console interface if DOM elements are missing
   */
  async createMinimalConsoleInterface() {
    console.log('🔧 Creating minimal console interface...');
    
    try {
      // Create console container if it doesn't exist
      let container = document.getElementById('claude-flow-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'claude-flow-container';
        container.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: #1a1a1a;
          color: #f8f8f2;
          font-family: 'JetBrains Mono', monospace;
          z-index: 10000;
        `;
        document.body.appendChild(container);
      }
      
      // Create console output
      if (!document.getElementById('consoleOutput')) {
        const output = document.createElement('div');
        output.id = 'consoleOutput';
        output.style.cssText = `
          height: calc(100% - 50px);
          overflow-y: auto;
          padding: 20px;
          white-space: pre-wrap;
          font-size: 14px;
          line-height: 1.4;
        `;
        container.appendChild(output);
      }
      
      // Create console input
      if (!document.getElementById('consoleInput')) {
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
          height: 50px;
          display: flex;
          align-items: center;
          padding: 0 20px;
          border-top: 1px solid #44475a;
        `;
        
        const prompt = document.createElement('span');
        prompt.textContent = 'claude-flow> ';
        prompt.style.color = '#50fa7b';
        
        const input = document.createElement('input');
        input.id = 'consoleInput';
        input.type = 'text';
        input.style.cssText = `
          flex: 1;
          background: transparent;
          border: none;
          color: #f8f8f2;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          margin-left: 10px;
        `;
        
        inputContainer.appendChild(prompt);
        inputContainer.appendChild(input);
        container.appendChild(inputContainer);
      }
      
      console.log('✅ Minimal console interface created');
      
    } catch (error) {
      console.error('❌ Failed to create minimal console interface:', error);
      throw error;
    }
  }

  /**
   * Initialize fallback mode
   */
  async initializeFallbackMode() {
    console.log('🆘 Initializing Fallback Mode...');
    
    try {
      // Reset component status
      Object.keys(this.componentStatus).forEach(key => {
        this.componentStatus[key] = 'fallback';
      });
      
      // Initialize minimal functionality
      const fallbackSystem = {
        type: 'fallback',
        initialized: true,
        
        log(message, type = 'info') {
          const prefix = type === 'error' ? '❌' : 
                        type === 'warning' ? '⚠️' : 
                        type === 'success' ? '✅' : 'ℹ️';
          console.log(`${prefix} ${message}`);
        }
      };
      
      this.components.set('fallbackSystem', fallbackSystem);
      this.isInitialized = true;
      
      console.log('✅ Fallback Mode initialized');
      console.log('⚠️ Running with limited functionality');
      
      return {
        success: true,
        mode: 'fallback',
        components: ['fallbackSystem'],
        message: 'Frontend initialized in fallback mode'
      };
      
    } catch (error) {
      console.error('❌ Fallback Mode initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup global event handlers
   */
  setupGlobalEventHandlers() {
    // Handle unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection in frontend:', event.reason);
        this.eventBus.dispatchEvent(new CustomEvent('frontend:error', {
          detail: { type: 'unhandled_rejection', error: event.reason }
        }));
      });
      
      // Handle global errors
      window.addEventListener('error', (event) => {
        console.error('Global error in frontend:', event.error);
        this.eventBus.dispatchEvent(new CustomEvent('frontend:error', {
          detail: { type: 'global_error', error: event.error }
        }));
      });
    }
  }

  /**
   * Setup error handling and recovery
   */
  setupErrorHandling() {
    this.eventBus.addEventListener('frontend:error', (event) => {
      const { type, error } = event.detail;
      console.error(`Frontend Error (${type}):`, error);
      
      // Attempt recovery for certain types of errors
      if (type === 'component_failure') {
        this.attemptComponentRecovery(error.component);
      }
    });
  }

  /**
   * Setup cleanup handlers
   */
  setupCleanupHandlers() {
    // Browser environment
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
    }
    
    // Node environment
    if (typeof process !== 'undefined') {
      process.on('SIGINT', () => {
        this.cleanup();
        process.exit(0);
      });
      
      process.on('SIGTERM', () => {
        this.cleanup();
        process.exit(0);
      });
    }
  }

  /**
   * Handle component ready events
   */
  handleComponentReady(event) {
    const { component } = event.detail;
    console.log(`🟢 Component ready: ${component}`);
  }

  /**
   * Handle component error events
   */
  handleComponentError(event) {
    const { component, error } = event.detail;
    console.error(`🔴 Component error in ${component}:`, error);
    this.componentStatus[component] = 'failed';
  }

  /**
   * Handle state change events
   */
  handleStateChange(event) {
    const { key, value } = event.detail;
    console.log(`📊 State changed: ${key}`, value);
  }

  /**
   * Handle tool execution events
   */
  handleToolExecuted(event) {
    const { tool, result } = event.detail;
    console.log(`🔧 Tool executed: ${tool}`, result);
  }

  /**
   * Update component status
   */
  updateComponentStatus() {
    this.components.forEach((component, name) => {
      if (component && typeof component === 'object') {
        // Check if component is still responsive
        try {
          if (component.getStatus) {
            const status = component.getStatus();
            this.componentStatus[name] = status;
          } else if (component.isInitialized !== undefined) {
            this.componentStatus[name] = component.isInitialized ? 'initialized' : 'failed';
          }
        } catch (error) {
          this.componentStatus[name] = 'failed';
        }
      }
    });
  }

  /**
   * Emit status update event
   */
  emitStatusUpdate() {
    this.eventBus.dispatchEvent(new CustomEvent('frontend:status_update', {
      detail: {
        status: this.componentStatus,
        uptime: Date.now() - this.initializationStartTime,
        components: Array.from(this.components.keys())
      }
    }));
  }

  /**
   * Attempt component recovery
   */
  async attemptComponentRecovery(componentName) {
    console.log(`🔄 Attempting recovery for component: ${componentName}`);
    
    try {
      const component = this.components.get(componentName);
      if (component && component.restart) {
        await component.restart();
        this.componentStatus[componentName] = 'initialized';
        console.log(`✅ Component ${componentName} recovered successfully`);
      }
    } catch (error) {
      console.error(`❌ Failed to recover component ${componentName}:`, error);
    }
  }

  /**
   * Get initialization result summary
   */
  getInitializationResult() {
    const totalComponents = Object.keys(this.componentStatus).length;
    const initializedComponents = Object.values(this.componentStatus).filter(
      status => status === 'initialized'
    ).length;
    const failedComponents = Object.values(this.componentStatus).filter(
      status => status === 'failed'
    ).length;
    
    return {
      success: this.isInitialized,
      totalComponents,
      initializedComponents,
      failedComponents,
      componentStatus: { ...this.componentStatus },
      initializationTime: Date.now() - this.initializationStartTime,
      components: Array.from(this.components.keys()),
      fallbackMode: this.config.fallbackMode
    };
  }

  /**
   * Get component by name
   */
  getComponent(name) {
    return this.components.get(name);
  }

  /**
   * Get all components
   */
  getAllComponents() {
    return new Map(this.components);
  }

  /**
   * Execute MCP tool through the frontend system
   */
  async executeTool(toolName, params = {}) {
    const mcpIntegration = this.components.get('mcpIntegration');
    if (!mcpIntegration) {
      throw new Error('MCP Integration not available');
    }
    
    const result = await mcpIntegration.executeTool(toolName, params);
    
    // Emit tool execution event
    this.eventBus.dispatchEvent(new CustomEvent('tool:executed', {
      detail: { tool: toolName, result, params }
    }));
    
    return result;
  }

  /**
   * Navigate to a specific view
   */
  async navigateToView(viewId, params = {}) {
    const webUI = this.components.get('webUI');
    if (webUI && webUI.navigateToView) {
      return await webUI.navigateToView(viewId, params);
    }
    
    // Fallback navigation
    console.log(`📄 Navigating to view: ${viewId}`, params);
    
    // Update state
    const stateManager = this.components.get('stateManager');
    if (stateManager) {
      stateManager.set('currentView', { viewId, params, timestamp: Date.now() });
    }
  }

  /**
   * Cleanup all components
   */
  cleanup() {
    console.log('🧹 Cleaning up Frontend...');
    
    // Clear intervals
    const updateInterval = this.components.get('updateInterval');
    if (updateInterval) {
      clearInterval(updateInterval);
    }
    
    // Cleanup components
    this.components.forEach((component, name) => {
      try {
        if (component && component.cleanup) {
          component.cleanup();
        }
      } catch (error) {
        console.error(`Error cleaning up component ${name}:`, error);
      }
    });
    
    // Clear all components
    this.components.clear();
    
    // Reset status
    this.isInitialized = false;
    
    console.log('✅ Frontend cleanup complete');
  }
}

// Create global instance
const frontendInitializer = new FrontendInitializer();

// Auto-initialize in browser environments
if (typeof window !== 'undefined') {
  // Make globally available
  window.claudeFlowFrontend = frontendInitializer;
  
  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await frontendInitializer.initialize();
    });
  } else {
    // DOM already ready, initialize immediately
    frontendInitializer.initialize().catch(error => {
      console.error('Auto-initialization failed:', error);
    });
  }
}

export default frontendInitializer;
export { FrontendInitializer };