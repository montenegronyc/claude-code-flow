/**
 * Terminal Manager Service Implementation
 * Manages the terminal system as a backend service
 */

import { BaseBackendService, ServiceConfig } from '../core/backend-service-manager.js';
import type { ILogger } from '../core/logger.js';
import type { IEventBus } from '../core/event-bus.js';
import { TerminalManager, ITerminalManager } from '../terminal/manager.js';
import type { TerminalConfig, AgentProfile } from '../utils/types.js';

/**
 * Terminal Manager Service wrapper
 */
export class TerminalService extends BaseBackendService {
  private terminalManager?: ITerminalManager;
  private lastHealthMetrics?: Record<string, number>;

  constructor(
    private readonly terminalConfig: TerminalConfig,
    config: ServiceConfig,
    logger: ILogger,
    eventBus: IEventBus,
  ) {
    super(
      'terminalManager',
      '1.0.0',
      'Terminal management system for agent process execution',
      ['logger', 'eventBus'],
      true, // Required service
      config,
      logger,
      eventBus,
    );
  }

  protected async doStart(): Promise<void> {
    this.logger.info('Creating terminal manager instance...');
    
    // Create terminal manager instance
    this.terminalManager = new TerminalManager(
      this.terminalConfig,
      this.eventBus,
      this.logger,
    );

    this.logger.info('Initializing terminal manager...');
    
    // Initialize terminal manager
    await this.terminalManager.initialize();
    
    this.logger.info('Terminal manager service started successfully');
  }

  protected async doStop(): Promise<void> {
    if (!this.terminalManager) {
      return;
    }

    this.logger.info('Shutting down terminal manager...');
    
    try {
      await this.terminalManager.shutdown();
      this.terminalManager = undefined;
      this.logger.info('Terminal manager service stopped successfully');
    } catch (error) {
      this.logger.error('Error shutting down terminal manager', error);
      throw error;
    }
  }

  protected async doHealthCheck(): Promise<boolean> {
    if (!this.terminalManager) {
      return false;
    }

    try {
      const health = await this.terminalManager.getHealthStatus();
      this.lastHealthMetrics = health.metrics;
      return health.healthy;
    } catch (error) {
      this.logger.error('Terminal manager health check failed', error);
      return false;
    }
  }

  protected getCustomMetrics(): Record<string, number> {
    return this.lastHealthMetrics || {};
  }

  // Terminal Manager-specific methods
  async spawnTerminal(profile: AgentProfile): Promise<string> {
    if (!this.terminalManager) {
      throw new Error('Terminal manager not initialized');
    }
    return await this.terminalManager.spawnTerminal(profile);
  }

  async terminateTerminal(terminalId: string): Promise<void> {
    if (!this.terminalManager) {
      throw new Error('Terminal manager not initialized');
    }
    await this.terminalManager.terminateTerminal(terminalId);
  }

  async executeCommand(terminalId: string, command: string): Promise<string> {
    if (!this.terminalManager) {
      throw new Error('Terminal manager not initialized');
    }
    return await this.terminalManager.executeCommand(terminalId, command);
  }

  async getTerminalHealthStatus(): Promise<{
    healthy: boolean;
    error?: string;
    metrics?: Record<string, number>;
  }> {
    if (!this.terminalManager) {
      throw new Error('Terminal manager not initialized');
    }
    return await this.terminalManager.getHealthStatus();
  }

  async performTerminalMaintenance(): Promise<void> {
    if (!this.terminalManager) {
      throw new Error('Terminal manager not initialized');
    }
    await this.terminalManager.performMaintenance();
  }

  // Get the underlying terminal manager instance
  getTerminalManager(): ITerminalManager | undefined {
    return this.terminalManager;
  }

  // Override beforeStart to verify terminal configuration
  async beforeStart(): Promise<void> {
    this.logger.info('Verifying terminal manager configuration...');
    
    // Validate terminal configuration
    if (!this.terminalConfig.type) {
      throw new Error('Terminal type not specified');
    }

    const validTypes = ['auto', 'vscode', 'native'];
    if (!validTypes.includes(this.terminalConfig.type)) {
      throw new Error(`Invalid terminal type: ${this.terminalConfig.type}. Valid options: ${validTypes.join(', ')}`);
    }

    // Validate pool size
    if (this.terminalConfig.poolSize <= 0) {
      throw new Error('Terminal pool size must be greater than 0');
    }

    if (this.terminalConfig.poolSize > 50) {
      this.logger.warn('Large terminal pool size may impact system performance', {
        poolSize: this.terminalConfig.poolSize,
      });
    }

    // Validate timeouts
    if (this.terminalConfig.commandTimeout <= 0) {
      throw new Error('Command timeout must be greater than 0');
    }

    if (this.terminalConfig.healthCheckInterval <= 0) {
      throw new Error('Health check interval must be greater than 0');
    }

    this.logger.info('Terminal manager configuration verified', {
      type: this.terminalConfig.type,
      poolSize: this.terminalConfig.poolSize,
      commandTimeout: this.terminalConfig.commandTimeout,
      healthCheckInterval: this.terminalConfig.healthCheckInterval,
    });
  }

  // Override afterStart to emit terminal ready event
  async afterStart(): Promise<void> {
    this.eventBus.emit('terminal:ready', {
      timestamp: new Date(),
      type: this.terminalConfig.type,
      poolSize: this.terminalConfig.poolSize,
    });
    
    this.logger.info('Terminal manager service is ready for spawning terminals');
  }

  // Override beforeStop to clean up terminals
  async beforeStop(): Promise<void> {
    if (!this.terminalManager) {
      return;
    }

    this.logger.info('Cleaning up terminals before shutdown...');
    
    try {
      // Perform maintenance to clean up any dead terminals
      await this.terminalManager.performMaintenance();
      
      // Give time for any pending operations to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      this.logger.warn('Error during terminal pre-shutdown cleanup', error);
    }
  }

  // Override afterStop to emit shutdown event
  async afterStop(): Promise<void> {
    this.eventBus.emit('terminal:shutdown', {
      timestamp: new Date(),
    });
    
    this.logger.info('Terminal manager service shutdown complete');
  }
}