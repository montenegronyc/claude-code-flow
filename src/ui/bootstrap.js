/**
 * Frontend Bootstrap - Universal Frontend Initialization Entry Point
 * Provides a single entry point for all frontend initialization scenarios
 */

import { FrontendInitializer } from './frontend-initializer.js';

/**
 * Bootstrap configuration
 */
const BOOTSTRAP_CONFIG = {
  // Environment detection
  autoDetect: true,
  
  // Component enablement
  enableConsoleUI: true,
  enableWebUI: true,
  enableTerminalUI: true,
  
  // Feature flags
  enableRealTimeUpdates: true,
  enableStatePersistence: true,
  enableMCPIntegration: true,
  enableErrorRecovery: true,
  
  // Performance settings
  initializationTimeout: 30000, // 30 seconds
  componentTimeout: 5000,       // 5 seconds per component
  
  // Fallback behavior
  enableFallbackMode: true,
  gracefulDegradation: true,
  
  // Logging
  logLevel: 'info', // 'debug', 'info', 'warn', 'error'
  enablePerformanceLogging: true
};

/**
 * Universal Frontend Bootstrap
 */
class FrontendBootstrap {
  constructor(config = {}) {
    this.config = { ...BOOTSTRAP_CONFIG, ...config };
    this.startTime = Date.now();
    this.initializer = null;
    this.isBootstrapped = false;
    this.environment = null;
    
    // Performance tracking
    this.performanceMetrics = {
      startTime: this.startTime,
      detectionTime: null,
      initializationTime: null,
      totalTime: null,
      componentTimes: new Map()
    };
    
    this.log('🚀 Frontend Bootstrap created');
  }

  /**
   * Main bootstrap entry point
   */
  async bootstrap(options = {}) {
    if (this.isBootstrapped) {
      this.log('⚠️ Frontend already bootstrapped', 'warn');
      return this.getBootstrapResult();
    }

    try {
      this.log('🌟 Starting Frontend Bootstrap...');
      this.log('═'.repeat(60));
      
      // Merge options with config
      const finalConfig = { ...this.config, ...options };
      
      // Environment detection with timeout
      this.environment = await this.detectEnvironmentWithTimeout();
      this.performanceMetrics.detectionTime = Date.now();
      
      this.log(`🌍 Environment: ${this.environment.type}`);
      this.log(`🎯 Capabilities: ${this.environment.capabilities.join(', ')}`);
      
      // Create and configure initializer
      this.initializer = new FrontendInitializer();
      
      // Initialize with timeout protection
      const initResult = await this.initializeWithTimeout(finalConfig);
      this.performanceMetrics.initializationTime = Date.now();
      
      // Validate initialization
      this.validateInitialization(initResult);
      
      // Setup post-initialization features
      await this.setupPostInitialization();
      
      // Setup performance monitoring
      if (finalConfig.enablePerformanceLogging) {
        this.setupPerformanceMonitoring();
      }
      
      this.isBootstrapped = true;
      this.performanceMetrics.totalTime = Date.now() - this.startTime;
      
      this.log('═'.repeat(60));
      this.log(`✅ Frontend Bootstrap Complete! (${this.performanceMetrics.totalTime}ms)`);
      this.logPerformanceMetrics();
      
      return this.getBootstrapResult();
      
    } catch (error) {
      this.log(`❌ Bootstrap failed: ${error.message}`, 'error');
      
      // Attempt graceful degradation
      if (this.config.gracefulDegradation) {
        return await this.attemptGracefulDegradation(error);
      }
      
      throw error;
    }
  }

