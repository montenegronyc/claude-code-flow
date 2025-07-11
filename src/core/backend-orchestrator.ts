/**
 * Backend Orchestrator for Claude Flow
 * Coordinates initialization and management of all backend systems
 */

import { getErrorMessage } from '../utils/error-handler.js';
import type { ILogger } from './logger.js';
import type { IEventBus } from './event-bus.js';
import type { Config } from '../utils/types.js';
import { BackendInitializer, BackendComponentFactory, IBackendInitializer } from './backend-initializer.js';
import { BackendServiceManager, DEFAULT_SERVICE_CONFIG } from './backend-service-manager.js';
import { OrchestratorService } from '../services/orchestrator-service.js';
import { MCPService } from '../services/mcp-service.js';
import { MemoryService } from '../services/memory-service.js';
import { TerminalService } from '../services/terminal-service.js';
import { CoordinationService } from '../services/coordination-service.js';
import { TerminalManager } from '../terminal/manager.js';
import { CoordinationManager } from '../coordination/manager.js';
import { InitializationError, SystemError } from '../utils/errors.js';

export interface BackendOrchestrationResult {
  success: boolean;
  initializationTime: number;
  servicesStarted: string[];
  servicesFailed: string[];
  healthStatus: Record<string, any>;
  errors: string[];
}

export interface IBackendOrchestrator {
  initialize(): Promise<BackendOrchestrationResult>;
  shutdown(): Promise<void>;
  restart(): Promise<BackendOrchestrationResult>;
  getStatus(): Promise<Record<string, any>>;
  restartService(serviceName: string): Promise<void>;
  getServiceHealth(): Promise<Record<string, boolean>>;
}

/**
 * Main Backend Orchestrator
 */
export class BackendOrchestrator implements IBackendOrchestrator {
  private initializer: IBackendInitializer;
  private serviceManager: BackendServiceManager;
  private terminalManager?: TerminalManager;
  private memoryManager?: any; // Will be set after memory service starts
  private coordinationManager?: CoordinationManager;
  private orchestratorService?: OrchestratorService;
  private mcpService?: MCPService;
  private memoryService?: MemoryService;
  private terminalService?: TerminalService;
  private coordinationService?: CoordinationService;
  private initialized = false;

  constructor(
    private config: Config,
    private logger: ILogger,
    private eventBus: IEventBus,
  ) {
    // Initialize the backend initializer
    this.initializer = new BackendInitializer(config, logger, eventBus);
    
    // Initialize the service manager
    this.serviceManager = new BackendServiceManager(logger, eventBus);
    
    this.setupEventHandlers();
  }

  async initialize(): Promise<BackendOrchestrationResult> {
    if (this.initialized) {
      throw new InitializationError('Backend orchestrator already initialized');
    }

    this.logger.info('Starting backend orchestration...');
    const startTime = performance.now();
    
    const result: BackendOrchestrationResult = {
      success: false,
      initializationTime: 0,
      servicesStarted: [],
      servicesFailed: [],
      healthStatus: {},
      errors: [],
    };

    try {
      // Phase 1: Initialize core components
      await this.initializeCoreComponents();
      
      // Phase 2: Create and register backend services
      await this.createBackendServices();
      
      // Phase 3: Start all services in dependency order
      await this.serviceManager.startAll();
      
      // Phase 4: Verify system health
      await this.verifySystemHealth(result);
      
      // Calculate final metrics
      result.initializationTime = performance.now() - startTime;
      result.success = true;
      this.initialized = true;
      
      this.eventBus.emit('backend:orchestration_complete', result);
      this.logger.info('Backend orchestration completed successfully', {
        duration: result.initializationTime,
        servicesStarted: result.servicesStarted.length,
      });
      
      return result;
    } catch (error) {
      result.success = false;
      result.initializationTime = performance.now() - startTime;
      result.errors.push(error instanceof Error ? error.message : String(error));
      
      this.logger.error('Backend orchestration failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: result.initializationTime,
      });
      
      // Cleanup on failure
      await this.cleanup();
      
      throw new InitializationError('Backend orchestration failed', { error });
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.logger.info('Shutting down backend orchestration...');
    
    try {
      // Stop all services
      await this.serviceManager.stopAll();
      
      // Shutdown initializer
      await this.initializer.shutdown();
      
      this.initialized = false;
      this.logger.info('Backend orchestration shutdown complete');
    } catch (error) {
      this.logger.error('Error during backend orchestration shutdown', error);
      throw error;
    }
  }

