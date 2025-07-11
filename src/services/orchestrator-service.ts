/**
 * Orchestrator Service Implementation
 * Manages the main orchestrator as a backend service
 */

import { BaseBackendService, ServiceConfig } from '../core/backend-service-manager.js';
import type { ILogger } from '../core/logger.js';
import type { IEventBus } from '../core/event-bus.js';
import { Orchestrator, IOrchestrator } from '../core/orchestrator.js';
import type { 
  Config, 
  AgentProfile, 
  Task, 
  HealthStatus,
  OrchestratorMetrics 
} from '../utils/types.js';
import type { ITerminalManager } from '../terminal/manager.js';
import type { IMemoryManager } from '../memory/manager.js';
import type { ICoordinationManager } from '../coordination/manager.js';
import type { IMCPServer } from '../mcp/server.js';

/**
 * Orchestrator Service wrapper
 */
export class OrchestratorService extends BaseBackendService {
  private orchestrator?: IOrchestrator;
  private lastHealthStatus?: HealthStatus;
  private lastMetrics?: OrchestratorMetrics;

  constructor(
    private readonly appConfig: Config,
    private readonly terminalManager: ITerminalManager,
    private readonly memoryManager: IMemoryManager,
    private readonly coordinationManager: ICoordinationManager,
    private readonly mcpServer: IMCPServer,
    config: ServiceConfig,
    logger: ILogger,
    eventBus: IEventBus,
  ) {
    super(
      'orchestrator',
      '1.0.0',
      'Main Claude Flow orchestrator for agent management and coordination',
      ['logger', 'eventBus', 'terminalManager', 'memoryManager', 'coordinationManager', 'mcpServer'],
      true, // Required service
      config,
      logger,
      eventBus,
    );
  }

  protected async doStart(): Promise<void> {
    this.logger.info('Creating orchestrator instance...');
    
    // Create orchestrator instance
    this.orchestrator = new Orchestrator(
      this.appConfig,
      this.terminalManager,
      this.memoryManager,
      this.coordinationManager,
      this.mcpServer,
      this.eventBus,
      this.logger,
    );

    this.logger.info('Initializing orchestrator...');
    
    // Initialize orchestrator
    await this.orchestrator.initialize();
    
    this.logger.info('Orchestrator service started successfully');
  }

  protected async doStop(): Promise<void> {
    if (!this.orchestrator) {
      return;
    }

    this.logger.info('Shutting down orchestrator...');
    
    try {
      await this.orchestrator.shutdown();
      this.orchestrator = undefined;
      this.logger.info('Orchestrator service stopped successfully');
    } catch (error) {
      this.logger.error('Error shutting down orchestrator', error);
      throw error;
    }
  }

  protected async doHealthCheck(): Promise<boolean> {
    if (!this.orchestrator) {
      return false;
    }

    try {
      this.lastHealthStatus = await this.orchestrator.getHealthStatus();
      return this.lastHealthStatus.status === 'healthy';
    } catch (error) {
      this.logger.error('Orchestrator health check failed', error);
      return false;
    }
  }

  protected getCustomMetrics(): Record<string, number> {
    if (!this.orchestrator || !this.lastHealthStatus) {
      return {};
    }

    const orchestratorMetrics = this.lastHealthStatus.components.orchestrator?.metrics || {};
    
    return {
      activeAgents: typeof orchestratorMetrics.activeAgents === 'number' ? orchestratorMetrics.activeAgents : 0,
      queuedTasks: typeof orchestratorMetrics.queuedTasks === 'number' ? orchestratorMetrics.queuedTasks : 0,
      memoryUsageMB: typeof orchestratorMetrics.memoryUsage === 'number' ? orchestratorMetrics.memoryUsage : 0,
      uptime: typeof orchestratorMetrics.uptime === 'number' ? orchestratorMetrics.uptime : 0,
    };
  }

  // Orchestrator-specific methods
  async spawnAgent(profile: AgentProfile): Promise<string> {
    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized');
    }
    return await this.orchestrator.spawnAgent(profile);
  }

  async terminateAgent(agentId: string): Promise<void> {
    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized');
    }
    await this.orchestrator.terminateAgent(agentId);
  }

  async assignTask(task: Task): Promise<void> {
    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized');
    }
    await this.orchestrator.assignTask(task);
  }

  async getOrchestratorHealthStatus(): Promise<HealthStatus> {
    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized');
    }
    return await this.orchestrator.getHealthStatus();
  }

  async getOrchestratorMetrics(): Promise<OrchestratorMetrics> {
    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized');
    }
    this.lastMetrics = await this.orchestrator.getMetrics();
    return this.lastMetrics;
  }

  async performOrchestratorMaintenance(): Promise<void> {
    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized');
    }
    await this.orchestrator.performMaintenance();
  }

  // Get the underlying orchestrator instance
  getOrchestrator(): IOrchestrator | undefined {
    return this.orchestrator;
  }

  // Override beforeStart to verify dependencies
  async beforeStart(): Promise<void> {
    this.logger.info('Verifying orchestrator dependencies...');
    
    // Verify all dependencies are properly initialized
    const dependencies = [
      { name: 'terminalManager', instance: this.terminalManager },
      { name: 'memoryManager', instance: this.memoryManager },
      { name: 'coordinationManager', instance: this.coordinationManager },
      { name: 'mcpServer', instance: this.mcpServer },
    ];

    for (const dep of dependencies) {
      if (!dep.instance) {
        throw new Error(`Dependency not available: ${dep.name}`);
      }

      // Check if dependency has health status method
      if ('getHealthStatus' in dep.instance && typeof dep.instance.getHealthStatus === 'function') {
        try {
          const health = await dep.instance.getHealthStatus();
          if (!health.healthy) {
            throw new Error(`Dependency unhealthy: ${dep.name} - ${health.error || 'Unknown error'}`);
          }
        } catch (error) {
          this.logger.warn(`Could not check health of dependency ${dep.name}`, error);
        }
      }
    }

    this.logger.info('All orchestrator dependencies verified');
  }

  // Override afterStart to emit orchestrator ready event
  async afterStart(): Promise<void> {
    this.eventBus.emit('orchestrator:ready', {
      timestamp: new Date(),
      config: this.appConfig,
    });
    
    this.logger.info('Orchestrator service is ready and operational');
  }

  // Override beforeStop to clean up agents
  async beforeStop(): Promise<void> {
    if (!this.orchestrator) {
      return;
    }

    this.logger.info('Cleaning up orchestrator before shutdown...');
    
    try {
      // Get current orchestrator metrics to see what needs cleanup
      const metrics = await this.orchestrator.getMetrics();
      
      if (metrics.activeAgents > 0) {
        this.logger.info(`Gracefully handling ${metrics.activeAgents} active agents...`);
        // The orchestrator's shutdown method will handle agent cleanup
      }
      
      if (metrics.queuedTasks > 0) {
        this.logger.info(`Processing ${metrics.queuedTasks} queued tasks...`);
        // Allow some time for critical tasks to complete
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      this.logger.warn('Error during orchestrator pre-shutdown cleanup', error);
    }
  }

  // Override afterStop to emit shutdown event
  async afterStop(): Promise<void> {
    this.eventBus.emit('orchestrator:shutdown', {
      timestamp: new Date(),
    });
    
    this.logger.info('Orchestrator service shutdown complete');
  }
}