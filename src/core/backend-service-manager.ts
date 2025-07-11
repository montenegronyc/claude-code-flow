/**
 * Backend Service Manager for Claude Flow
 * Manages lifecycle of backend services and their dependencies
 */

import { getErrorMessage } from '../utils/error-handler.js';
import type { ILogger } from './logger.js';
import type { IEventBus } from './event-bus.js';
import type { Config } from '../utils/types.js';
import { ServiceError, ServiceStartupError, ServiceShutdownError } from '../utils/errors.js';
import { delay, retry } from '../utils/helpers.js';

export enum ServiceState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error',
  MAINTENANCE = 'maintenance',
}

export interface ServiceMetrics {
  uptime: number;
  lastRestart: Date | null;
  restartCount: number;
  errorCount: number;
  lastError: string | null;
  customMetrics: Record<string, number>;
}

export interface IBackendService {
  name: string;
  version: string;
  description: string;
  dependencies: string[];
  isRequired: boolean;
  
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  getState(): ServiceState;
  getMetrics(): ServiceMetrics;
  healthCheck(): Promise<boolean>;
  
  // Optional lifecycle hooks
  beforeStart?(): Promise<void>;
  afterStart?(): Promise<void>;
  beforeStop?(): Promise<void>;
  afterStop?(): Promise<void>;
}

export interface ServiceConfig {
  startupTimeout: number;
  shutdownTimeout: number;
  healthCheckInterval: number;
  maxRestartAttempts: number;
  restartDelay: number;
  enableAutoRestart: boolean;
}

/**
 * Abstract base class for backend services
 */
export abstract class BaseBackendService implements IBackendService {
  protected state: ServiceState = ServiceState.STOPPED;
  protected metrics: ServiceMetrics;
  protected startTime: Date | null = null;
  protected healthCheckInterval?: NodeJS.Timeout;
  protected lastHealthCheck: Date | null = null;

  constructor(
    public readonly name: string,
    public readonly version: string,
    public readonly description: string,
    public readonly dependencies: string[] = [],
    public readonly isRequired: boolean = false,
    protected readonly config: ServiceConfig,
    protected readonly logger: ILogger,
    protected readonly eventBus: IEventBus,
  ) {
    this.metrics = {
      uptime: 0,
      lastRestart: null,
      restartCount: 0,
      errorCount: 0,
      lastError: null,
      customMetrics: {},
    };
  }

  async start(): Promise<void> {
    if (this.state === ServiceState.RUNNING) {
      this.logger.warn('Service already running', { service: this.name });
      return;
    }

    if (this.state === ServiceState.STARTING) {
      throw new ServiceStartupError(`Service ${this.name} is already starting`);
    }

    this.logger.info('Starting service', { 
      service: this.name,
      version: this.version,
    });

    this.state = ServiceState.STARTING;
    this.startTime = new Date();

    try {
      // Run pre-start hook
      if (this.beforeStart) {
        await this.beforeStart();
      }

      // Start the service with timeout
      await Promise.race([
        this.doStart(),
        delay(this.config.startupTimeout).then(() => {
          throw new ServiceStartupError(`Service ${this.name} startup timeout`);
        })
      ]);

      // Run post-start hook
      if (this.afterStart) {
        await this.afterStart();
      }

      this.state = ServiceState.RUNNING;
      this.startHealthChecks();
      
      this.eventBus.emit('service:started', {
        service: this.name,
        timestamp: new Date(),
      });

      this.logger.info('Service started successfully', { 
        service: this.name,
        duration: Date.now() - this.startTime.getTime(),
      });
    } catch (error) {
      this.state = ServiceState.ERROR;
      this.metrics.errorCount++;
      this.metrics.lastError = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Service startup failed', {
        service: this.name,
        error: this.metrics.lastError,
      });

      this.eventBus.emit('service:error', {
        service: this.name,
        error: this.metrics.lastError,
        timestamp: new Date(),
      });

