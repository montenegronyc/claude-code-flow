/**
 * Backend Initialization Entry Point for Claude Flow
 * Main entry point for initializing all backend systems
 */

import { getErrorMessage } from './utils/error-handler.js';
import { Logger } from './core/logger.js';
import { EventBus } from './core/event-bus.js';
import { configManager } from './core/config.js';
import { BackendOrchestrator, IBackendOrchestrator } from './core/backend-orchestrator.js';
import type { Config } from './utils/types.js';
import { InitializationError } from './utils/errors.js';

export interface BackendInitOptions {
  configPath?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  skipHealthChecks?: boolean;
  environment?: 'development' | 'production' | 'test';
}

export interface BackendInitResult {
  success: boolean;
  orchestrator: IBackendOrchestrator;
  config: Config;
  initializationTime: number;
  servicesStatus: Record<string, any>;
  errors: string[];
}

/**
 * Initialize Claude Flow backend systems
 */
export async function initializeBackend(options: BackendInitOptions = {}): Promise<BackendInitResult> {
  const startTime = performance.now();
  
  console.log('🚀 Initializing Claude Flow Backend Systems...\n');
  
  const result: BackendInitResult = {
    success: false,
    orchestrator: null as any,
    config: null as any,
    initializationTime: 0,
    servicesStatus: {},
    errors: [],
  };

  try {
    // Step 1: Load configuration
    console.log('📋 Loading configuration...');
    await loadConfiguration(options);
    result.config = configManager.get();
    console.log('✅ Configuration loaded successfully\n');

    // Step 2: Initialize logging
    console.log('📝 Initializing logging system...');
    const logger = await initializeLogging(options, result.config);
    console.log('✅ Logging system initialized\n');

    // Step 3: Initialize event bus
    console.log('🔄 Initializing event bus...');
    const eventBus = initializeEventBus(logger);
    console.log('✅ Event bus initialized\n');

    // Step 4: Create and initialize backend orchestrator
    console.log('🎯 Creating backend orchestrator...');
    const orchestrator = new BackendOrchestrator(result.config, logger, eventBus);
    result.orchestrator = orchestrator;
    console.log('✅ Backend orchestrator created\n');

    // Step 5: Initialize all backend systems
    console.log('⚙️  Initializing backend systems...');
    const orchestrationResult = await orchestrator.initialize();
    
    if (!orchestrationResult.success) {
      throw new InitializationError('Backend orchestration failed');
    }
    
    result.servicesStatus = orchestrationResult.healthStatus;
    console.log('✅ Backend systems initialized successfully\n');

    // Step 6: Verify system health (if not skipped)
    if (!options.skipHealthChecks) {
      console.log('🏥 Performing health checks...');
      await performHealthChecks(orchestrator, result);
      console.log('✅ Health checks completed\n');
    }

    // Step 7: Finalize initialization
    result.success = true;
    result.initializationTime = performance.now() - startTime;
    
    console.log('🎉 Backend initialization completed successfully!');
    console.log(`   Duration: ${Math.round(result.initializationTime)}ms`);
    console.log(`   Services: ${orchestrationResult.servicesStarted.length} started`);
    if (orchestrationResult.servicesFailed.length > 0) {
      console.log(`   Warnings: ${orchestrationResult.servicesFailed.length} services had issues`);
    }
    console.log('');

    return result;
  } catch (error) {
    result.success = false;
    result.initializationTime = performance.now() - startTime;
    result.errors.push(error instanceof Error ? error.message : String(error));
    
    console.error('❌ Backend initialization failed!');
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error(`   Duration: ${Math.round(result.initializationTime)}ms\n`);
    
    // Cleanup on failure
    if (result.orchestrator) {
      try {
        await result.orchestrator.shutdown();
      } catch (cleanupError) {
        console.error('⚠️  Error during cleanup:', cleanupError);
      }
    }
    
    throw error;
  }
}

/**
 * Shutdown backend systems gracefully
 */
