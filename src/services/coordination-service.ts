/**
 * Coordination Manager Service Implementation  
 * Manages the coordination system as a backend service
 */

import { BaseBackendService, ServiceConfig } from '../core/backend-service-manager.js';
import type { ILogger } from '../core/logger.js';
import type { IEventBus } from '../core/event-bus.js';
import { CoordinationManager, ICoordinationManager } from '../coordination/manager.js';
import type { CoordinationConfig, Task } from '../utils/types.js';

/**
 * Coordination Manager Service wrapper
 */
export class CoordinationService extends BaseBackendService {
  private coordinationManager?: ICoordinationManager;
  private lastHealthMetrics?: Record<string, number>;

  constructor(
    private readonly coordinationConfig: CoordinationConfig,
    config: ServiceConfig,
    logger: ILogger,
    eventBus: IEventBus,
  ) {
    super(
      'coordinationManager',
      '1.0.0',
      'Task scheduling and resource coordination system for multi-agent workflows',
      ['logger', 'eventBus'],
      true, // Required service
      config,
      logger,
      eventBus,
    );
  }

  protected async doStart(): Promise<void> {
    this.logger.info('Creating coordination manager instance...');
    
    // Create coordination manager instance
    this.coordinationManager = new CoordinationManager(
      this.coordinationConfig,
      this.eventBus,
      this.logger,
    );

    this.logger.info('Initializing coordination manager...');
    
    // Initialize coordination manager
    await this.coordinationManager.initialize();
    
    this.logger.info('Coordination manager service started successfully');
  }

  protected async doStop(): Promise<void> {
    if (!this.coordinationManager) {
      return;
    }

    this.logger.info('Shutting down coordination manager...');
    
    try {
      await this.coordinationManager.shutdown();
      this.coordinationManager = undefined;
      this.logger.info('Coordination manager service stopped successfully');
    } catch (error) {
      this.logger.error('Error shutting down coordination manager', error);
      throw error;
    }
  }

  protected async doHealthCheck(): Promise<boolean> {
    if (!this.coordinationManager) {
      return false;
    }

    try {
      const health = await this.coordinationManager.getHealthStatus();
      this.lastHealthMetrics = health.metrics;
      return health.healthy;
    } catch (error) {
      this.logger.error('Coordination manager health check failed', error);
      return false;
    }
  }

  protected getCustomMetrics(): Record<string, number> {
    return this.lastHealthMetrics || {};
  }

  // Coordination Manager-specific methods
  async assignTask(task: Task, agentId: string): Promise<void> {
    if (!this.coordinationManager) {
      throw new Error('Coordination manager not initialized');
    }
    await this.coordinationManager.assignTask(task, agentId);
  }

  async getAgentTaskCount(agentId: string): Promise<number> {
    if (!this.coordinationManager) {
      throw new Error('Coordination manager not initialized');
    }
    return await this.coordinationManager.getAgentTaskCount(agentId);
  }

  async getAgentTasks(agentId: string): Promise<Task[]> {
    if (!this.coordinationManager) {
      throw new Error('Coordination manager not initialized');
    }
    return await this.coordinationManager.getAgentTasks(agentId);
  }

  async cancelTask(taskId: string, reason?: string): Promise<void> {
    if (!this.coordinationManager) {
      throw new Error('Coordination manager not initialized');
    }
    await this.coordinationManager.cancelTask(taskId, reason);
  }

  async acquireResource(resourceId: string, agentId: string): Promise<void> {
    if (!this.coordinationManager) {
      throw new Error('Coordination manager not initialized');
    }
    await this.coordinationManager.acquireResource(resourceId, agentId);
  }

  async releaseResource(resourceId: string, agentId: string): Promise<void> {
    if (!this.coordinationManager) {
      throw new Error('Coordination manager not initialized');
    }
    await this.coordinationManager.releaseResource(resourceId, agentId);
  }

  async sendMessage(from: string, to: string, message: unknown): Promise<void> {
    if (!this.coordinationManager) {
      throw new Error('Coordination manager not initialized');
    }
    await this.coordinationManager.sendMessage(from, to, message);
  }

