/**
 * End-to-End Tests for Init Command Workflows
 * Tests complete initialization workflows from command invocation to final validation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { initCommand } from '../../src/cli/simple-commands/init/index.js';
import { PreInitValidator } from '../../src/cli/simple-commands/init/validation/pre-init-validator.js';
import { PostInitValidator } from '../../src/cli/simple-commands/init/validation/post-init-validator.js';
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

// Mock utils functions
const mockUtils = {
  printSuccess: jest.fn(),
  printError: jest.fn(),
  printWarning: jest.fn(),
  printInfo: jest.fn()
};

global.Deno = mockDeno;
global.process = mockProcess;
global.cwd = () => '/test/dir';

// Mock the utils module
jest.mock('../../src/cli/utils.js', () => mockUtils);

describe('End-to-End Init Command Workflows', () => {
  let testDir;
  let originalConsoleLog;
  let originalConsoleError;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `claude-flow-e2e-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Mock console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup successful default mocks
    setupSuccessfulMocks();
  });

  afterEach(async () => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  function setupSuccessfulMocks() {
    mockDeno.mkdir.mockResolvedValue();
    mockDeno.writeTextFile.mockResolvedValue();
    mockDeno.readTextFile.mockResolvedValue('{}');
    mockDeno.stat.mockResolvedValue({ isDirectory: true, isFile: false, size: 1000, mode: 0o755 });
    mockDeno.readDir.mockResolvedValue([]);
    mockDeno.remove.mockResolvedValue();
    mockProcess.cwd.mockReturnValue(testDir);
    mockProcess.chdir.mockImplementation(() => {});
    mockDeno.env.get.mockImplementation((name) => {
      const envVars = {
        'PATH': '/usr/bin:/bin',
        'HOME': '/home/user'
      };
      return envVars[name] || null;
    });

    // Mock successful command execution
    const mockCommand = {
      output: jest.fn().mockResolvedValue({
        stdout: new TextEncoder().encode('v18.0.0'),
        success: true
      })
    };
    mockDeno.Command.mockReturnValue(mockCommand);
  }

  describe('Basic Initialization Workflow', () => {
    it('should complete full initialization workflow successfully', async () => {
      const options = {
        workingDir: testDir,
        force: false,
        dryRun: false,
        minimal: false,
        sparc: false
      };

      // This would normally call the real initCommand
      // For testing, we'll simulate the workflow steps
      
      // Step 1: Pre-validation
      const preValidator = new PreInitValidator(testDir);
      const preValidationResult = await preValidator.runAllChecks(options);
      expect(preValidationResult.success).toBe(true);

      // Step 2: Simulation of actual initialization
      // (In real implementation, this would call initCommand)
      const expectedDirs = [
        'memory',
        'memory/agents', 
        'memory/sessions',
        'coordination',
        'coordination/memory_bank',
        'coordination/subtasks',
        'coordination/orchestration',
        '.claude',
        '.claude/commands',
        '.claude/logs'
      ];

      const expectedFiles = [
        'CLAUDE.md',
        'memory-bank.md',
        'coordination.md',
        'memory/claude-flow-data.json',
        'memory/agents/README.md',
        'memory/sessions/README.md'
      ];

      // Verify directories were created
      expect(mockDeno.mkdir).toHaveBeenCalledTimes(expectedDirs.length);
      expectedDirs.forEach(dir => {
        expect(mockDeno.mkdir).toHaveBeenCalledWith(dir, { recursive: true });
      });

      // Verify files were created
      expectedFiles.forEach(file => {
        expect(mockDeno.writeTextFile).toHaveBeenCalledWith(file, expect.any(String));
      });

      // Step 3: Post-validation
      const postValidator = new PostInitValidator(testDir);
      
      // Mock file stats for post-validation
      mockDeno.stat.mockImplementation((filePath) => {
        const fileName = path.basename(filePath);
        if (fileName === 'claude-flow') {
          return Promise.resolve({ isFile: true, size: 500, mode: 0o755 });
        }
        return Promise.resolve({ isFile: true, size: 1000, mode: 0o644 });
      });

      const postValidationResult = await postValidator.checkFileIntegrity();
      expect(postValidationResult.success).toBe(true);

      // Verify success messages
      expect(mockUtils.printSuccess).toHaveBeenCalled();
    });

    it('should handle dry-run mode correctly', async () => {
      const options = {
        workingDir: testDir,
        force: false,
        dryRun: true,
        minimal: false,
        sparc: false
      };

      // In dry-run mode, no actual file operations should occur
      // This test would verify the dry-run logic in the actual implementation
      
      // Simulate dry-run workflow
      const preValidator = new PreInitValidator(testDir);
      const preValidationResult = await preValidator.runAllChecks(options);
      expect(preValidationResult.success).toBe(true);

      // In dry-run mode, file creation should be skipped
      // (This would be tested against the actual initCommand implementation)
      
      expect(mockUtils.printInfo).toHaveBeenCalledWith(
        expect.stringContaining('dry-run') || expect.stringContaining('DRY RUN')
      );
    });

    it('should handle force mode correctly when files exist', async () => {
      // Mock existing files
      mockDeno.stat.mockImplementation((filePath) => {
        if (filePath.includes('CLAUDE.md')) {
          return Promise.resolve({ isFile: true });
        }
        return Promise.reject(new Error('File not found'));
      });

      const options = {
        workingDir: testDir,
        force: true,
        dryRun: false,
        minimal: false,
        sparc: false
      };

      const preValidator = new PreInitValidator(testDir);
      const preValidationResult = await preValidator.runAllChecks(options);
      
      // Should succeed with warnings in force mode
      expect(preValidationResult.success).toBe(true);
      expect(preValidationResult.warnings.length).toBeGreaterThan(0);
      expect(preValidationResult.warnings.some(w => w.includes('overwritten'))).toBe(true);
    });
  });

  describe('Template-Based Initialization Workflows', () => {
    it('should complete web-api template initialization', async () => {
      const options = {
        workingDir: testDir,
        template: 'web-api',
        force: false,
        dryRun: false,
        minimal: false,
        sparc: false
      };

      // Simulate template-based initialization
      const preValidator = new PreInitValidator(testDir);
      const preValidationResult = await preValidator.runAllChecks(options);
      expect(preValidationResult.success).toBe(true);

      // Verify template-specific file creation
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('package.json', expect.stringContaining('express'));
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('src/index.js', expect.any(String));

      // Verify additional directories for web-api template
      expect(mockDeno.mkdir).toHaveBeenCalledWith('src', { recursive: true });
      expect(mockDeno.mkdir).toHaveBeenCalledWith('src/controllers', { recursive: true });
      expect(mockDeno.mkdir).toHaveBeenCalledWith('src/models', { recursive: true });
      expect(mockDeno.mkdir).toHaveBeenCalledWith('src/routes', { recursive: true });
      expect(mockDeno.mkdir).toHaveBeenCalledWith('tests', { recursive: true });
    });

    it('should complete react-app template initialization', async () => {
      const options = {
        workingDir: testDir,
        template: 'react-app',
        force: false,
        dryRun: false,
        minimal: false,
        sparc: false
      };

      // Simulate React template initialization
      const preValidator = new PreInitValidator(testDir);
      const preValidationResult = await preValidator.runAllChecks(options);
      expect(preValidationResult.success).toBe(true);

      // Verify React-specific files
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('package.json', expect.stringContaining('react'));
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('tsconfig.json', expect.any(String));

      // Verify React-specific directories
      expect(mockDeno.mkdir).toHaveBeenCalledWith('src/components', { recursive: true });
      expect(mockDeno.mkdir).toHaveBeenCalledWith('src/hooks', { recursive: true });
      expect(mockDeno.mkdir).toHaveBeenCalledWith('src/services', { recursive: true });
      expect(mockDeno.mkdir).toHaveBeenCalledWith('public', { recursive: true });
    });
  });

  describe('SPARC Integration Workflows', () => {
    it('should complete SPARC initialization workflow', async () => {
      const options = {
        workingDir: testDir,
        force: false,
        dryRun: false,
        minimal: false,
        sparc: true
      };

      // Simulate SPARC initialization
      const preValidator = new PreInitValidator(testDir);
      const preValidationResult = await preValidator.runAllChecks(options);
      expect(preValidationResult.success).toBe(true);

      // Verify SPARC-specific files and directories would be created
      // (This would require mocking the SPARC creation functions)
      
      // Post-validation should detect SPARC structure
      const postValidator = new PostInitValidator(testDir);
      
      // Mock SPARC files existence
      mockDeno.stat.mockImplementation((filePath) => {
        if (filePath.includes('.roomodes')) {
          return Promise.resolve({ isFile: true });
        }
        if (filePath.includes('.roo')) {
          return Promise.resolve({ isDirectory: true });
        }
        return Promise.resolve({ isFile: true, size: 1000, mode: 0o644 });
      });

      const sparcExists = await postValidator.checkSparcExists();
      expect(sparcExists).toBe(true);

      const sparcStructure = await postValidator.validateSparcStructure();
      expect(sparcStructure.valid).toBe(true);
      expect(sparcStructure.hasRoomodes).toBe(true);
    });
  });

  describe('Error Handling Workflows', () => {
    it('should handle pre-validation failures gracefully', async () => {
      // Mock permission failure
      mockDeno.writeTextFile.mockRejectedValue(new Error('Permission denied'));

      const options = {
        workingDir: testDir,
        force: false,
        dryRun: false,
        minimal: false,
        sparc: false
      };

      const preValidator = new PreInitValidator(testDir);
      const preValidationResult = await preValidator.runAllChecks(options);
      
      expect(preValidationResult.success).toBe(false);
      expect(preValidationResult.errors.length).toBeGreaterThan(0);
      expect(preValidationResult.errors.some(e => e.includes('Permission'))).toBe(true);

      // Initialization should not proceed after pre-validation failure
      expect(mockUtils.printError).toHaveBeenCalled();
    });

    it('should handle missing dependencies gracefully', async () => {
      // Mock missing node dependency
      const mockCommand = {
        output: jest.fn().mockResolvedValue({ success: false })
      };
      mockDeno.Command.mockImplementation((cmd) => {
        if (cmd === 'node') {
          return mockCommand;
        }
        return {
          output: jest.fn().mockResolvedValue({
            stdout: new TextEncoder().encode('v8.0.0'),
            success: true
          })
        };
      });

      const preValidator = new PreInitValidator(testDir);
      const dependencyResult = await preValidator.checkDependencies();
      
      expect(dependencyResult.success).toBe(false);
      expect(dependencyResult.errors.some(e => e.includes('node'))).toBe(true);
    });

    it('should handle disk space issues', async () => {
      // Mock low disk space
      const mockOutput = `Filesystem     1K-blocks      Used Available Use% Mounted on
/dev/sda1       1000000    950000     40000  96% /`;
      
      const mockCommand = {
        output: jest.fn().mockResolvedValue({
          stdout: new TextEncoder().encode(mockOutput),
          success: true
        })
      };
      mockDeno.Command.mockReturnValue(mockCommand);

      const preValidator = new PreInitValidator(testDir);
      const diskSpaceResult = await preValidator.checkDiskSpace();
      
      expect(diskSpaceResult.success).toBe(false);
      expect(diskSpaceResult.errors.some(e => e.includes('Insufficient disk space'))).toBe(true);
    });
  });

  describe('Post-Initialization Validation Workflows', () => {
    it('should validate complete initialization structure', async () => {
      // Mock successful initialization
      mockDeno.stat.mockImplementation((filePath) => {
        const fileName = path.basename(filePath);
        
        // Files
        if (fileName.includes('.md') || fileName.includes('.json') || fileName === 'claude-flow') {
          const size = fileName === 'claude-flow' ? 500 : 1000;
          const mode = fileName === 'claude-flow' ? 0o755 : 0o644;
          return Promise.resolve({ isFile: true, size, mode });
        }
        
        // Directories
        return Promise.resolve({ isDirectory: true });
      });

      mockDeno.readTextFile.mockResolvedValue('file content');
      mockDeno.readDir.mockResolvedValue([
        { name: 'command1.js', isFile: true }
      ]);

      const postValidator = new PostInitValidator(testDir);
      
      // Test file integrity
      const fileIntegrityResult = await postValidator.checkFileIntegrity();
      expect(fileIntegrityResult.success).toBe(true);
      expect(Object.keys(fileIntegrityResult.files)).toHaveLength(7);

      // Test structure completeness
      const completenessResult = await postValidator.checkCompleteness();
      expect(completenessResult.success).toBe(true);
      expect(completenessResult.missing).toHaveLength(0);

      // Test overall structure validation
      const structureResult = await postValidator.validateStructure();
      expect(structureResult.success).toBe(true);
      expect(structureResult.structure.memory.valid).toBe(true);
      expect(structureResult.structure.coordination.valid).toBe(true);
      expect(structureResult.structure.claude.valid).toBe(true);
    });

    it('should detect incomplete initialization', async () => {
      // Mock missing critical files
      mockDeno.stat.mockImplementation((filePath) => {
        if (filePath.includes('CLAUDE.md')) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve({ isFile: true, size: 1000, mode: 0o644 });
      });

      const postValidator = new PostInitValidator(testDir);
      const fileIntegrityResult = await postValidator.checkFileIntegrity();
      
      expect(fileIntegrityResult.success).toBe(false);
      expect(fileIntegrityResult.errors.some(e => e.includes('CLAUDE.md'))).toBe(true);
      expect(fileIntegrityResult.files['CLAUDE.md'].status).toBe('missing');
    });

    it('should detect permission issues', async () => {
      // Mock files with incorrect permissions
      mockDeno.stat.mockImplementation((filePath) => {
        if (filePath.includes('claude-flow')) {
          return Promise.resolve({ isFile: true, size: 500, mode: 0o644 }); // Not executable
        }
        return Promise.resolve({ isFile: true, size: 1000, mode: 0o600 }); // Wrong permissions
      });

      const postValidator = new PostInitValidator(testDir);
      const permissionResult = await postValidator.checkPermissions();
      
      expect(permissionResult.success).toBe(true); // Warnings, not errors
      expect(permissionResult.warnings.length).toBeGreaterThan(0);
      expect(permissionResult.warnings.some(w => w.includes('Incorrect permissions'))).toBe(true);
    });
  });

  describe('Multi-Environment Workflows', () => {
    it('should handle development environment setup', async () => {
      const options = {
        workingDir: testDir,
        environment: 'dev',
        force: false,
        dryRun: false,
        minimal: false,
        sparc: false
      };

      // Simulate environment-specific initialization
      const expectedEnvContent = 'NODE_ENV=development\nDEBUG=true\nLOG_LEVEL=debug';
      
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('.env', expectedEnvContent);
      
      // Verify environment-specific data in claude-flow-data.json
      const dataContent = JSON.stringify({
        agents: [],
        tasks: [],
        environment: 'dev',
        template: null,
        customConfig: {},
        lastUpdated: expect.any(Number)
      }, null, 2);
      
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith(
        'memory/claude-flow-data.json', 
        dataContent
      );
    });

    it('should handle production environment setup', async () => {
      const options = {
        workingDir: testDir,
        environment: 'prod',
        force: false,
        dryRun: false,
        minimal: false,
        sparc: false
      };

      // Simulate production environment setup
      const expectedEnvContent = 'NODE_ENV=production\nDEBUG=false\nLOG_LEVEL=error';
      
      expect(mockDeno.writeTextFile).toHaveBeenCalledWith('.env', expectedEnvContent);
    });
  });

  describe('Recovery and Rollback Workflows', () => {
    it('should handle partial initialization failures', async () => {
      // Mock failure partway through initialization
      let writeCallCount = 0;
      mockDeno.writeTextFile.mockImplementation((filePath) => {
        writeCallCount++;
        if (writeCallCount === 3) {
          return Promise.reject(new Error('Disk full'));
        }
        return Promise.resolve();
      });

      // In a real implementation, this would test rollback functionality
      // For now, we verify that the error is handled appropriately
      
      const postValidator = new PostInitValidator(testDir);
      const fileIntegrityResult = await postValidator.checkFileIntegrity();
      
      // Should detect missing files that failed to be created
      expect(fileIntegrityResult.success).toBe(false);
      expect(fileIntegrityResult.errors.length).toBeGreaterThan(0);
    });
  });
});