export async function shutdownBackend(orchestrator: IBackendOrchestrator): Promise<void> {
  console.log('🛑 Shutting down Claude Flow Backend Systems...\n');
  
  try {
    const startTime = performance.now();
    
    await orchestrator.shutdown();
    
    const shutdownTime = performance.now() - startTime;
    console.log('✅ Backend shutdown completed successfully');
    console.log(`   Duration: ${Math.round(shutdownTime)}ms\n`);
  } catch (error) {
    console.error('❌ Backend shutdown failed!');
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}\n`);
    throw error;
  }
}

/**
 * Load and validate configuration
 */
async function loadConfiguration(options: BackendInitOptions): Promise<void> {
  try {
    // Initialize the config manager
    await configManager.init();
    
    // Load configuration from file or use defaults
    if (options.configPath) {
      await configManager.load(options.configPath);
    } else {
      try {
        await configManager.load('./claude-flow.config.json');
      } catch {
        // Use default configuration if no file found
        configManager.loadDefault();
      }
    }
    
    // Override log level if specified
    if (options.logLevel) {
      configManager.set('logging.level', options.logLevel);
    }
    
    // Set environment-specific configurations
    if (options.environment) {
      switch (options.environment) {
        case 'development':
          configManager.set('logging.level', 'debug');
          configManager.set('orchestrator.healthCheckInterval', 10000);
          break;
        case 'production':
          configManager.set('logging.level', 'info');
          configManager.set('security.encryptionEnabled', true);
          break;
        case 'test':
          configManager.set('logging.level', 'warn');
          configManager.set('orchestrator.healthCheckInterval', 5000);
          break;
      }
    }
    
  } catch (error) {
    throw new InitializationError('Configuration loading failed', { error });
  }
}

/**
 * Initialize logging system
 */
async function initializeLogging(options: BackendInitOptions, config: Config): Promise<Logger> {
  try {
    const logger = Logger.getInstance({
      level: config.logging?.level || 'info',
      format: config.logging?.format || 'json',
      destination: config.logging?.destination || 'console',
    });
    
    await logger.configure({
      level: config.logging?.level || 'info',
      format: config.logging?.format || 'json',
      destination: config.logging?.destination || 'console',
    });
    
    return logger;
  } catch (error) {
    throw new InitializationError('Logging initialization failed', { error });
  }
}

/**
 * Initialize event bus
 */
function initializeEventBus(logger: Logger): EventBus {
  try {
    return new EventBus(logger);
  } catch (error) {
    throw new InitializationError('Event bus initialization failed', { error });
  }
}

/**
 * Perform comprehensive health checks
 */
async function performHealthChecks(
  orchestrator: IBackendOrchestrator, 
  result: BackendInitResult
): Promise<void> {
  try {
    // Get service health status
    const serviceHealth = await orchestrator.getServiceHealth();
    
    // Check each service
    const healthyServices: string[] = [];
    const unhealthyServices: string[] = [];
    
    for (const [service, healthy] of Object.entries(serviceHealth)) {
      if (healthy) {
        healthyServices.push(service);
      } else {
        unhealthyServices.push(service);
      }
    }
    
    // Update result
    result.servicesStatus = {
      ...result.servicesStatus,
      healthChecks: {
        healthy: healthyServices,
        unhealthy: unhealthyServices,
        timestamp: new Date(),
      },
    };
    
    // Log health status
    if (unhealthyServices.length > 0) {
      console.log(`⚠️  ${unhealthyServices.length} services are unhealthy: ${unhealthyServices.join(', ')}`);
      result.errors.push(`Unhealthy services: ${unhealthyServices.join(', ')}`);
    }
    
    console.log(`   ${healthyServices.length} services are healthy`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Health check failed: ${errorMessage}`);
    console.log(`⚠️  Health check failed: ${errorMessage}`);
  }
}

/**
 * Quick initialization for development/testing
 */
export async function quickInit(environment: 'development' | 'test' = 'development'): Promise<BackendInitResult> {
  return await initializeBackend({
    environment,
    logLevel: environment === 'development' ? 'debug' : 'warn',
    skipHealthChecks: environment === 'test',
  });
}

/**
 * Production initialization with full checks
 */
export async function productionInit(configPath?: string): Promise<BackendInitResult> {
  return await initializeBackend({
    environment: 'production',
    configPath,
    logLevel: 'info',
    skipHealthChecks: false,
  });
}

/**
 * Check if backend is properly initialized
 */
export async function checkBackendHealth(orchestrator: IBackendOrchestrator): Promise<{
  healthy: boolean;
  services: Record<string, boolean>;
  issues: string[];
}> {
  try {
    const serviceHealth = await orchestrator.getServiceHealth();
    const status = await orchestrator.getStatus();
    
    const unhealthyServices = Object.entries(serviceHealth)
      .filter(([_, healthy]) => !healthy)
      .map(([service, _]) => service);
    
    return {
      healthy: unhealthyServices.length === 0 && status.initialized,
      services: serviceHealth,
      issues: unhealthyServices.map(service => `Service ${service} is unhealthy`),
    };
  } catch (error) {
    return {
      healthy: false,
      services: {},
      issues: [`Health check failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

// Export types for external use
export type {
  BackendInitOptions,
  BackendInitResult,
  IBackendOrchestrator,
};