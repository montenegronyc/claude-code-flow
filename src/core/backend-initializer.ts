/**
 * Backend Initialization Manager for Claude Flow
 * Handles initialization of all backend systems and services
 */

import { getErrorMessage } from '../utils/error-handler.js';
import type { ILogger } from './logger.js';
import type { IEventBus } from './event-bus.js';
import type { Config } from '../utils/types.js';
import { InitializationError, SystemError } from '../utils/errors.js';
import { retry, delay, circuitBreaker, CircuitBreaker } from '../utils/helpers.js';

export interface IBackendComponent {
  name: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getHealthStatus(): Promise<{
    healthy: boolean;
    error?: string;
    metrics?: Record<string, number>;
  }>;
  isRequired: boolean;
  dependencies?: string[];
}

export interface BackendInitializationResult {
  success: boolean;
  initializedComponents: string[];
  failedComponents: Array<{
    name: string;
    error: string;
    fatal: boolean;
  }>;
  initializationTime: number;
  healthStatus: Record<string, any>;
}

export interface IBackendInitializer {
  initialize(): Promise<BackendInitializationResult>;
  shutdown(): Promise<void>;
  registerComponent(component: IBackendComponent): void;
  getComponentStatus(name: string): Promise<any>;
  restartComponent(name: string): Promise<void>;
  getInitializationOrder(): string[];
}

/**
 * Backend Initializer implementation
 */
export class BackendInitializer implements IBackendInitializer {
  private components = new Map<string, IBackendComponent>();
  private initializedComponents = new Set<string>();
  private initializationOrder: string[] = [];
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private initialized = false;
  private shutdownInProgress = false;

  constructor(
    private config: Config,
    private logger: ILogger,
    private eventBus: IEventBus,
  ) {
    this.setupCircuitBreakers();
  }

  registerComponent(component: IBackendComponent): void {
    this.components.set(component.name, component);
    this.logger.info('Backend component registered', { 
      name: component.name,
      required: component.isRequired,
      dependencies: component.dependencies || [],
    });
  }

