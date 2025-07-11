/**
 * Integration Tests for Batch Initialization
 * Tests the complete batch initialization workflow including resource management,
 * parallel processing, and template integration
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  batchInitCommand, 
  validateBatchOptions,
  PROJECT_TEMPLATES,
  ENVIRONMENT_CONFIGS 
} from '../../src/cli/simple-commands/init/batch-init.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock Deno for Node.js testing environment
const mockDeno = {
  mkdir: jest.fn(),
  writeTextFile: jest.fn(),
  readTextFile: jest.fn(),
  stat: jest.fn(),
  readDir: jest.fn(),
  remove: jest.fn(),
  Command: jest.fn(),
  env: {
    get: jest.fn()
  },
  build: {
    os: 'linux'
  }
};

// Mock process for chdir operations
const mockProcess = {
  chdir: jest.fn(),
  cwd: jest.fn()
};

global.Deno = mockDeno;
global.process = mockProcess;
global.cwd = () => '/test/dir';

describe('Batch Initialization Integration Tests', () => {
  let testDir;
  let originalConsoleLog;
  let originalConsoleClear;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `claude-flow-batch-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Mock console methods to avoid output during tests
    originalConsoleLog = console.log;
    originalConsoleClear = console.clear;
    console.log = jest.fn();
    console.clear = jest.fn();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock behavior
    mockDeno.mkdir.mockResolvedValue();
    mockDeno.writeTextFile.mockResolvedValue();
    mockDeno.readTextFile.mockResolvedValue('{}');
    mockDeno.stat.mockResolvedValue({ isDirectory: true });
    mockDeno.readDir.mockResolvedValue([]);
    mockProcess.cwd.mockReturnValue(testDir);
    mockProcess.chdir.mockImplementation(() => {});
  });

  afterEach(async () => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.clear = originalConsoleClear;
    
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Basic Batch Operations', () => {
    it('should successfully initialize multiple projects sequentially', async () => {
      const projects = ['test-project-1', 'test-project-2', 'test-project-3'];
      const options = {
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      
      // Verify directory creation calls
      expect(mockDeno.mkdir).toHaveBeenCalledTimes(projects.length * 13); // 13 directories per project
      
      // Verify file creation calls
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('CLAUDE.md', expect.any(String));
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('memory-bank.md', expect.any(String));
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('coordination.md', expect.any(String));
    });

    it('should successfully initialize multiple projects in parallel', async () => {
      const projects = ['parallel-1', 'parallel-2', 'parallel-3'];
      const options = {
        parallel: true,
        maxConcurrency: 2,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      
      // Parallel execution should still create all required files
      expect(mockDeno.mkdir).toHaveBeenCalled();
      expect(mockDeno.writeTextFile).toHaveBeenCalled();
    });

    it('should handle empty project list gracefully', async () => {
      const results = await batchInitCommand([], {});
      
      expect(results).toBeUndefined();
      expect(mockDeno.mkdir).not.toHaveBeenCalled();
    });

    it('should handle null project list gracefully', async () => {
      const results = await batchInitCommand(null, {});
      
      expect(results).toBeUndefined();
      expect(mockDeno.mkdir).not.toHaveBeenCalled();
    });
  });

  describe('Template Integration', () => {
    it('should apply web-api template correctly', async () => {
      const projects = ['api-project'];
      const options = {
        template: 'web-api',
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      
      // Verify template-specific files are created
      const templateConfig = PROJECT_TEMPLATES['web-api'];
      for (const filePath of Object.keys(templateConfig.extraFiles)) {
        expect(mockDeno.writeTextFile).toHaveBeenCalledWith(filePath, expect.any(String));
      }
    });

    it('should apply react-app template correctly', async () => {
      const projects = ['react-project'];
      const options = {
        template: 'react-app',
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      
      // Verify React-specific files
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('package.json', expect.stringContaining('react'));
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('tsconfig.json', expect.any(String));
    });

    it('should apply microservice template with Docker files', async () => {
      const projects = ['microservice-project'];
      const options = {
        template: 'microservice',
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      
      // Verify Docker-specific files
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('Dockerfile', expect.stringContaining('FROM node:'));
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('docker-compose.yml', expect.stringContaining('version:'));
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('.dockerignore', expect.stringContaining('node_modules'));
    });

    it('should apply cli-tool template correctly', async () => {
      const projects = ['cli-project'];
      const options = {
        template: 'cli-tool',
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      
      // Verify CLI-specific files
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('src/cli.js', expect.stringContaining('#!/usr/bin/env node'));
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('package.json', expect.stringContaining('"bin":'));
    });
  });

  describe('Multi-Environment Support', () => {
    it('should create separate projects for each environment', async () => {
      const projects = ['multi-env-app'];
      const options = {
        environments: ['dev', 'staging', 'prod'],
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(3); // One for each environment
      expect(results.every(r => r.success)).toBe(true);
      
      // Verify environment-specific naming
      expect(results.some(r => r.projectPath.includes('multi-env-app-dev'))).toBe(true);
      expect(results.some(r => r.projectPath.includes('multi-env-app-staging'))).toBe(true);
      expect(results.some(r => r.projectPath.includes('multi-env-app-prod'))).toBe(true);
    });

    it('should create environment-specific configuration files', async () => {
      const projects = ['env-test'];
      const options = {
        environments: ['dev'],
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      
      // Verify .env file creation with dev environment
      const devConfig = ENVIRONMENT_CONFIGS['dev'];
      const expectedEnvContent = Object.entries(devConfig.config)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('.env', expectedEnvContent);
    });
  });

  describe('Resource Management', () => {
    it('should respect concurrency limits', async () => {
      const projects = ['proj1', 'proj2', 'proj3', 'proj4', 'proj5'];
      const options = {
        parallel: true,
        maxConcurrency: 2,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
      
      // Cannot easily test actual concurrency in this mock environment,
      // but we can verify all projects were processed
      expect(mockDeno.mkdir).toHaveBeenCalled();
      expect(mockDeno.writeTextFile).toHaveBeenCalled();
    });

    it('should handle resource constraint scenarios', async () => {
      // Mock resource exhaustion scenario
      let callCount = 0;
      mockDeno.mkdir.mockImplementation(() => {
        callCount++;
        if (callCount > 10) {
          return Promise.reject(new Error('Resource exhausted'));
        }
        return Promise.resolve();
      });

      const projects = ['resource-test'];
      const options = {
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Resource exhausted');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should continue processing when individual projects fail', async () => {
      // Mock failure for second project
      let projectCount = 0;
      mockDeno.mkdir.mockImplementation(() => {
        projectCount++;
        if (projectCount === 2) {
          return Promise.reject(new Error('Simulated failure'));
        }
        return Promise.resolve();
      });

      const projects = ['success-1', 'fail-2', 'success-3'];
      const options = {
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should handle file system permission errors gracefully', async () => {
      mockDeno.writeTextFile.mockRejectedValue(new Error('Permission denied'));

      const projects = ['permission-test'];
      const options = {
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Permission denied');
    });

    it('should handle mixed success and failure scenarios', async () => {
      // Mock alternating success/failure pattern
      let callCount = 0;
      mockDeno.writeTextFile.mockImplementation((filename) => {
        callCount++;
        if (filename === 'CLAUDE.md' && callCount % 2 === 0) {
          return Promise.reject(new Error('Write failed'));
        }
        return Promise.resolve();
      });

      const projects = ['mixed-1', 'mixed-2', 'mixed-3', 'mixed-4'];
      const options = {
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(4);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      expect(successCount).toBeGreaterThan(0);
      expect(failureCount).toBeGreaterThan(0);
      expect(successCount + failureCount).toBe(4);
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should track performance metrics when enabled', async () => {
      const projects = ['perf-test'];
      const options = {
        parallel: false,
        progressTracking: false,
        performanceMonitoring: true
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      
      // Performance monitoring would be tested through console output
      // or by mocking the PerformanceMonitor class
    });

    it('should provide progress tracking when enabled', async () => {
      const projects = ['progress-test-1', 'progress-test-2'];
      const options = {
        parallel: false,
        progressTracking: true,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      
      // Progress tracking would be verified through console.clear and console.log calls
      expect(console.clear).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('SPARC Integration', () => {
    it('should create SPARC structure when requested', async () => {
      const projects = ['sparc-project'];
      const options = {
        sparc: true,
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      const results = await batchInitCommand(projects, options);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      
      // SPARC-specific functionality would need to be mocked
      // to test the createSparcStructureManually and createClaudeSlashCommands calls
    });
  });

  describe('Validation Integration', () => {
    it('should validate batch options before processing', () => {
      const validOptions = {
        maxConcurrency: 5,
        template: 'web-api',
        environments: ['dev', 'staging']
      };

      const errors = validateBatchOptions(validOptions);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid concurrency values', () => {
      const invalidOptions = {
        maxConcurrency: 25
      };

      const errors = validateBatchOptions(invalidOptions);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('maxConcurrency'))).toBe(true);
    });

    it('should reject invalid template names', () => {
      const invalidOptions = {
        template: 'non-existent-template'
      };

      const errors = validateBatchOptions(invalidOptions);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('template'))).toBe(true);
    });

    it('should reject invalid environment names', () => {
      const invalidOptions = {
        environments: ['invalid-env']
      };

      const errors = validateBatchOptions(invalidOptions);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('environment'))).toBe(true);
    });
  });

  describe('Template Variable Substitution', () => {
    it('should correctly substitute project name in templates', async () => {
      const projects = ['my-awesome-api'];
      const options = {
        template: 'web-api',
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      await batchInitCommand(projects, options);

      // Verify project name substitution in package.json
      const packageJsonCall = mockDeno.writeTextFile.mock.calls.find(
        call => call[0] === 'package.json'
      );
      expect(packageJsonCall).toBeDefined();
      expect(packageJsonCall[1]).toContain('my-awesome-api');
    });

    it('should substitute environment variables in templates', async () => {
      const projects = ['env-sub-test'];
      const options = {
        template: 'microservice',
        environments: ['staging'],
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      };

      await batchInitCommand(projects, options);

      // Verify environment substitution in docker-compose.yml
      const dockerComposeCall = mockDeno.writeTextFile.mock.calls.find(
        call => call[0] === 'docker-compose.yml'
      );
      expect(dockerComposeCall).toBeDefined();
      expect(dockerComposeCall[1]).toContain('staging');
    });
  });
});