  async restart(): Promise<BackendOrchestrationResult> {
    this.logger.info('Restarting backend orchestration...');
    
    await this.shutdown();
    return await this.initialize();
  }

  async getStatus(): Promise<Record<string, any>> {
    const serviceStates = this.serviceManager.getServiceStates();
    const serviceMetrics = this.serviceManager.getServiceMetrics();
    const serviceHealth = await this.serviceManager.getServiceHealth();
    
    return {
      initialized: this.initialized,
      services: {
        states: serviceStates,
        metrics: serviceMetrics,
        health: serviceHealth,
      },
      timestamp: new Date(),
    };
  }

  async restartService(serviceName: string): Promise<void> {
    await this.serviceManager.restartService(serviceName);
  }

  async getServiceHealth(): Promise<Record<string, boolean>> {
    return await this.serviceManager.getServiceHealth();
  }

  private async initializeCoreComponents(): Promise<void> {
    this.logger.info('Initializing core components...');
    
    // Create component factory
    const factory = new BackendComponentFactory(this.config, this.logger, this.eventBus);
    
    // Register core components
    this.initializer.registerComponent(factory.createLoggerComponent());
    this.initializer.registerComponent(factory.createEventBusComponent());
    
    // Initialize basic components
    const initResult = await this.initializer.initialize();
    
    if (!initResult.success) {
      throw new InitializationError('Core component initialization failed');
    }
    
    this.logger.info('Core components initialized successfully');
  }

  private async createBackendServices(): Promise<void> {
    this.logger.info('Creating backend services...');
    
    // Create terminal service
    this.terminalService = new TerminalService(
      this.config.terminal,
      DEFAULT_SERVICE_CONFIG,
      this.logger,
      this.eventBus,
    );
    
    // Create coordination service
    this.coordinationService = new CoordinationService(
      this.config.coordination,
      DEFAULT_SERVICE_CONFIG,
      this.logger,
      this.eventBus,
    );
    
    // Create memory service
    this.memoryService = new MemoryService(
      this.config.memory,
      DEFAULT_SERVICE_CONFIG,
      this.logger,
      this.eventBus,
    );
    
    // Create MCP service
    this.mcpService = new MCPService(
      this.config.mcp,
      undefined, // orchestrator will be set later
      undefined, // swarmCoordinator
      undefined, // agentManager  
      undefined, // resourceManager
      undefined, // messagebus
      undefined, // monitor
      DEFAULT_SERVICE_CONFIG,
      this.logger,
      this.eventBus,
    );
    
    // Register services with service manager
    this.serviceManager.registerService(this.terminalService);
    this.serviceManager.registerService(this.coordinationService);
    this.serviceManager.registerService(this.memoryService);
    this.serviceManager.registerService(this.mcpService);
    
    this.logger.info('Backend services created successfully');
  }

  private async createOrchestratorService(): Promise<void> {
    this.logger.info('Creating orchestrator service...');
    
    // Get the memory manager from the memory service
    const memoryManager = this.memoryService?.getMemoryManager();
    if (!memoryManager) {
      throw new Error('Memory manager not available');
    }

    // Get the terminal manager from the terminal service
    const terminalManager = this.terminalService?.getTerminalManager();
    if (!terminalManager) {
      throw new Error('Terminal manager not available');
    }

    // Get the coordination manager from the coordination service
    const coordinationManager = this.coordinationService?.getCoordinationManager();
    if (!coordinationManager) {
      throw new Error('Coordination manager not available');
    }
    
    // Create orchestrator service with all dependencies
    this.orchestratorService = new OrchestratorService(
      this.config,
      terminalManager,
      memoryManager,
      coordinationManager,
      this.mcpService!.getMCPServer()!,
      DEFAULT_SERVICE_CONFIG,
      this.logger,
      this.eventBus,
    );
    
    // Register orchestrator service
    this.serviceManager.registerService(this.orchestratorService);
    
    this.logger.info('Orchestrator service created successfully');
  }