      throw new ServiceStartupError(`Failed to start service ${this.name}`, { error });
    }
  }

  async stop(): Promise<void> {
    if (this.state === ServiceState.STOPPED) {
      this.logger.warn('Service already stopped', { service: this.name });
      return;
    }

    if (this.state === ServiceState.STOPPING) {
      throw new ServiceShutdownError(`Service ${this.name} is already stopping`);
    }

    this.logger.info('Stopping service', { service: this.name });
    this.state = ServiceState.STOPPING;

    try {
      // Stop health checks
      this.stopHealthChecks();

      // Run pre-stop hook
      if (this.beforeStop) {
        await this.beforeStop();
      }

      // Stop the service with timeout
      await Promise.race([
        this.doStop(),
        delay(this.config.shutdownTimeout).then(() => {
          throw new ServiceShutdownError(`Service ${this.name} shutdown timeout`);
        })
      ]);

      // Run post-stop hook
      if (this.afterStop) {
        await this.afterStop();
      }

      this.state = ServiceState.STOPPED;
      this.startTime = null;
      
      this.eventBus.emit('service:stopped', {
        service: this.name,
        timestamp: new Date(),
      });

      this.logger.info('Service stopped successfully', { service: this.name });
    } catch (error) {
      this.state = ServiceState.ERROR;
      this.metrics.errorCount++;
      this.metrics.lastError = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Service shutdown failed', {
        service: this.name,
        error: this.metrics.lastError,
      });

      throw new ServiceShutdownError(`Failed to stop service ${this.name}`, { error });
    }
  }

  async restart(): Promise<void> {
    this.logger.info('Restarting service', { service: this.name });
    
    try {
      await this.stop();
      await delay(this.config.restartDelay);
      await this.start();
      
      this.metrics.restartCount++;
      this.metrics.lastRestart = new Date();
      
      this.eventBus.emit('service:restarted', {
        service: this.name,
        timestamp: new Date(),
      });
    } catch (error) {
      throw new ServiceError(`Failed to restart service ${this.name}`, { error });
    }
  }

  getState(): ServiceState {
    return this.state;
  }

  getMetrics(): ServiceMetrics {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    
    return {
      ...this.metrics,
      uptime,
      customMetrics: this.getCustomMetrics(),
    };
  }

  async healthCheck(): Promise<boolean> {
    if (this.state !== ServiceState.RUNNING) {
      return false;
    }

    try {
      const healthy = await this.doHealthCheck();
      this.lastHealthCheck = new Date();
      return healthy;
    } catch (error) {
      this.logger.error('Health check failed', {
        service: this.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract doStart(): Promise<void>;
  protected abstract doStop(): Promise<void>;
  protected abstract doHealthCheck(): Promise<boolean>;

  // Override in subclasses to provide custom metrics
  protected getCustomMetrics(): Record<string, number> {
    return {};
  }

  private startHealthChecks(): void {
    if (this.config.healthCheckInterval <= 0) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthy = await this.healthCheck();
        
        if (!healthy && this.config.enableAutoRestart) {
          this.logger.warn('Service unhealthy, attempting restart', {
            service: this.name,
          });
          
          if (this.metrics.restartCount < this.config.maxRestartAttempts) {
            await this.restart();
          } else {
            this.logger.error('Service restart limit exceeded', {
              service: this.name,
              restartCount: this.metrics.restartCount,
              maxAttempts: this.config.maxRestartAttempts,
            });
            
            this.state = ServiceState.ERROR;
            this.eventBus.emit('service:failed', {
              service: this.name,
              reason: 'restart_limit_exceeded',
              timestamp: new Date(),
            });
          }
        }
      } catch (error) {
        this.logger.error('Health check error', {
          service: this.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.config.healthCheckInterval);
  }

  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }
}

/**
 * Backend Service Manager
 */
export class BackendServiceManager {
  private services = new Map<string, IBackendService>();
  private dependencyGraph = new Map<string, Set<string>>();
  private startOrder: string[] = [];
  private stopOrder: string[] = [];

  constructor(
    private logger: ILogger,
    private eventBus: IEventBus,
  ) {
    this.setupEventHandlers();
  }

  registerService(service: IBackendService): void {
    this.services.set(service.name, service);
    this.updateDependencyGraph(service);
    this.calculateOrder();
    
    this.logger.info('Service registered', {
      service: service.name,
      version: service.version,
      required: service.isRequired,
      dependencies: service.dependencies,
    });
  }

  unregisterService(serviceName: string): void {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new ServiceError(`Service not found: ${serviceName}`);
    }

    if (service.getState() === ServiceState.RUNNING) {
      throw new ServiceError(`Cannot unregister running service: ${serviceName}`);
    }

    this.services.delete(serviceName);
    this.dependencyGraph.delete(serviceName);
    this.calculateOrder();
    
    this.logger.info('Service unregistered', { service: serviceName });
  }

  async startAll(): Promise<void> {
    this.logger.info('Starting all services in dependency order...');
    
    for (const serviceName of this.startOrder) {
      const service = this.services.get(serviceName);
      if (!service) continue;

      try {
        await service.start();
      } catch (error) {
        this.logger.error('Failed to start service', {
          service: serviceName,
          error: error instanceof Error ? error.message : String(error),
        });

        if (service.isRequired) {
          // Stop all previously started services
          await this.stopStartedServices(serviceName);
          throw new ServiceError(`Required service ${serviceName} failed to start`, { error });
        }
      }
    }
    
    this.logger.info('All services started successfully');
  }

  async stopAll(): Promise<void> {
    this.logger.info('Stopping all services in reverse dependency order...');
    
    for (const serviceName of this.stopOrder) {
      const service = this.services.get(serviceName);
      if (!service) continue;

      if (service.getState() === ServiceState.RUNNING) {
        try {
          await service.stop();
        } catch (error) {
          this.logger.error('Failed to stop service', {
            service: serviceName,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    
    this.logger.info('All services stopped');
  }

  async restartService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new ServiceError(`Service not found: ${serviceName}`);
    }

    await service.restart();
  }

  getService(serviceName: string): IBackendService | undefined {
    return this.services.get(serviceName);
  }

  getAllServices(): IBackendService[] {
    return Array.from(this.services.values());
  }

  getServiceStates(): Record<string, ServiceState> {
    const states: Record<string, ServiceState> = {};
    for (const [name, service] of this.services) {
      states[name] = service.getState();
    }
    return states;
  }

  async getServiceHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    const healthChecks = Array.from(this.services.entries()).map(async ([name, service]) => {
      try {
        health[name] = await service.healthCheck();
      } catch (error) {
        health[name] = false;
      }
    });
    
    await Promise.all(healthChecks);
    return health;
  }

  getServiceMetrics(): Record<string, ServiceMetrics> {
    const metrics: Record<string, ServiceMetrics> = {};
    for (const [name, service] of this.services) {
      metrics[name] = service.getMetrics();
    }
    return metrics;
  }

  private updateDependencyGraph(service: IBackendService): void {
    const dependencies = new Set(service.dependencies);
    this.dependencyGraph.set(service.name, dependencies);
  }

  private calculateOrder(): void {
    // Topological sort to determine start order
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (serviceName: string): void => {
      if (visiting.has(serviceName)) {
        throw new ServiceError(`Circular dependency detected involving ${serviceName}`);
      }

      if (visited.has(serviceName)) {
        return;
      }

      visiting.add(serviceName);

      const dependencies = this.dependencyGraph.get(serviceName) || new Set();
      for (const dep of dependencies) {
        if (this.services.has(dep)) {
          visit(dep);
        }
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
      order.push(serviceName);
    };

    // Visit all services
    for (const serviceName of this.services.keys()) {
      if (!visited.has(serviceName)) {
        visit(serviceName);
      }
    }

    this.startOrder = order;
    this.stopOrder = [...order].reverse();
  }

  private async stopStartedServices(failedService: string): Promise<void> {
    const failedIndex = this.startOrder.indexOf(failedService);
    if (failedIndex === -1) return;

    // Stop services in reverse order up to the failed service
    const servicesToStop = this.startOrder.slice(0, failedIndex).reverse();
    
    for (const serviceName of servicesToStop) {
      const service = this.services.get(serviceName);
      if (service && service.getState() === ServiceState.RUNNING) {
        try {
          await service.stop();
        } catch (error) {
          this.logger.error('Failed to stop service during cleanup', {
            service: serviceName,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  private setupEventHandlers(): void {
    this.eventBus.on('service:error', (data: any) => {
      this.logger.warn('Service error event received', data);
    });

    this.eventBus.on('service:failed', (data: any) => {
      this.logger.error('Service failed event received', data);
    });
  }
}

/**
 * Default service configuration
 */
export const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
  startupTimeout: 30000,
  shutdownTimeout: 15000,
  healthCheckInterval: 10000,
  maxRestartAttempts: 3,
  restartDelay: 2000,
  enableAutoRestart: true,
};