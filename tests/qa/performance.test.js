/**
 * Performance Tests for Parallel Initialization
 * Tests performance characteristics, resource utilization, and scalability
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { batchInitCommand } from '../../src/cli/simple-commands/init/batch-init.js';
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

// Performance measurement utilities
class PerformanceTracker {
  constructor() {
    this.metrics = {};
    this.startTimes = {};
  }

  start(operation) {
    this.startTimes[operation] = process.hrtime.bigint();
  }

  end(operation) {
    if (!this.startTimes[operation]) {
      throw new Error(`No start time recorded for operation: ${operation}`);
    }
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - this.startTimes[operation]) / 1_000_000; // Convert to milliseconds
    
    if (!this.metrics[operation]) {
      this.metrics[operation] = [];
    }
    
    this.metrics[operation].push(duration);
    delete this.startTimes[operation];
    
    return duration;
  }

  getMetrics(operation) {
    const measurements = this.metrics[operation] || [];
    if (measurements.length === 0) {
      return null;
    }

    const sum = measurements.reduce((a, b) => a + b, 0);
    const avg = sum / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    
    return {
      count: measurements.length,
      total: sum,
      average: avg,
      min,
      max,
      measurements
    };
  }

  getAllMetrics() {
    const result = {};
    for (const operation of Object.keys(this.metrics)) {
      result[operation] = this.getMetrics(operation);
    }
    return result;
  }
}

describe('Initialization Performance Tests', () => {
  let testDir;
  let performanceTracker;
  let originalConsoleLog;
  let originalConsoleClear;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `claude-flow-perf-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    performanceTracker = new PerformanceTracker();
    
    // Mock console methods to avoid output during tests
    originalConsoleLog = console.log;
    originalConsoleClear = console.clear;
    console.log = jest.fn();
    console.clear = jest.fn();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup performance-oriented mock behavior
    setupPerformanceMocks();
  });

  afterEach(async () => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.clear = originalConsoleClear;
    
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  function setupPerformanceMocks() {
    // Add realistic delays to simulate I/O operations
    mockDeno.mkdir.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return Promise.resolve();
    });

    mockDeno.writeTextFile.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 2));
      return Promise.resolve();
    });

    mockDeno.readTextFile.mockResolvedValue('{}');
    mockDeno.stat.mockResolvedValue({ isDirectory: true });
    mockDeno.readDir.mockResolvedValue([]);
    mockProcess.cwd.mockReturnValue(testDir);
    mockProcess.chdir.mockImplementation(() => {});
  }

  describe('Sequential vs Parallel Performance', () => {
    it('should demonstrate performance improvement with parallel processing', async () => {
      const projects = Array.from({ length: 10 }, (_, i) => `perf-test-${i}`);
      
      // Test sequential processing
      performanceTracker.start('sequential');
      const sequentialResults = await batchInitCommand(projects, {
        parallel: false,
        progressTracking: false,
        performanceMonitoring: false
      });
      const sequentialTime = performanceTracker.end('sequential');

      // Test parallel processing
      performanceTracker.start('parallel');
      const parallelResults = await batchInitCommand(projects, {
        parallel: true,
        maxConcurrency: 5,
        progressTracking: false,
        performanceMonitoring: false
      });
      const parallelTime = performanceTracker.end('parallel');

      // Verify both approaches succeed
      expect(sequentialResults).toHaveLength(10);
      expect(parallelResults).toHaveLength(10);
      expect(sequentialResults.every(r => r.success)).toBe(true);
      expect(parallelResults.every(r => r.success)).toBe(true);

      // Parallel should be faster (with some tolerance for test environment variance)
      const speedupRatio = sequentialTime / parallelTime;
      expect(speedupRatio).toBeGreaterThan(1.5); // At least 50% improvement
      
      console.log = originalConsoleLog;
      console.log(`Sequential time: ${sequentialTime.toFixed(2)}ms`);
      console.log(`Parallel time: ${parallelTime.toFixed(2)}ms`);
      console.log(`Speedup ratio: ${speedupRatio.toFixed(2)}x`);
      console.log = jest.fn();
    });

    it('should scale performance with concurrency level', async () => {
      const projects = Array.from({ length: 20 }, (_, i) => `scale-test-${i}`);
      const concurrencyLevels = [1, 2, 4, 8];
      const results = {};

      for (const concurrency of concurrencyLevels) {
        performanceTracker.start(`concurrency-${concurrency}`);
        
        const batchResults = await batchInitCommand(projects, {
          parallel: true,
          maxConcurrency: concurrency,
          progressTracking: false,
          performanceMonitoring: false
        });
        
        const time = performanceTracker.end(`concurrency-${concurrency}`);
        results[concurrency] = {
          time,
          success: batchResults.every(r => r.success)
        };
      }

      // Verify all tests succeeded
      Object.values(results).forEach(result => {
        expect(result.success).toBe(true);
      });

      // Higher concurrency should generally be faster (up to optimal point)
      expect(results[2].time).toBeLessThan(results[1].time);
      expect(results[4].time).toBeLessThan(results[2].time);

      console.log = originalConsoleLog;
      console.log('Concurrency scaling results:');
      Object.entries(results).forEach(([concurrency, result]) => {
        console.log(`  Concurrency ${concurrency}: ${result.time.toFixed(2)}ms`);
      });
      console.log = jest.fn();
    });
  });

  describe('Resource Utilization', () => {
    it('should handle resource constraints gracefully', async () => {
      // Simulate resource pressure by adding variable delays
      let operationCount = 0;
      mockDeno.mkdir.mockImplementation(async () => {
        operationCount++;
        const delay = Math.random() * 10; // 0-10ms random delay
        await new Promise(resolve => setTimeout(resolve, delay));
        return Promise.resolve();
      });

      const projects = Array.from({ length: 50 }, (_, i) => `resource-test-${i}`);
      
      performanceTracker.start('resource-constrained');
      const results = await batchInitCommand(projects, {
        parallel: true,
        maxConcurrency: 10,
        progressTracking: false,
        performanceMonitoring: false
      });
      const totalTime = performanceTracker.end('resource-constrained');

      expect(results).toHaveLength(50);
      expect(results.every(r => r.success)).toBe(true);
      expect(operationCount).toBeGreaterThan(0);

      // Should complete in reasonable time even under resource pressure
      expect(totalTime).toBeLessThan(30000); // Less than 30 seconds
    });

    it('should maintain performance consistency across multiple runs', async () => {
      const projects = Array.from({ length: 5 }, (_, i) => `consistency-test-${i}`);
      const runs = 5;
      const times = [];

      for (let run = 0; run < runs; run++) {
        performanceTracker.start(`run-${run}`);
        
        const results = await batchInitCommand(projects, {
          parallel: true,
          maxConcurrency: 3,
          progressTracking: false,
          performanceMonitoring: false
        });
        
        const time = performanceTracker.end(`run-${run}`);
        times.push(time);

        expect(results).toHaveLength(5);
        expect(results.every(r => r.success)).toBe(true);
      }

      // Calculate coefficient of variation (standard deviation / mean)
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);
      const coefficientOfVariation = stdDev / mean;

      // Performance should be reasonably consistent (CV < 0.5)
      expect(coefficientOfVariation).toBeLessThan(0.5);

      console.log = originalConsoleLog;
      console.log(`Performance consistency: mean=${mean.toFixed(2)}ms, CV=${coefficientOfVariation.toFixed(3)}`);
      console.log = jest.fn();
    });
  });

  describe('Scalability Testing', () => {
    it('should scale linearly with small project counts', async () => {
      const projectCounts = [1, 2, 4, 8];
      const results = {};

      for (const count of projectCounts) {
        const projects = Array.from({ length: count }, (_, i) => `scale-${count}-${i}`);
        
        performanceTracker.start(`scale-${count}`);
        const batchResults = await batchInitCommand(projects, {
          parallel: true,
          maxConcurrency: 4,
          progressTracking: false,
          performanceMonitoring: false
        });
        const time = performanceTracker.end(`scale-${count}`);

        results[count] = {
          time,
          timePerProject: time / count,
          success: batchResults.every(r => r.success)
        };

        expect(batchResults).toHaveLength(count);
        expect(results[count].success).toBe(true);
      }

      // Time per project should remain relatively stable (linear scaling)
      const timePerProjectValues = Object.values(results).map(r => r.timePerProject);
      const maxTimePerProject = Math.max(...timePerProjectValues);
      const minTimePerProject = Math.min(...timePerProjectValues);
      const scalingRatio = maxTimePerProject / minTimePerProject;

      // Scaling should be reasonable (ratio < 3.0)
      expect(scalingRatio).toBeLessThan(3.0);

      console.log = originalConsoleLog;
      console.log('Linear scaling results:');
      Object.entries(results).forEach(([count, result]) => {
        console.log(`  ${count} projects: ${result.time.toFixed(2)}ms total, ${result.timePerProject.toFixed(2)}ms per project`);
      });
      console.log = jest.fn();
    });

    it('should handle large batch operations efficiently', async () => {
      const largeProjectCount = 100;
      const projects = Array.from({ length: largeProjectCount }, (_, i) => `large-batch-${i}`);
      
      performanceTracker.start('large-batch');
      const results = await batchInitCommand(projects, {
        parallel: true,
        maxConcurrency: 20,
        progressTracking: false,
        performanceMonitoring: false
      });
      const totalTime = performanceTracker.end('large-batch');

      expect(results).toHaveLength(largeProjectCount);
      expect(results.every(r => r.success)).toBe(true);

      const timePerProject = totalTime / largeProjectCount;
      
      // Should complete large batches efficiently
      expect(totalTime).toBeLessThan(60000); // Less than 1 minute
      expect(timePerProject).toBeLessThan(100); // Less than 100ms per project

      console.log = originalConsoleLog;
      console.log(`Large batch (${largeProjectCount} projects): ${totalTime.toFixed(2)}ms total, ${timePerProject.toFixed(2)}ms per project`);
      console.log = jest.fn();
    });
  });

  describe('Memory Usage Patterns', () => {
    it('should not accumulate memory with large sequential operations', async () => {
      const projects = Array.from({ length: 20 }, (_, i) => `memory-test-${i}`);
      
      // Monitor function call counts as a proxy for memory usage
      const initialMkdirCalls = mockDeno.mkdir.mock.calls.length;
      const initialWriteCalls = mockDeno.writeTextFile.mock.calls.length;

      const results = await batchInitCommand(projects, {
        parallel: false, // Sequential to test memory accumulation
        progressTracking: false,
        performanceMonitoring: false
      });

      const finalMkdirCalls = mockDeno.mkdir.mock.calls.length;
      const finalWriteCalls = mockDeno.writeTextFile.mock.calls.length;

      expect(results).toHaveLength(20);
      expect(results.every(r => r.success)).toBe(true);

      // Verify expected number of calls (proxy for controlled memory usage)
      const mkdirCallsPerProject = (finalMkdirCalls - initialMkdirCalls) / 20;
      const writeCallsPerProject = (finalWriteCalls - initialWriteCalls) / 20;

      expect(mkdirCallsPerProject).toBeGreaterThan(10); // At least 10 directories per project
      expect(writeCallsPerProject).toBeGreaterThan(5); // At least 5 files per project
    });
  });

  describe('Optimization Validation', () => {
    it('should respect optimal concurrency calculations', async () => {
      // Test different concurrency levels to find optimal
      const projects = Array.from({ length: 12 }, (_, i) => `optimal-test-${i}`);
      const concurrencyLevels = [1, 3, 6, 12, 24];
      const results = {};

      for (const concurrency of concurrencyLevels) {
        performanceTracker.start(`optimal-${concurrency}`);
        
        const batchResults = await batchInitCommand(projects, {
          parallel: true,
          maxConcurrency: concurrency,
          progressTracking: false,
          performanceMonitoring: false
        });
        
        const time = performanceTracker.end(`optimal-${concurrency}`);
        results[concurrency] = time;

        expect(batchResults).toHaveLength(12);
        expect(batchResults.every(r => r.success)).toBe(true);
      }

      // Find the optimal concurrency level (fastest time)
      const times = Object.values(results);
      const minTime = Math.min(...times);
      const optimalConcurrency = Object.keys(results).find(
        key => results[key] === minTime
      );

      // Optimal concurrency should be reasonable for this workload
      expect(parseInt(optimalConcurrency)).toBeGreaterThan(1);
      expect(parseInt(optimalConcurrency)).toBeLessThanOrEqual(12);

      console.log = originalConsoleLog;
      console.log('Optimal concurrency analysis:');
      Object.entries(results).forEach(([concurrency, time]) => {
        const marker = concurrency === optimalConcurrency ? ' (optimal)' : '';
        console.log(`  Concurrency ${concurrency}: ${time.toFixed(2)}ms${marker}`);
      });
      console.log = jest.fn();
    });
  });

  describe('Template Performance Impact', () => {
    it('should measure performance impact of different templates', async () => {
      const templates = ['web-api', 'react-app', 'microservice', 'cli-tool'];
      const templatePerformance = {};

      for (const template of templates) {
        const projects = [`template-test-${template}`];
        
        performanceTracker.start(`template-${template}`);
        const results = await batchInitCommand(projects, {
          template,
          parallel: false,
          progressTracking: false,
          performanceMonitoring: false
        });
        const time = performanceTracker.end(`template-${template}`);

        templatePerformance[template] = time;

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
      }

      // All templates should complete in reasonable time
      Object.values(templatePerformance).forEach(time => {
        expect(time).toBeLessThan(1000); // Less than 1 second per template
      });

      console.log = originalConsoleLog;
      console.log('Template performance comparison:');
      Object.entries(templatePerformance).forEach(([template, time]) => {
        console.log(`  ${template}: ${time.toFixed(2)}ms`);
      });
      console.log = jest.fn();
    });
  });
});