  /**
   * Detect environment with timeout protection
   */
  async detectEnvironmentWithTimeout() {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Environment detection timeout')), 5000);
    });
    
    const detectionPromise = this.detectEnvironment();
    
    return Promise.race([detectionPromise, timeoutPromise]);
  }

  /**
   * Enhanced environment detection
   */
  async detectEnvironment() {
    this.log('🔍 Detecting environment...');
    
    const environment = {
      type: 'unknown',
      capabilities: [],
      features: {},
      constraints: [],
      recommendations: []
    };
    
    // Basic capability detection
    environment.features = {
      hasWindow: typeof window !== 'undefined',
      hasDocument: typeof document !== 'undefined',
      hasWebSocket: typeof WebSocket !== 'undefined',
      hasLocalStorage: typeof localStorage !== 'undefined',
      hasIndexedDB: typeof indexedDB !== 'undefined',
      hasWorkers: typeof Worker !== 'undefined',
      hasCanvas: typeof HTMLCanvasElement !== 'undefined',
      hasWebGL: this.detectWebGL(),
      hasNode: typeof process !== 'undefined' && process.versions?.node,
      hasElectron: typeof window !== 'undefined' && !!window.electronAPI,
      hasVSCode: typeof window !== 'undefined' && !!window.acquireVsCodeApi,
      hasTauri: typeof window !== 'undefined' && !!window.__TAURI__,
      hasReact: typeof window !== 'undefined' && !!window.React,
      hasVue: typeof window !== 'undefined' && !!window.Vue,
      hasAngular: typeof window !== 'undefined' && !!window.ng
    };
    
    // Performance features
    environment.features.hasPerformanceAPI = typeof performance !== 'undefined';
    environment.features.hasObserver = typeof MutationObserver !== 'undefined';
    environment.features.hasIntersectionObserver = typeof IntersectionObserver !== 'undefined';
    
    // Determine environment type and capabilities
    if (environment.features.hasVSCode) {
      environment.type = 'vscode';
      environment.capabilities = ['ui', 'state', 'messaging', 'commands'];
      environment.recommendations = ['Use VSCode-specific APIs', 'Lightweight UI components'];
      
    } else if (environment.features.hasElectron) {
      environment.type = 'electron';
      environment.capabilities = ['ui', 'state', 'messaging', 'filesystem', 'native'];
      environment.recommendations = ['Full UI features', 'Local file access', 'Native integrations'];
      
    } else if (environment.features.hasTauri) {
      environment.type = 'tauri';
      environment.capabilities = ['ui', 'state', 'messaging', 'native'];
      environment.recommendations = ['Lightweight UI', 'Rust backend integration'];
      
    } else if (environment.features.hasWindow && environment.features.hasDocument) {
      environment.type = 'browser';
      environment.capabilities = ['ui', 'state', 'messaging'];
      
      // Browser-specific capabilities
      if (environment.features.hasWebSocket) environment.capabilities.push('websocket');
      if (environment.features.hasLocalStorage) environment.capabilities.push('persistence');
      if (environment.features.hasWorkers) environment.capabilities.push('workers');
      if (environment.features.hasWebGL) environment.capabilities.push('webgl');
      
      environment.recommendations = ['Full web UI', 'WebSocket communication', 'Local storage'];
      
    } else if (environment.features.hasNode) {
      environment.type = 'node';
      environment.capabilities = ['state', 'messaging', 'filesystem'];
      environment.recommendations = ['Terminal UI', 'File system access', 'Process communication'];
      
    } else {
      environment.type = 'terminal';
      environment.capabilities = ['messaging'];
      environment.constraints = ['No UI', 'Limited state persistence'];
      environment.recommendations = ['Console output only', 'Message-based interaction'];
    }
    
    // Detect constraints and limitations
    if (!environment.features.hasLocalStorage && !environment.features.hasNode) {
      environment.constraints.push('No persistent storage');
    }
    
    if (!environment.features.hasWebSocket && !environment.features.hasNode) {
      environment.constraints.push('No real-time communication');
    }
    
    // Performance assessment
    if (environment.features.hasPerformanceAPI) {
      const memory = performance.memory;
      if (memory && memory.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
        environment.constraints.push('High memory usage');
      }
    }
    
    this.log(`✅ Environment detected: ${environment.type}`);
    return environment;
  }

  /**
   * Detect WebGL support
   */
  detectWebGL() {
    if (typeof HTMLCanvasElement === 'undefined') return false;
    
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  /**
   * Initialize with timeout protection
   */
  async initializeWithTimeout(config) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Initialization timeout')), config.initializationTimeout);
    });
    
    const initPromise = this.initializer.initialize(config);
    
    return Promise.race([initPromise, timeoutPromise]);
  }

  /**
   * Validate initialization result
   */
  validateInitialization(result) {
    if (!result.success) {
      throw new Error('Initialization failed');
    }
    
    // Check critical components
    const criticalComponents = ['stateManager', 'eventSystem'];
    const missingCritical = criticalComponents.filter(comp => 
      result.componentStatus[comp] !== 'initialized'
    );
    
    if (missingCritical.length > 0) {
      throw new Error(`Critical components failed: ${missingCritical.join(', ')}`);
    }
    
    this.log('✅ Initialization validation passed');
  }

  /**
   * Setup post-initialization features
   */
  async setupPostInitialization() {
    this.log('🔧 Setting up post-initialization features...');
    
    try {
      // Setup global error handling
      this.setupGlobalErrorHandling();
      
      // Setup hotkeys if in browser environment
      if (this.environment.capabilities.includes('ui')) {
        this.setupGlobalHotkeys();
      }
      
      // Setup health monitoring
      this.setupHealthMonitoring();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      this.log('✅ Post-initialization setup complete');
      
    } catch (error) {
      this.log(`⚠️ Post-initialization setup failed: ${error.message}`, 'warn');
      // Don't throw - these are non-critical features
    }
  }

  /**
   * Setup global error handling
   */
  setupGlobalErrorHandling() {
    const errorHandler = (error, source = 'unknown') => {
      this.log(`🚨 Global error from ${source}: ${error.message}`, 'error');
      
      // Attempt component recovery if possible
      if (this.initializer && this.config.enableErrorRecovery) {
        this.initializer.attemptComponentRecovery('affected_component');
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        errorHandler(event.error, 'window');
      });
      
      window.addEventListener('unhandledrejection', (event) => {
        errorHandler(event.reason, 'promise');
      });
    }
    
    if (typeof process !== 'undefined') {
      process.on('uncaughtException', (error) => {
        errorHandler(error, 'process');
      });
      
      process.on('unhandledRejection', (reason) => {
        errorHandler(reason, 'promise');
      });
    }
  }

  /**
   * Setup global hotkeys
   */
  setupGlobalHotkeys() {
    if (typeof document === 'undefined') return;
    
    document.addEventListener('keydown', (event) => {
      // Ctrl+Shift+F = Show frontend status
      if (event.ctrlKey && event.shiftKey && event.key === 'F') {
        event.preventDefault();
        this.showFrontendStatus();
      }
      
      // Ctrl+Shift+R = Restart frontend
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        this.restartFrontend();
      }
      
      // Ctrl+Shift+D = Toggle debug mode
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        this.toggleDebugMode();
      }
    });
    
    this.log('⌨️ Global hotkeys configured');
  }

  /**
   * Setup health monitoring
   */
  setupHealthMonitoring() {
    // Check frontend health every 30 seconds
    setInterval(() => {
      this.checkFrontendHealth();
    }, 30000);
    
    this.log('💓 Health monitoring started');
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = () => {
      this.log('🛑 Graceful shutdown initiated...');
      if (this.initializer) {
        this.initializer.cleanup();
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', shutdown);
    }
    
    if (typeof process !== 'undefined') {
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    }
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    if (typeof performance === 'undefined') return;
    
    // Monitor performance metrics every minute
    setInterval(() => {
      this.collectPerformanceMetrics();
    }, 60000);
    
    this.log('📊 Performance monitoring enabled');
  }

  /**
   * Collect performance metrics
   */
  collectPerformanceMetrics() {
    if (typeof performance === 'undefined') return;
    
    const metrics = {
      timestamp: Date.now(),
      memory: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      } : null,
      timing: performance.timing ? {
        loadComplete: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
      } : null
    };
    
    // Log performance warnings
    if (metrics.memory && metrics.memory.used > 100) { // 100MB
      this.log(`⚠️ High memory usage: ${metrics.memory.used}MB`, 'warn');
    }
    
    return metrics;
  }

  /**
   * Check frontend health
   */
  checkFrontendHealth() {
    if (!this.initializer) return;
    
    try {
      const result = this.initializer.getInitializationResult();
      const healthScore = result.initializedComponents / result.totalComponents;
      
      if (healthScore < 0.5) {
        this.log(`⚠️ Frontend health degraded: ${Math.round(healthScore * 100)}%`, 'warn');
      }
      
      return healthScore;
      
    } catch (error) {
      this.log(`❌ Health check failed: ${error.message}`, 'error');
      return 0;
    }
  }

  /**
   * Show frontend status
   */
  showFrontendStatus() {
    if (!this.initializer) {
      this.log('❌ Frontend not initialized', 'error');
      return;
    }
    
    const result = this.initializer.getInitializationResult();
    const performanceMetrics = this.collectPerformanceMetrics();
    
    console.group('🎨 Frontend Status');
    console.log('Environment:', this.environment.type);
    console.log('Initialized:', result.success);
    console.log('Components:', `${result.initializedComponents}/${result.totalComponents}`);
    console.log('Uptime:', `${Math.round((Date.now() - this.startTime) / 1000)}s`);
    
    if (performanceMetrics.memory) {
      console.log('Memory:', `${performanceMetrics.memory.used}MB`);
    }
    
    console.log('Component Status:');
    Object.entries(result.componentStatus).forEach(([name, status]) => {
      const icon = status === 'initialized' ? '✅' : 
                  status === 'failed' ? '❌' : '🔄';
      console.log(`  ${icon} ${name}: ${status}`);
    });
    
    console.groupEnd();
  }

  /**
   * Restart frontend
   */
  async restartFrontend() {
    this.log('🔄 Restarting frontend...');
    
    try {
      // Cleanup current instance
      if (this.initializer) {
        this.initializer.cleanup();
      }
      
      // Reset state
      this.isBootstrapped = false;
      this.initializer = null;
      
      // Re-bootstrap
      await this.bootstrap();
      
      this.log('✅ Frontend restarted successfully');
      
    } catch (error) {
      this.log(`❌ Frontend restart failed: ${error.message}`, 'error');
    }
  }

  /**
   * Toggle debug mode
   */
  toggleDebugMode() {
    this.config.logLevel = this.config.logLevel === 'debug' ? 'info' : 'debug';
    this.log(`🐛 Debug mode: ${this.config.logLevel === 'debug' ? 'ON' : 'OFF'}`);
  }

  /**
   * Attempt graceful degradation
   */
  async attemptGracefulDegradation(originalError) {
    this.log('🆘 Attempting graceful degradation...', 'warn');
    
    try {
      // Try minimal initialization
      this.initializer = new FrontendInitializer();
      const result = await this.initializer.initialize({
        enableConsoleUI: false,
        enableWebUI: false,
        fallbackMode: true
      });
      
      this.isBootstrapped = true;
      
      this.log('✅ Graceful degradation successful');
      
      return {
        success: true,
        degraded: true,
        originalError: originalError.message,
        ...result
      };
      
    } catch (degradationError) {
      this.log(`❌ Graceful degradation failed: ${degradationError.message}`, 'error');
      throw originalError; // Throw original error
    }
  }

  /**
   * Get bootstrap result summary
   */
  getBootstrapResult() {
    const initResult = this.initializer ? this.initializer.getInitializationResult() : null;
    
    return {
      bootstrapped: this.isBootstrapped,
      environment: this.environment,
      performance: this.performanceMetrics,
      initialization: initResult,
      config: this.config
    };
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics() {
    this.log('📊 Performance Metrics:');
    this.log(`   Detection: ${this.performanceMetrics.detectionTime - this.performanceMetrics.startTime}ms`);
    this.log(`   Initialization: ${this.performanceMetrics.initializationTime - this.performanceMetrics.detectionTime}ms`);
    this.log(`   Total: ${this.performanceMetrics.totalTime}ms`);
  }

  /**
   * Get current initializer instance
   */
  getInitializer() {
    return this.initializer;
  }

  /**
   * Execute tool through frontend system
   */
  async executeTool(toolName, params = {}) {
    if (!this.initializer) {
      throw new Error('Frontend not initialized');
    }
    
    return await this.initializer.executeTool(toolName, params);
  }

  /**
   * Navigate to view through frontend system
   */
  async navigateToView(viewId, params = {}) {
    if (!this.initializer) {
      throw new Error('Frontend not initialized');
    }
    
    return await this.initializer.navigateToView(viewId, params);
  }

  /**
   * Logging utility
   */
  log(message, level = 'info') {
    const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = logLevels[this.config.logLevel] || 1;
    const messageLevel = logLevels[level] || 1;
    
    if (messageLevel >= currentLevel) {
      const prefix = level === 'error' ? '❌' : 
                    level === 'warn' ? '⚠️' : 
                    level === 'debug' ? '🐛' : 'ℹ️';
      console.log(`${prefix} [Bootstrap] ${message}`);
    }
  }
}

// Create global bootstrap instance
const frontendBootstrap = new FrontendBootstrap();

// Export for different environments
export default frontendBootstrap;
export { FrontendBootstrap, BOOTSTRAP_CONFIG };

// Auto-bootstrap in browser environments
if (typeof window !== 'undefined') {
  // Make globally available
  window.claudeFlowBootstrap = frontendBootstrap;
  
  // Auto-bootstrap when DOM is ready (unless disabled)
  const autoBootstrap = new URLSearchParams(window.location.search).get('autoBootstrap');
  if (autoBootstrap !== 'false') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', async () => {
        try {
          await frontendBootstrap.bootstrap();
        } catch (error) {
          console.error('Auto-bootstrap failed:', error);
        }
      });
    } else {
      // DOM already ready
      frontendBootstrap.bootstrap().catch(error => {
        console.error('Auto-bootstrap failed:', error);
      });
    }
  }
}

// Node.js environment support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { frontendBootstrap, FrontendBootstrap, BOOTSTRAP_CONFIG };
}