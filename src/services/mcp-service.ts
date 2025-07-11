/**
 * MCP Server Service Implementation
 * Manages the MCP server as a backend service
 */

import { BaseBackendService, ServiceConfig } from '../core/backend-service-manager.js';
import type { ILogger } from '../core/logger.js';
import type { IEventBus } from '../core/event-bus.js';
import { MCPServer, IMCPServer } from '../mcp/server.js';
import type { MCPConfig, MCPMetrics, MCPSession } from '../utils/types.js';

/**
 * MCP Server Service wrapper
 */
export class MCPService extends BaseBackendService {
  private mcpServer?: IMCPServer;
  private lastMetrics?: MCPMetrics;

  constructor(
    private readonly mcpConfig: MCPConfig,
    private readonly orchestrator?: any,
    private readonly swarmCoordinator?: any,
    private readonly agentManager?: any,
    private readonly resourceManager?: any,
    private readonly messagebus?: any,
    private readonly monitor?: any,
    config: ServiceConfig,
    logger: ILogger,
    eventBus: IEventBus,
  ) {
    super(
      'mcpServer',
      '1.0.0',
      'Model Context Protocol server for tool execution and agent communication',
      ['logger', 'eventBus'],
      true, // Required service
      config,
      logger,
      eventBus,
    );
  }

  protected async doStart(): Promise<void> {
    this.logger.info('Creating MCP server instance...');
    
    // Create MCP server instance
    this.mcpServer = new MCPServer(
      this.mcpConfig,
      this.eventBus,
      this.logger,
      this.orchestrator,
      this.swarmCoordinator,
      this.agentManager,
      this.resourceManager,
      this.messagebus,
      this.monitor,
    );

    this.logger.info('Starting MCP server...');
    
    // Start MCP server
    await this.mcpServer.start();
    
    this.logger.info('MCP server service started successfully');
  }

  protected async doStop(): Promise<void> {
    if (!this.mcpServer) {
      return;
    }

    this.logger.info('Stopping MCP server...');
    
    try {
      await this.mcpServer.stop();
      this.mcpServer = undefined;
      this.logger.info('MCP server service stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping MCP server', error);
      throw error;
    }
  }

  protected async doHealthCheck(): Promise<boolean> {
    if (!this.mcpServer) {
      return false;
    }

    try {
      const health = await this.mcpServer.getHealthStatus();
      return health.healthy;
    } catch (error) {
      this.logger.error('MCP server health check failed', error);
      return false;
    }
  }

  protected getCustomMetrics(): Record<string, number> {
    if (!this.mcpServer) {
      return {};
    }

    try {
      this.lastMetrics = this.mcpServer.getMetrics();
      
      return {
        totalRequests: this.lastMetrics.totalRequests,
        successfulRequests: this.lastMetrics.successfulRequests,
        failedRequests: this.lastMetrics.failedRequests,
        averageResponseTime: this.lastMetrics.averageResponseTime,
        activeSessions: this.lastMetrics.activeSessions,
      };
    } catch (error) {
      this.logger.error('Error getting MCP server metrics', error);
      return {};
    }
  }

  // MCP Server-specific methods
  async getMCPMetrics(): Promise<MCPMetrics> {
    if (!this.mcpServer) {
      throw new Error('MCP server not initialized');
    }
    return this.mcpServer.getMetrics();
  }

  async getMCPSessions(): Promise<MCPSession[]> {
    if (!this.mcpServer) {
      throw new Error('MCP server not initialized');
    }
    return this.mcpServer.getSessions();
  }

  async getMCPSession(sessionId: string): Promise<MCPSession | undefined> {
    if (!this.mcpServer) {
      throw new Error('MCP server not initialized');
    }
    return this.mcpServer.getSession(sessionId);
  }

  async terminateMCPSession(sessionId: string): Promise<void> {
    if (!this.mcpServer) {
      throw new Error('MCP server not initialized');
    }
    this.mcpServer.terminateSession(sessionId);
  }

  async getMCPHealthStatus(): Promise<{
    healthy: boolean;
    error?: string;
    metrics?: Record<string, number>;
  }> {
    if (!this.mcpServer) {
      throw new Error('MCP server not initialized');
    }
    return await this.mcpServer.getHealthStatus();
  }

  // Get the underlying MCP server instance
  getMCPServer(): IMCPServer | undefined {
    return this.mcpServer;
  }

  // Override beforeStart to verify MCP configuration
  async beforeStart(): Promise<void> {
    this.logger.info('Verifying MCP server configuration...');
    
    // Validate MCP configuration
    if (!this.mcpConfig.transport) {
      throw new Error('MCP transport not specified');
    }

    if (this.mcpConfig.transport === 'http') {
      if (!this.mcpConfig.port || this.mcpConfig.port < 1 || this.mcpConfig.port > 65535) {
        throw new Error('Invalid HTTP port for MCP server');
      }
    }

    // Check for port conflicts if using HTTP transport
    if (this.mcpConfig.transport === 'http') {
      try {
        // Simple port availability check
        const net = await import('net');
        const server = net.createServer();
        
        await new Promise<void>((resolve, reject) => {
          server.listen(this.mcpConfig.port, this.mcpConfig.host || 'localhost', () => {
            server.close(() => resolve());
          });
          
          server.on('error', (error: any) => {
            if (error.code === 'EADDRINUSE') {
              reject(new Error(`Port ${this.mcpConfig.port} is already in use`));
            } else {
              reject(error);
            }
          });
        });
      } catch (error) {
        throw new Error(`MCP server port check failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.logger.info('MCP server configuration verified', {
      transport: this.mcpConfig.transport,
      port: this.mcpConfig.port,
      host: this.mcpConfig.host,
    });
  }

  // Override afterStart to emit MCP ready event
  async afterStart(): Promise<void> {
    this.eventBus.emit('mcp:ready', {
      timestamp: new Date(),
      transport: this.mcpConfig.transport,
      port: this.mcpConfig.port,
      host: this.mcpConfig.host,
    });
    
    this.logger.info('MCP server service is ready and accepting connections');
  }

  // Override beforeStop to gracefully close connections
  async beforeStop(): Promise<void> {
    if (!this.mcpServer) {
      return;
    }

    this.logger.info('Gracefully closing MCP connections...');
    
    try {
      // Get active sessions and terminate them gracefully
      const sessions = this.mcpServer.getSessions();
      
      if (sessions.length > 0) {
        this.logger.info(`Terminating ${sessions.length} active MCP sessions...`);
        
        // Terminate all sessions
        for (const session of sessions) {
          try {
            this.mcpServer.terminateSession(session.id);
          } catch (error) {
            this.logger.warn(`Failed to terminate MCP session ${session.id}`, error);
          }
        }
        
        // Give sessions time to close gracefully
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      this.logger.warn('Error during MCP pre-shutdown cleanup', error);
    }
  }

  // Override afterStop to emit shutdown event
  async afterStop(): Promise<void> {
    this.eventBus.emit('mcp:shutdown', {
      timestamp: new Date(),
    });
    
    this.logger.info('MCP server service shutdown complete');
  }
}