  async getCoordinationHealthStatus(): Promise<{
    healthy: boolean;
    error?: string;
    metrics?: Record<string, number>;
  }> {
    if (!this.coordinationManager) {
      throw new Error('Coordination manager not initialized');
    }
    return await this.coordinationManager.getHealthStatus();
  }

  async performCoordinationMaintenance(): Promise<void> {
    if (!this.coordinationManager) {
      throw new Error('Coordination manager not initialized');
    }
    await this.coordinationManager.performMaintenance();
  }

  async getCoordinationMetrics(): Promise<Record<string, unknown>> {
    if (!this.coordinationManager) {
      throw new Error('Coordination manager not initialized');
    }
    return await this.coordinationManager.getCoordinationMetrics();
  }

  async enableAdvancedScheduling(): Promise<void> {
    if (!this.coordinationManager) {
      throw new Error('Coordination manager not initialized');
    }
    this.coordinationManager.enableAdvancedScheduling();
  }

  async reportConflict(
    type: 'resource' | 'task',
    id: string,
    agents: string[]
  ): Promise<void> {
    if (!this.coordinationManager) {
      throw new Error('Coordination manager not initialized');
    }
    await this.coordinationManager.reportConflict(type, id, agents);
  }

  // Get the underlying coordination manager instance
  getCoordinationManager(): ICoordinationManager | undefined {
    return this.coordinationManager;
  }

  // Override beforeStart to verify coordination configuration
  async beforeStart(): Promise<void> {
    this.logger.info('Verifying coordination manager configuration...');
    
    // Validate coordination configuration
    if (this.coordinationConfig.maxRetries < 0) {
      throw new Error('Max retries cannot be negative');
    }

    if (this.coordinationConfig.maxRetries > 100) {
      this.logger.warn('High max retries may cause performance issues', {
        maxRetries: this.coordinationConfig.maxRetries,
      });
    }

    if (this.coordinationConfig.retryDelay <= 0) {
      throw new Error('Retry delay must be greater than 0');
    }

    if (this.coordinationConfig.resourceTimeout <= 0) {
      throw new Error('Resource timeout must be greater than 0');
    }

    if (this.coordinationConfig.messageTimeout <= 0) {
      throw new Error('Message timeout must be greater than 0');
    }

    // Validate deadlock detection setting
    if (typeof this.coordinationConfig.deadlockDetection !== 'boolean') {
      throw new Error('Deadlock detection must be a boolean value');
    }

    this.logger.info('Coordination manager configuration verified', {
      maxRetries: this.coordinationConfig.maxRetries,
      retryDelay: this.coordinationConfig.retryDelay,
      deadlockDetection: this.coordinationConfig.deadlockDetection,
      resourceTimeout: this.coordinationConfig.resourceTimeout,
      messageTimeout: this.coordinationConfig.messageTimeout,
    });
  }

  // Override afterStart to emit coordination ready event
  async afterStart(): Promise<void> {
    this.eventBus.emit('coordination:ready', {
      timestamp: new Date(),
      deadlockDetection: this.coordinationConfig.deadlockDetection,
      maxRetries: this.coordinationConfig.maxRetries,
    });
    
    this.logger.info('Coordination manager service is ready for task scheduling and resource management');
  }

  // Override beforeStop to clean up resources and tasks
  async beforeStop(): Promise<void> {
    if (!this.coordinationManager) {
      return;
    }

    this.logger.info('Cleaning up coordination state before shutdown...');
    
    try {
      // Perform maintenance to clean up any orphaned resources or tasks
      await this.coordinationManager.performMaintenance();
      
      // Give time for any pending operations to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      this.logger.warn('Error during coordination pre-shutdown cleanup', error);
    }
  }

  // Override afterStop to emit shutdown event
  async afterStop(): Promise<void> {
    this.eventBus.emit('coordination:shutdown', {
      timestamp: new Date(),
    });
    
    this.logger.info('Coordination manager service shutdown complete');
  }
}