/**
 * Core Backend Systems for Claude Flow
 * Exports all backend initialization and management functionality
 */

// Core components
export { Logger, type ILogger } from './logger.js';
export { EventBus, type IEventBus } from './event-bus.js';
export { configManager, type ConfigManager } from './config.js';
export { Orchestrator, type IOrchestrator } from './orchestrator.js';

// Backend initialization system
export { 
  BackendInitializer, 
  BackendComponentFactory,
  type IBackendInitializer,
  type IBackendComponent,
  type BackendInitializationResult
} from './backend-initializer.js';

// Service management system
export { 
  BackendServiceManager,
  BaseBackendService,
  DEFAULT_SERVICE_CONFIG,
  ServiceState,
  type IBackendService,
  type ServiceConfig,
  type ServiceMetrics
} from './backend-service-manager.js';

// Main orchestration system
export {
  BackendOrchestrator,
  type IBackendOrchestrator,
  type BackendOrchestrationResult
} from './backend-orchestrator.js';

// Services
export { OrchestratorService } from '../services/orchestrator-service.js';
export { MCPService } from '../services/mcp-service.js';
export { MemoryService } from '../services/memory-service.js';
export { TerminalService } from '../services/terminal-service.js';
export { CoordinationService } from '../services/coordination-service.js';

// Main initialization functions
export {
  initializeBackend,
  shutdownBackend,
  quickInit,
  productionInit,
  checkBackendHealth,
  type BackendInitOptions,
  type BackendInitResult,
} from '../backend-init.js';