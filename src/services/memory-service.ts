/**
 * Memory Manager Service Implementation
 * Manages the memory system as a backend service
 */

import { BaseBackendService, ServiceConfig } from '../core/backend-service-manager.js';
import type { ILogger } from '../core/logger.js';
import type { IEventBus } from '../core/event-bus.js';
import { MemoryManager, IMemoryManager } from '../memory/manager.js';
import type { MemoryConfig, MemoryEntry, MemoryQuery } from '../utils/types.js';

/**
 * Memory Manager Service wrapper
 */
export class MemoryService extends BaseBackendService {
  private memoryManager?: IMemoryManager;
  private lastHealthMetrics?: Record<string, number>;

  constructor(
    private readonly memoryConfig: MemoryConfig,
    config: ServiceConfig,
    logger: ILogger,
    eventBus: IEventBus,
  ) {
    super(
      'memoryManager',
      '1.0.0',
      'Persistent memory and knowledge management system for agents',
      ['logger', 'eventBus'],
      true, // Required service
      config,
      logger,
      eventBus,
    );
  }

  protected async doStart(): Promise<void> {
    this.logger.info('Creating memory manager instance...');
    
    // Create memory manager instance
    this.memoryManager = new MemoryManager(
      this.memoryConfig,
      this.eventBus,
      this.logger,
    );

    this.logger.info('Initializing memory manager...');
    
    // Initialize memory manager
    await this.memoryManager.initialize();
    
    this.logger.info('Memory manager service started successfully');
  }

  protected async doStop(): Promise<void> {
    if (!this.memoryManager) {
      return;
    }

    this.logger.info('Shutting down memory manager...');
    
    try {
      await this.memoryManager.shutdown();
      this.memoryManager = undefined;
      this.logger.info('Memory manager service stopped successfully');
    } catch (error) {
      this.logger.error('Error shutting down memory manager', error);
      throw error;
    }
  }

  protected async doHealthCheck(): Promise<boolean> {
    if (!this.memoryManager) {
      return false;
    }

    try {
      const health = await this.memoryManager.getHealthStatus();
      this.lastHealthMetrics = health.metrics;
      return health.healthy;
    } catch (error) {
      this.logger.error('Memory manager health check failed', error);
      return false;
    }
  }

  protected getCustomMetrics(): Record<string, number> {
    return this.lastHealthMetrics || {};
  }

  // Memory Manager-specific methods
  async createMemoryBank(agentId: string): Promise<string> {
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }
    return await this.memoryManager.createBank(agentId);
  }

  async closeMemoryBank(bankId: string): Promise<void> {
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }
    await this.memoryManager.closeBank(bankId);
  }

  async storeMemory(entry: MemoryEntry): Promise<void> {
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }
    await this.memoryManager.store(entry);
  }

  async retrieveMemory(id: string): Promise<MemoryEntry | undefined> {
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }
    return await this.memoryManager.retrieve(id);
  }

  async queryMemory(query: MemoryQuery): Promise<MemoryEntry[]> {
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }
    return await this.memoryManager.query(query);
  }

  async updateMemory(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }
    await this.memoryManager.update(id, updates);
  }

  async deleteMemory(id: string): Promise<void> {
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }
    await this.memoryManager.delete(id);
  }

  async getMemoryHealthStatus(): Promise<{
    healthy: boolean;
    error?: string;
    metrics?: Record<string, number>;
  }> {
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }
    return await this.memoryManager.getHealthStatus();
  }

  async performMemoryMaintenance(): Promise<void> {
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }
    await this.memoryManager.performMaintenance();
  }

  // Get the underlying memory manager instance
  getMemoryManager(): IMemoryManager | undefined {
    return this.memoryManager;
  }

  // Override beforeStart to verify memory configuration
  async beforeStart(): Promise<void> {
    this.logger.info('Verifying memory manager configuration...');
    
    // Validate memory configuration
    if (!this.memoryConfig.backend) {
      throw new Error('Memory backend not specified');
    }

    const validBackends = ['sqlite', 'markdown', 'hybrid'];
    if (!validBackends.includes(this.memoryConfig.backend)) {
      throw new Error(`Invalid memory backend: ${this.memoryConfig.backend}. Valid options: ${validBackends.join(', ')}`);
    }

    // Validate cache size
    if (this.memoryConfig.cacheSizeMB <= 0) {
      throw new Error('Memory cache size must be greater than 0');
    }

    if (this.memoryConfig.cacheSizeMB > 10000) {
      this.logger.warn('Large memory cache size may impact system performance', {
        cacheSizeMB: this.memoryConfig.cacheSizeMB,
      });
    }

    // Validate retention settings
    if (this.memoryConfig.retentionDays < 0) {
      throw new Error('Memory retention days cannot be negative');
    }

    // Check file system permissions for file-based backends
    if (this.memoryConfig.backend === 'sqlite' || this.memoryConfig.backend === 'hybrid') {
      await this.checkSQLitePermissions();
    }

    if (this.memoryConfig.backend === 'markdown' || this.memoryConfig.backend === 'hybrid') {
      await this.checkMarkdownPermissions();
    }

    this.logger.info('Memory manager configuration verified', {
      backend: this.memoryConfig.backend,
      cacheSizeMB: this.memoryConfig.cacheSizeMB,
      retentionDays: this.memoryConfig.retentionDays,
    });
  }

  // Override afterStart to emit memory ready event
  async afterStart(): Promise<void> {
    this.eventBus.emit('memory:ready', {
      timestamp: new Date(),
      backend: this.memoryConfig.backend,
      cacheSizeMB: this.memoryConfig.cacheSizeMB,
    });
    
    this.logger.info('Memory manager service is ready for storing and retrieving memories');
  }

  // Override beforeStop to perform final maintenance
  async beforeStop(): Promise<void> {
    if (!this.memoryManager) {
      return;
    }

    this.logger.info('Performing final memory maintenance before shutdown...');
    
    try {
      // Perform final maintenance to ensure all data is persisted
      await this.memoryManager.performMaintenance();
      
      // Give time for any pending operations to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      this.logger.warn('Error during memory pre-shutdown maintenance', error);
    }
  }

  // Override afterStop to emit shutdown event
  async afterStop(): Promise<void> {
    this.eventBus.emit('memory:shutdown', {
      timestamp: new Date(),
    });
    
    this.logger.info('Memory manager service shutdown complete');
  }

  private async checkSQLitePermissions(): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const sqlitePath = this.memoryConfig.sqlitePath || './claude-flow.db';
    const sqliteDir = path.dirname(sqlitePath);
    
    try {
      // Check if directory exists, create if not
      await fs.mkdir(sqliteDir, { recursive: true });
      
      // Test write permissions
      const testFile = path.join(sqliteDir, '.write_test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      this.logger.debug('SQLite permissions verified', { path: sqlitePath });
    } catch (error) {
      throw new Error(`SQLite path not writable: ${sqlitePath} - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async checkMarkdownPermissions(): Promise<void> {
    const fs = await import('fs/promises');
    
    const markdownDir = this.memoryConfig.markdownDir || './memory';
    
    try {
      // Check if directory exists, create if not
      await fs.mkdir(markdownDir, { recursive: true });
      
      // Test write permissions
      const testFile = `${markdownDir}/.write_test.md`;
      await fs.writeFile(testFile, '# Test');
      await fs.unlink(testFile);
      
      this.logger.debug('Markdown permissions verified', { path: markdownDir });
    } catch (error) {
      throw new Error(`Markdown directory not writable: ${markdownDir} - ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}