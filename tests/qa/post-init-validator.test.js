/**
 * Unit Tests for PostInitValidator
 * Tests verification and validation of completed initialization
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PostInitValidator } from '../../src/cli/simple-commands/init/validation/post-init-validator.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock Deno for Node.js testing environment
const mockDeno = {
  stat: jest.fn(),
  readTextFile: jest.fn(),
  readDir: jest.fn(),
  build: {
    os: 'linux'
  }
};

// Make Deno available globally for tests
global.Deno = mockDeno;

describe('PostInitValidator', () => {
  let validator;
  let testDir;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `claude-flow-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    validator = new PostInitValidator(testDir);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('checkFileIntegrity', () => {
    it('should pass when all expected files exist with correct properties', async () => {
      // Mock file stats for all expected files
      mockDeno.stat.mockImplementation((path) => {
        const filename = path.split('/').pop();
        
        const fileStats = {
          'CLAUDE.md': { isFile: true, size: 1500, mode: 0o644 },
          'memory-bank.md': { isFile: true, size: 800, mode: 0o644 },
          'coordination.md': { isFile: true, size: 600, mode: 0o644 },
          'claude-flow-data.json': { isFile: true, size: 150, mode: 0o644 },
          'README.md': { isFile: true, size: 200, mode: 0o644 },
          'claude-flow': { isFile: true, size: 500, mode: 0o755 }
        };
        
        return Promise.resolve(fileStats[filename] || { isFile: true, size: 100, mode: 0o644 });
      });

      // Mock successful file reading
      mockDeno.readTextFile.mockResolvedValue('file content');

      const result = await validator.checkFileIntegrity();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(Object.keys(result.files)).toHaveLength(7);
    });

    it('should fail when expected files are missing', async () => {
      // Mock file not found for CLAUDE.md
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('CLAUDE.md')) {
          return Promise.reject(new Error('File not found'));
        }
        return Promise.resolve({ isFile: true, size: 1000, mode: 0o644 });
      });

      const result = await validator.checkFileIntegrity();

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('File not found: CLAUDE.md'))).toBe(true);
      expect(result.files['CLAUDE.md'].status).toBe('missing');
    });

    it('should fail when files are too small', async () => {
      // Mock small file size for CLAUDE.md
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('CLAUDE.md')) {
          return Promise.resolve({ isFile: true, size: 50, mode: 0o644 }); // Too small
        }
        return Promise.resolve({ isFile: true, size: 1000, mode: 0o644 });
      });

      const result = await validator.checkFileIntegrity();

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('File too small: CLAUDE.md'))).toBe(true);
      expect(result.files['CLAUDE.md'].status).toBe('too_small');
    });

    it('should warn when executable files are not executable', async () => {
      // Mock non-executable permissions for claude-flow script
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('claude-flow')) {
          return Promise.resolve({ isFile: true, size: 500, mode: 0o644 }); // Not executable
        }
        return Promise.resolve({ isFile: true, size: 1000, mode: 0o644 });
      });

      mockDeno.readTextFile.mockResolvedValue('script content');

      const result = await validator.checkFileIntegrity();

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('File not executable: claude-flow'))).toBe(true);
      expect(result.files['claude-flow'].status).toBe('not_executable');
    });

    it('should fail when files are not readable', async () => {
      // Mock unreadable file
      mockDeno.stat.mockResolvedValue({ isFile: true, size: 1000, mode: 0o644 });
      mockDeno.readTextFile.mockImplementation((path) => {
        if (path.includes('CLAUDE.md')) {
          return Promise.reject(new Error('Permission denied'));
        }
        return Promise.resolve('content');
      });

      const result = await validator.checkFileIntegrity();

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Cannot read file: CLAUDE.md'))).toBe(true);
      expect(result.files['CLAUDE.md'].status).toBe('unreadable');
    });

    it('should fail when directories exist instead of expected files', async () => {
      // Mock directory instead of file
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('CLAUDE.md')) {
          return Promise.resolve({ isFile: false, isDirectory: true, size: 0, mode: 0o755 });
        }
        return Promise.resolve({ isFile: true, size: 1000, mode: 0o644 });
      });

      const result = await validator.checkFileIntegrity();

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Expected file but found directory: CLAUDE.md'))).toBe(true);
      expect(result.files['CLAUDE.md'].status).toBe('not_file');
    });
  });

  describe('checkCompleteness', () => {
    it('should pass when all required directories exist', async () => {
      // Mock all directories exist
      mockDeno.stat.mockResolvedValue({ isDirectory: true });

      const result = await validator.checkCompleteness();

      expect(result.success).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should fail when required directories are missing', async () => {
      // Mock missing memory directory
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('memory')) {
          return Promise.reject(new Error('Directory not found'));
        }
        return Promise.resolve({ isDirectory: true });
      });

      const result = await validator.checkCompleteness();

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Required directory missing: memory'))).toBe(true);
      expect(result.missing).toContain('memory');
    });

    it('should fail when files exist instead of expected directories', async () => {
      // Mock file instead of directory
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('coordination')) {
          return Promise.resolve({ isDirectory: false, isFile: true });
        }
        return Promise.resolve({ isDirectory: true });
      });

      const result = await validator.checkCompleteness();

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Expected directory but found file: coordination'))).toBe(true);
      expect(result.missing).toContain('coordination');
    });

    it('should warn about missing optional SPARC directories', async () => {
      // Mock required directories exist but optional SPARC directories don't
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('.roo') || path.includes('sparc')) {
          return Promise.reject(new Error('Directory not found'));
        }
        return Promise.resolve({ isDirectory: true });
      });

      const result = await validator.checkCompleteness();

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('Optional SPARC directory missing'))).toBe(true);
    });
  });

  describe('validateStructure', () => {
    it('should validate all structure components successfully', async () => {
      // Mock successful structure validation
      mockDeno.stat.mockResolvedValue({ isDirectory: true });
      mockDeno.readDir.mockResolvedValue([
        { name: 'command1.js', isFile: true }
      ]);

      const result = await validator.validateStructure();

      expect(result.success).toBe(true);
      expect(result.structure).toHaveProperty('memory');
      expect(result.structure).toHaveProperty('coordination');
      expect(result.structure).toHaveProperty('claude');
    });

    it('should warn when memory structure is incomplete', async () => {
      // Mock missing memory subdirectories
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('memory/agents')) {
          return Promise.reject(new Error('Directory not found'));
        }
        return Promise.resolve({ isDirectory: true });
      });

      const result = await validator.validateStructure();

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('Memory directory structure is incomplete'))).toBe(true);
      expect(result.structure.memory.valid).toBe(false);
    });

    it('should warn when coordination structure is incomplete', async () => {
      // Mock missing coordination subdirectories
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('coordination/memory_bank')) {
          return Promise.reject(new Error('Directory not found'));
        }
        return Promise.resolve({ isDirectory: true });
      });

      const result = await validator.validateStructure();

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('Coordination directory structure is incomplete'))).toBe(true);
      expect(result.structure.coordination.valid).toBe(false);
    });

    it('should validate SPARC structure when present', async () => {
      // Mock SPARC files existence
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('.roomodes')) {
          return Promise.resolve({ isFile: true });
        }
        return Promise.resolve({ isDirectory: true });
      });

      const result = await validator.validateStructure();

      expect(result.success).toBe(true);
      expect(result.structure).toHaveProperty('sparc');
      expect(result.structure.sparc.hasRoomodes).toBe(true);
    });

    it('should handle structure validation errors gracefully', async () => {
      // Mock validation error
      mockDeno.stat.mockRejectedValue(new Error('Access denied'));

      const result = await validator.validateStructure();

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Structure validation failed'))).toBe(true);
    });
  });

  describe('checkPermissions', () => {
    beforeEach(() => {
      // Reset build OS for permission tests
      mockDeno.build.os = 'linux';
    });

    it('should skip permission checks on Windows', async () => {
      mockDeno.build.os = 'windows';

      const result = await validator.checkPermissions();

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Permission checks skipped on Windows');
    });

    it('should pass when all files have correct permissions', async () => {
      // Mock correct permissions
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('claude-flow')) {
          return Promise.resolve({ mode: 0o100755 }); // Executable file
        }
        return Promise.resolve({ mode: 0o100644 }); // Regular file
      });

      const result = await validator.checkPermissions();

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(0);
      Object.values(result.permissions).forEach(perm => {
        expect(perm.correct).toBe(true);
      });
    });

    it('should warn when files have incorrect permissions', async () => {
      // Mock incorrect permissions
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('claude-flow')) {
          return Promise.resolve({ mode: 0o100644 }); // Should be executable
        }
        return Promise.resolve({ mode: 0o100600 }); // Should be readable by others
      });

      const result = await validator.checkPermissions();

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('Incorrect permissions'))).toBe(true);
    });

    it('should handle permission check errors gracefully', async () => {
      // Mock permission check error
      mockDeno.stat.mockRejectedValue(new Error('Permission denied'));

      const result = await validator.checkPermissions();

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('Could not check permissions'))).toBe(true);
    });
  });

  describe('validateMemoryStructure', () => {
    it('should validate complete memory structure', async () => {
      // Mock all memory structure components exist
      mockDeno.stat.mockResolvedValue({});

      const result = await validator.validateMemoryStructure();

      expect(result.valid).toBe(true);
      expect(result.dirs).toContain('agents');
      expect(result.dirs).toContain('sessions');
      expect(result.files).toContain('claude-flow-data.json');
      expect(result.files).toContain('agents/README.md');
      expect(result.files).toContain('sessions/README.md');
    });

    it('should detect incomplete memory structure', async () => {
      // Mock missing agents directory
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('agents')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.resolve({});
      });

      const result = await validator.validateMemoryStructure();

      expect(result.valid).toBe(false);
      expect(result.dirs).not.toContain('agents');
    });
  });

  describe('validateClaudeStructure', () => {
    it('should validate complete Claude structure with commands', async () => {
      // Mock Claude structure and command files
      mockDeno.stat.mockResolvedValue({});
      mockDeno.readDir.mockResolvedValue([
        { name: 'command1.js', isFile: true },
        { name: 'command2.js', isFile: true }
      ]);

      const result = await validator.validateClaudeStructure();

      expect(result.valid).toBe(true);
      expect(result.dirs).toContain('commands');
      expect(result.dirs).toContain('logs');
      expect(result.hasCommands).toBe(true);
      expect(result.commandCount).toBe(2);
    });

    it('should detect missing Claude directories', async () => {
      // Mock missing logs directory
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('logs')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.resolve({});
      });

      const result = await validator.validateClaudeStructure();

      expect(result.valid).toBe(false);
      expect(result.dirs).not.toContain('logs');
    });

    it('should handle empty commands directory', async () => {
      mockDeno.stat.mockResolvedValue({});
      mockDeno.readDir.mockResolvedValue([]);

      const result = await validator.validateClaudeStructure();

      expect(result.valid).toBe(true);
      expect(result.hasCommands).toBe(false);
      expect(result.commandCount).toBe(0);
    });
  });

  describe('validateSparcStructure', () => {
    it('should validate complete SPARC structure', async () => {
      // Mock complete SPARC structure
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('.roomodes')) {
          return Promise.resolve({ isFile: true });
        }
        return Promise.resolve({ isDirectory: true });
      });

      const result = await validator.validateSparcStructure();

      expect(result.valid).toBe(true);
      expect(result.hasRoomodes).toBe(true);
      expect(result.hasRooDir).toBe(true);
      expect(result.dirs).toContain('templates');
      expect(result.dirs).toContain('workflows');
      expect(result.dirs).toContain('modes');
      expect(result.dirs).toContain('configs');
    });

    it('should detect missing .roomodes file', async () => {
      // Mock missing .roomodes file
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('.roomodes')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.resolve({ isDirectory: true });
      });

      const result = await validator.validateSparcStructure();

      expect(result.valid).toBe(false);
      expect(result.hasRoomodes).toBe(false);
    });

    it('should handle missing .roo directory gracefully', async () => {
      // Mock .roomodes exists but .roo directory doesn't
      mockDeno.stat.mockImplementation((path) => {
        if (path.includes('.roomodes')) {
          return Promise.resolve({ isFile: true });
        }
        if (path.includes('.roo')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.resolve({ isDirectory: true });
      });

      const result = await validator.validateSparcStructure();

      expect(result.valid).toBe(true); // .roo directory is optional
      expect(result.hasRoomodes).toBe(true);
      expect(result.hasRooDir).toBe(false);
    });
  });
});