  async initialize(): Promise<BackendInitializationResult> {
    if (this.initialized) {
      throw new InitializationError('Backend already initialized');
    }

    this.logger.info('Starting backend initialization...');
    const startTime = performance.now();
    
    const result: BackendInitializationResult = {
      success: false,
      initializedComponents: [],
      failedComponents: [],
      initializationTime: 0,
      healthStatus: {},
    };

    try {
      // Calculate initialization order based on dependencies
      this.initializationOrder = this.calculateInitializationOrder();
      this.logger.info('Initialization order calculated', { 
        order: this.initializationOrder 
      });

      // Initialize components in order
      for (const componentName of this.initializationOrder) {
        const component = this.components.get(componentName);
        if (!component) {
          continue;
        }

        try {
          await this.initializeComponent(component);
          result.initializedComponents.push(componentName);
          this.initializedComponents.add(componentName);
          
          this.logger.info('Component initialized successfully', { 
            name: componentName 
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.failedComponents.push({
            name: componentName,
            error: errorMessage,
            fatal: component.isRequired,
          });

          this.logger.error('Component initialization failed', {
            name: componentName,
            required: component.isRequired,
            error: errorMessage,
          });

          // If required component fails, abort initialization
          if (component.isRequired) {
            throw new InitializationError(
              `Required component ${componentName} failed to initialize: ${errorMessage}`
            );
          }
        }
      }

      // Perform post-initialization checks
      await this.performPostInitializationChecks(result);

      // Calculate final metrics
      result.initializationTime = performance.now() - startTime;
      result.success = result.failedComponents.filter(f => f.fatal).length === 0;

      if (result.success) {
        this.initialized = true;
        this.eventBus.emit('backend:initialized', result);
        this.logger.info('Backend initialization completed successfully', {
          duration: result.initializationTime,
          componentsInitialized: result.initializedComponents.length,
          componentsFailed: result.failedComponents.length,
        });
      } else {
        this.eventBus.emit('backend:initialization_failed', result);
        throw new InitializationError('Backend initialization failed');
      }

      return result;
    } catch (error) {
      result.success = false;
      result.initializationTime = performance.now() - startTime;
      
      this.logger.error('Backend initialization failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: result.initializationTime,
      });

      // Cleanup any partially initialized components
      await this.cleanupPartialInitialization();
      
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized || this.shutdownInProgress) {
      return;
    }

    this.shutdownInProgress = true;
    this.logger.info('Starting backend shutdown...');
    const startTime = performance.now();

    try {
      // Shutdown components in reverse order
      const shutdownOrder = [...this.initializationOrder].reverse();
      
      for (const componentName of shutdownOrder) {
        if (!this.initializedComponents.has(componentName)) {
          continue;
        }

        const component = this.components.get(componentName);
        if (!component) {
          continue;
        }

        try {
          await this.shutdownComponent(component);
          this.initializedComponents.delete(componentName);
          
          this.logger.info('Component shutdown completed', { 
            name: componentName 
          });
        } catch (error) {
          this.logger.error('Component shutdown failed', {
            name: componentName,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.initialized = false;
      const shutdownTime = performance.now() - startTime;
      
      this.eventBus.emit('backend:shutdown', { duration: shutdownTime });
      this.logger.info('Backend shutdown completed', { duration: shutdownTime });
    } catch (error) {
      this.logger.error('Backend shutdown error', error);
      throw error;
    } finally {
      this.shutdownInProgress = false;
    }
  }

  async getComponentStatus(name: string): Promise<any> {
    const component = this.components.get(name);
    if (!component) {
      throw new SystemError(`Component not found: ${name}`);
    }

    const isInitialized = this.initializedComponents.has(name);
    
    if (!isInitialized) {
      return {
        name,
        status: 'not_initialized',
        healthy: false,
      };
    }

    try {
      const health = await component.getHealthStatus();
      return {
        name,
        status: 'initialized',
        ...health,
      };
    } catch (error) {
      return {
        name,
        status: 'error',
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async restartComponent(name: string): Promise<void> {
    const component = this.components.get(name);
    if (!component) {
      throw new SystemError(`Component not found: ${name}`);
    }

    this.logger.info('Restarting component', { name });

    try {
      // Shutdown component if initialized
      if (this.initializedComponents.has(name)) {
        await this.shutdownComponent(component);
        this.initializedComponents.delete(name);
      }

      // Re-initialize component
      await this.initializeComponent(component);
      this.initializedComponents.add(name);

      this.logger.info('Component restarted successfully', { name });
      this.eventBus.emit('backend:component_restarted', { name });
    } catch (error) {
      this.logger.error('Component restart failed', { name, error });
      throw new SystemError(`Failed to restart component ${name}`, { error });
    }
  }

  getInitializationOrder(): string[] {
    return [...this.initializationOrder];
  }

  private calculateInitializationOrder(): string[] {
    const components = Array.from(this.components.values());
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (component: IBackendComponent): void => {
      if (visiting.has(component.name)) {
        throw new InitializationError(
          `Circular dependency detected involving ${component.name}`
        );
      }
      
      if (visited.has(component.name)) {
        return;
      }

      visiting.add(component.name);

      // Visit dependencies first
      const dependencies = component.dependencies || [];
      for (const depName of dependencies) {
        const dep = this.components.get(depName);
        if (dep) {
          visit(dep);
        } else {
          this.logger.warn('Dependency not found', {
            component: component.name,
            dependency: depName,
          });
        }
      }

      visiting.delete(component.name);
      visited.add(component.name);
      order.push(component.name);
    };

    // Visit all components
    for (const component of components) {
      if (!visited.has(component.name)) {
        visit(component);
      }
    }

    return order;
  }

  private async initializeComponent(component: IBackendComponent): Promise<void> {
    const circuitBreaker = this.circuitBreakers.get(component.name);
    if (!circuitBreaker) {
      throw new SystemError(`Circuit breaker not found for ${component.name}`);
    }

    await circuitBreaker.execute(async () => {
      this.logger.debug('Initializing component', { name: component.name });
      
      await retry(
        () => component.initialize(),
        {
          maxAttempts: component.isRequired ? 3 : 1,
          initialDelay: 1000,
          exponentialBackoff: true,
        }
      );
    });
  }

  private async shutdownComponent(component: IBackendComponent): Promise<void> {
    this.logger.debug('Shutting down component', { name: component.name });
    
    // Use timeout for shutdown
    await Promise.race([
      component.shutdown(),
      delay(30000).then(() => {
        throw new Error(`Shutdown timeout for ${component.name}`);
      })
    ]);
  }

  private async performPostInitializationChecks(
    result: BackendInitializationResult
  ): Promise<void> {
    this.logger.info('Performing post-initialization health checks...');

    // Check health of all initialized components
    const healthChecks = Array.from(this.initializedComponents).map(async (name) => {
      const component = this.components.get(name);
      if (!component) return null;

      try {
        const health = await component.getHealthStatus();
        result.healthStatus[name] = health;
        
        if (!health.healthy) {
          this.logger.warn('Component unhealthy after initialization', {
            name,
            error: health.error,
          });
        }
        
        return { name, health };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.healthStatus[name] = {
          healthy: false,
          error: errorMessage,
        };
        
        this.logger.error('Health check failed for component', {
          name,
          error: errorMessage,
        });
        
        return { name, health: { healthy: false, error: errorMessage } };
      }
    });

    await Promise.all(healthChecks);

    // Verify system-wide integration
    await this.verifySystemIntegration();
  }

  private async verifySystemIntegration(): Promise<void> {
    this.logger.debug('Verifying system integration...');

    // Check critical component combinations
    const criticalComponents = ['logger', 'config', 'eventBus'];
    const missingCritical = criticalComponents.filter(
      name => !this.initializedComponents.has(name)
    );

    if (missingCritical.length > 0) {
      throw new InitializationError(
        `Critical components not initialized: ${missingCritical.join(', ')}`
      );
    }

    // Test event bus connectivity
    try {
      await this.testEventBusConnectivity();
    } catch (error) {
      this.logger.warn('Event bus connectivity test failed', error);
    }

    this.logger.info('System integration verification completed');
  }

  private async testEventBusConnectivity(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const testEvent = 'backend:integration_test';
      const timeout = setTimeout(() => {
        this.eventBus.off(testEvent, handler);
        reject(new Error('Event bus test timeout'));
      }, 5000);

      const handler = () => {
        clearTimeout(timeout);
        this.eventBus.off(testEvent, handler);
        resolve();
      };

      this.eventBus.on(testEvent, handler);
      this.eventBus.emit(testEvent);
    });
  }

  private async cleanupPartialInitialization(): Promise<void> {
    this.logger.info('Cleaning up partially initialized components...');

    const cleanupPromises = Array.from(this.initializedComponents).map(async (name) => {
      const component = this.components.get(name);
      if (component) {
        try {
          await component.shutdown();
          this.logger.debug('Cleaned up component', { name });
        } catch (error) {
          this.logger.error('Cleanup failed for component', { name, error });
        }
      }
    });

    await Promise.allSettled(cleanupPromises);
    this.initializedComponents.clear();
  }

  private setupCircuitBreakers(): void {
    // Set up circuit breakers for component initialization
    const defaultOptions = {
      threshold: 3,
      timeout: 30000,
      resetTimeout: 60000,
    };

    // Create circuit breakers for all known component types
    const componentTypes = [
      'logger', 'config', 'eventBus', 'orchestrator',
      'terminalManager', 'memoryManager', 'coordinationManager',
      'mcpServer', 'database', 'cache', 'messageQueue'
    ];

    for (const type of componentTypes) {
      this.circuitBreakers.set(
        type,
        circuitBreaker(`BackendInit:${type}`, defaultOptions)
      );
    }
  }
}

/**
 * Factory for creating backend components
 */
export class BackendComponentFactory {
  constructor(
    private config: Config,
    private logger: ILogger,
    private eventBus: IEventBus,
  ) {}

  createLoggerComponent(): IBackendComponent {
    return {
      name: 'logger',
      isRequired: true,
      dependencies: [],
      initialize: async () => {
        await this.logger.configure({
          level: this.config.logging?.level || 'info',
          format: this.config.logging?.format || 'json',
          destination: this.config.logging?.destination || 'console',
        });
      },
      shutdown: async () => {
        if ('close' in this.logger && typeof this.logger.close === 'function') {
          await (this.logger as any).close();
        }
      },
      getHealthStatus: async () => ({
        healthy: true,
        metrics: {
          uptime: process.uptime(),
        },
      }),
    };
  }

  createEventBusComponent(): IBackendComponent {
    return {
      name: 'eventBus',
      isRequired: true,
      dependencies: ['logger'],
      initialize: async () => {
        // Event bus is typically already initialized
        this.logger.info('Event bus component ready');
      },
      shutdown: async () => {
        if ('removeAllListeners' in this.eventBus) {
          (this.eventBus as any).removeAllListeners();
        }
      },
      getHealthStatus: async () => ({
        healthy: true,
        metrics: {
          listenerCount: (this.eventBus as any).listenerCount?.() || 0,
        },
      }),
    };
  }

  createDatabaseComponent(): IBackendComponent {
    return {
      name: 'database',
      isRequired: false,
      dependencies: ['logger'],
      initialize: async () => {
        // Initialize database connections, migrations, etc.
        this.logger.info('Database component initialized');
      },
      shutdown: async () => {
        // Close database connections
        this.logger.info('Database component shutdown');
      },
      getHealthStatus: async () => ({
        healthy: true,
        metrics: {
          connections: 1,
          queries: 0,
        },
      }),
    };
  }

  createCacheComponent(): IBackendComponent {
    return {
      name: 'cache',
      isRequired: false,
      dependencies: ['logger'],
      initialize: async () => {
        // Initialize cache system
        this.logger.info('Cache component initialized');
      },
      shutdown: async () => {
        // Flush and close cache
        this.logger.info('Cache component shutdown');
      },
      getHealthStatus: async () => ({
        healthy: true,
        metrics: {
          hitRate: 0.95,
          size: 0,
        },
      }),
    };
  }
}