  private async verifySystemHealth(result: BackendOrchestrationResult): Promise<void> {
    this.logger.info('Verifying system health...');
    
    const serviceHealth = await this.serviceManager.getServiceHealth();
    const serviceStates = this.serviceManager.getServiceStates();
    
    // Collect service status
    for (const [serviceName, healthy] of Object.entries(serviceHealth)) {
      if (healthy) {
        result.servicesStarted.push(serviceName);
      } else {
        result.servicesFailed.push(serviceName);
        result.errors.push(`Service ${serviceName} is unhealthy`);
      }
    }
    
    result.healthStatus = {
      services: serviceHealth,
      states: serviceStates,
    };
    
    // Check for critical service failures
    const criticalServices = ['terminalManager', 'coordinationManager', 'memoryManager', 'mcpServer'];
    const criticalFailures = criticalServices.filter(service => 
      !serviceHealth[service] || serviceStates[service] !== 'running'
    );
    
    if (criticalFailures.length > 0) {
      throw new SystemError(`Critical services failed: ${criticalFailures.join(', ')}`);
    }
    
    this.logger.info('System health verification completed', {
      servicesHealthy: result.servicesStarted.length,
      servicesUnhealthy: result.servicesFailed.length,
    });
  }

  private async cleanup(): Promise<void> {
    this.logger.info('Cleaning up after orchestration failure...');
    
    try {
      // Stop any running services
      await this.serviceManager.stopAll();
      
      // Cleanup individual managers if they exist outside services
      // (Services handle their own cleanup)
    } catch (error) {
      this.logger.error('Error during cleanup', error);
    }
  }

  private setupEventHandlers(): void {
    // Handle service events
    this.eventBus.on('service:started', (data: any) => {
      this.logger.info('Service started', data);
      
      // Check if all required services are started to create orchestrator
      this.checkAndCreateOrchestrator();
    });
    
    this.eventBus.on('service:failed', (data: any) => {
      this.logger.error('Service failed', data);
    });
    
    this.eventBus.on('service:restarted', (data: any) => {
      this.logger.info('Service restarted', data);
    });
    
    // Handle orchestrator events
    this.eventBus.on('orchestrator:ready', (data: any) => {
      this.logger.info('Orchestrator is ready and operational', data);
    });
    
    // Handle MCP events
    this.eventBus.on('mcp:ready', (data: any) => {
      this.logger.info('MCP server is ready and accepting connections', data);
    });
    
    // Handle memory events
    this.eventBus.on('memory:ready', (data: any) => {
      this.logger.info('Memory manager is ready for operations', data);
    });
  }

  // Getter methods for accessing services
  getOrchestratorService(): OrchestratorService | undefined {
    return this.orchestratorService;
  }

  getMCPService(): MCPService | undefined {
    return this.mcpService;
  }

  getMemoryService(): MemoryService | undefined {
    return this.memoryService;
  }

  getTerminalManager(): TerminalManager | undefined {
    return this.terminalManager;
  }

  getCoordinationManager(): CoordinationManager | undefined {
    return this.coordinationService?.getCoordinationManager();
  }

  getTerminalService(): TerminalService | undefined {
    return this.terminalService;
  }

  getCoordinationService(): CoordinationService | undefined {
    return this.coordinationService;
  }

  private checkAndCreateOrchestrator(): void {
    // Check if all required services are running and orchestrator isn't created yet
    if (!this.orchestratorService && this.areRequiredServicesRunning()) {
      this.createOrchestratorService().catch(error => {
        this.logger.error('Failed to create orchestrator service', error);
      });
    }
  }

  private areRequiredServicesRunning(): boolean {
    const requiredServices = ['terminalManager', 'coordinationManager', 'memoryManager', 'mcpServer'];
    const serviceStates = this.serviceManager.getServiceStates();
    
    return requiredServices.every(service => 
      serviceStates[service] === 'running'
    );
  }
}