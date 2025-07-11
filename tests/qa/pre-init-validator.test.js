/**
 * Unit Tests for PreInitValidator
 * Tests all validation scenarios for initialization process
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PreInitValidator } from '../../src/cli/simple-commands/init/validation/pre-init-validator.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock Deno for Node.js testing environment
const mockDeno = {
  writeTextFile: jest.fn(),
  readTextFile: jest.fn(),
  remove: jest.fn(),
  mkdir: jest.fn(),
  stat: jest.fn(),
  readDir: jest.fn(),
  env: {
    get: jest.fn()
  },
  Command: jest.fn(),
  build: {
    os: 'linux'
  }
};

// Make Deno available globally for tests
global.Deno = mockDeno;

describe('PreInitValidator', () => {
  let validator;
  let testDir;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `claude-flow-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    validator = new PreInitValidator(testDir);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('checkPermissions', () => {
    it('should pass when directory has write permissions', async () => {
      // Mock successful file operations
      mockDeno.writeTextFile.mockResolvedValue();
      mockDeno.remove.mockResolvedValue();
      mockDeno.mkdir.mockResolvedValue();

      const result = await validator.checkPermissions();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockDeno.writeTextFile).toHaveBeenCalled();
      expect(mockDeno.mkdir).toHaveBeenCalled();
    });

    it('should fail when directory lacks write permissions', async () => {
      // Mock permission error
      mockDeno.writeTextFile.mockRejectedValue(new Error('Permission denied'));

      const result = await validator.checkPermissions();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Insufficient permissions');
    });

    it('should fail when directory creation is not allowed', async () => {
      // Mock successful file write but failed directory creation
      mockDeno.writeTextFile.mockResolvedValue();
      mockDeno.remove.mockResolvedValue();
      mockDeno.mkdir.mockRejectedValue(new Error('Permission denied'));

      const result = await validator.checkPermissions();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Insufficient permissions');
    });
  });

  describe('checkDiskSpace', () => {
    it('should pass when sufficient disk space is available', async () => {
      // Mock df command output showing sufficient space
      const mockOutput = `Filesystem     1K-blocks      Used Available Use% Mounted on
/dev/sda1       1000000    500000    400000  56% /`;
      
      const mockCommand = {
        output: jest.fn().mockResolvedValue({
          stdout: new TextEncoder().encode(mockOutput),
          success: true
        })
      };
      
      mockDeno.Command.mockReturnValue(mockCommand);

      const result = await validator.checkDiskSpace();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when insufficient disk space', async () => {
      // Mock df command output showing insufficient space (50MB available)
      const mockOutput = `Filesystem     1K-blocks      Used Available Use% Mounted on
/dev/sda1       1000000    950000     50000  95% /`;
      
      const mockCommand = {
        output: jest.fn().mockResolvedValue({
          stdout: new TextEncoder().encode(mockOutput),
          success: true
        })
      };
      
      mockDeno.Command.mockReturnValue(mockCommand);

      const result = await validator.checkDiskSpace();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Insufficient disk space');
    });

    it('should warn when low disk space', async () => {
      // Mock df command output showing low space (200MB available)
      const mockOutput = `Filesystem     1K-blocks      Used Available Use% Mounted on
/dev/sda1       1000000    800000    200000  80% /`;
      
      const mockCommand = {
        output: jest.fn().mockResolvedValue({
          stdout: new TextEncoder().encode(mockOutput),
          success: true
        })
      };
      
      mockDeno.Command.mockReturnValue(mockCommand);

      const result = await validator.checkDiskSpace();

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Low disk space');
    });

    it('should handle df command failure gracefully', async () => {
      const mockCommand = {
        output: jest.fn().mockResolvedValue({
          success: false
        })
      };
      
      mockDeno.Command.mockReturnValue(mockCommand);

      const result = await validator.checkDiskSpace();

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0); // Should not warn on command failure
    });
  });

  describe('checkConflicts', () => {
    it('should pass when no conflicting files exist', async () => {
      // Mock stat to throw (file doesn't exist)
      mockDeno.stat.mockRejectedValue(new Error('File not found'));

      const result = await validator.checkConflicts();

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should fail when critical files exist without force flag', async () => {
      // Mock stat to return file stats for CLAUDE.md
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('CLAUDE.md')) {
          return Promise.resolve({ isFile: true });
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await validator.checkConflicts(false);

      expect(result.success).toBe(false);
      expect(result.conflicts).toContain('CLAUDE.md');
      expect(result.errors.some(e => e.includes('already exists'))).toBe(true);
    });

    it('should warn but succeed when critical files exist with force flag', async () => {
      // Mock stat to return file stats for CLAUDE.md
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('CLAUDE.md')) {
          return Promise.resolve({ isFile: true });
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await validator.checkConflicts(true);

      expect(result.success).toBe(true);
      expect(result.conflicts).toContain('CLAUDE.md');
      expect(result.warnings.some(w => w.includes('will be overwritten'))).toBe(true);
    });

    it('should warn when directories have content', async () => {
      // Mock stat and readDir for existing directory with content
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('memory')) {
          return Promise.resolve({ isDirectory: true });
        }
        return Promise.reject(new Error('File not found'));
      });

      // Create an async iterator for readDir
      const mockDirEntries = [{ name: 'existing-file.txt' }];
      mockDeno.readDir.mockImplementation(() => {
        return {
          async *[Symbol.asyncIterator]() {
            for (const entry of mockDirEntries) {
              yield entry;
            }
          }
        };
      });

      const result = await validator.checkConflicts();

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('Directory exists with content'))).toBe(true);
    });
  });

  describe('checkDependencies', () => {
    it('should pass when all required dependencies are available', async () => {
      // Mock successful command execution for all dependencies
      const mockCommand = {
        output: jest.fn().mockResolvedValue({
          stdout: new TextEncoder().encode('v18.0.0'),
          success: true
        })
      };
      
      mockDeno.Command.mockReturnValue(mockCommand);

      const result = await validator.checkDependencies();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.dependencies.node.available).toBe(true);
      expect(result.dependencies.npm.available).toBe(true);
      expect(result.dependencies.npx.available).toBe(true);
    });

    it('should fail when required dependencies are missing', async () => {
      // Mock command failure for node
      mockDeno.Command.mockImplementation((cmd) => {
        const mockOutput = {
          output: jest.fn()
        };
        
        if (cmd === 'node') {
          mockOutput.output.mockResolvedValue({ success: false });
        } else {
          mockOutput.output.mockResolvedValue({
            stdout: new TextEncoder().encode('v8.0.0'),
            success: true
          });
        }
        
        return mockOutput;
      });

      const result = await validator.checkDependencies();

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('node'))).toBe(true);
      expect(result.dependencies.node.available).toBe(false);
    });

    it('should warn when optional dependencies are missing', async () => {
      // Mock command failure for git (optional dependency)
      mockDeno.Command.mockImplementation((cmd) => {
        const mockOutput = {
          output: jest.fn()
        };
        
        if (cmd === 'git') {
          mockOutput.output.mockResolvedValue({ success: false });
        } else {
          mockOutput.output.mockResolvedValue({
            stdout: new TextEncoder().encode('v8.0.0'),
            success: true
          });
        }
        
        return mockOutput;
      });

      const result = await validator.checkDependencies();

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('git'))).toBe(true);
      expect(result.dependencies.git.available).toBe(false);
    });
  });

  describe('checkEnvironment', () => {
    it('should pass when all required environment variables are set', async () => {
      mockDeno.env.get.mockImplementation((name) => {
        const envVars = {
          'PATH': '/usr/bin:/bin',
          'HOME': '/home/user'
        };
        return envVars[name] || null;
      });

      // Mock git command success
      const mockCommand = {
        output: jest.fn().mockResolvedValue({ success: true })
      };
      mockDeno.Command.mockReturnValue(mockCommand);

      const result = await validator.checkEnvironment();

      expect(result.success).toBe(true);
      expect(result.environment.PATH).toBe('set');
      expect(result.environment.gitRepo).toBe(true);
    });

    it('should fail when required environment variables are missing', async () => {
      mockDeno.env.get.mockImplementation((name) => {
        // PATH is required but not set
        return name === 'PATH' ? null : '/home/user';
      });

      const result = await validator.checkEnvironment();

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('PATH'))).toBe(true);
    });

    it('should warn when not in a git repository', async () => {
      mockDeno.env.get.mockImplementation((name) => {
        const envVars = {
          'PATH': '/usr/bin:/bin',
          'HOME': '/home/user'
        };
        return envVars[name] || null;
      });

      // Mock git command failure
      const mockCommand = {
        output: jest.fn().mockResolvedValue({ success: false })
      };
      mockDeno.Command.mockReturnValue(mockCommand);

      const result = await validator.checkEnvironment();

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('Not in a git repository'))).toBe(true);
      expect(result.environment.gitRepo).toBe(false);
    });
  });

  describe('runAllChecks', () => {
    it('should run all validation checks and aggregate results', async () => {
      // Mock all methods to succeed
      mockDeno.writeTextFile.mockResolvedValue();
      mockDeno.remove.mockResolvedValue();
      mockDeno.mkdir.mockResolvedValue();
      mockDeno.stat.mockRejectedValue(new Error('File not found'));
      mockDeno.env.get.mockReturnValue('/usr/bin:/bin');
      
      const mockCommand = {
        output: jest.fn().mockResolvedValue({
          stdout: new TextEncoder().encode('v18.0.0'),
          success: true
        })
      };
      mockDeno.Command.mockReturnValue(mockCommand);

      const result = await validator.runAllChecks();

      expect(result.success).toBe(true);
      expect(result.results).toHaveProperty('permissions');
      expect(result.results).toHaveProperty('diskSpace');
      expect(result.results).toHaveProperty('conflicts');
      expect(result.results).toHaveProperty('dependencies');
      expect(result.results).toHaveProperty('environment');
    });

    it('should fail overall when any check fails', async () => {
      // Mock permissions to fail
      mockDeno.writeTextFile.mockRejectedValue(new Error('Permission denied'));

      const result = await validator.runAllChecks();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should pass force option to conflict checking', async () => {
      // Mock file existence
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('CLAUDE.md')) {
          return Promise.resolve({ isFile: true });
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await validator.runAllChecks({ force: true });

      expect(result.results.conflicts.success).toBe(true);
      expect(result.results.conflicts.warnings.length).toBeGreaterThan(0);
    });
  });
});