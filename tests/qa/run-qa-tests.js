#!/usr/bin/env node
/**
 * QA Test Suite Runner
 * Executes all initialization-related quality assurance tests
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test suite configurations
const testSuites = [
  {
    name: 'Pre-Initialization Validator Tests',
    file: 'pre-init-validator.test.js',
    description: 'Validates system requirements and pre-checks',
    critical: true
  },
  {
    name: 'Post-Initialization Validator Tests', 
    file: 'post-init-validator.test.js',
    description: 'Verifies initialization integrity and structure',
    critical: true
  },
  {
    name: 'Batch Initialization Integration Tests',
    file: 'batch-initialization.integration.test.js', 
    description: 'Tests complete batch processing workflows',
    critical: true
  },
  {
    name: 'Performance Tests',
    file: 'performance.test.js',
    description: 'Validates performance and scalability characteristics',
    critical: false
  },
  {
    name: 'End-to-End Workflow Tests',
    file: 'end-to-end.test.js',
    description: 'Complete workflow validation from command to verification',
    critical: true
  }
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader() {
  console.log(colorize('=' * 80, 'cyan'));
  console.log(colorize('🧪 Claude-Flow Initialization QA Test Suite', 'bright'));
  console.log(colorize('   Comprehensive Quality Assurance Testing', 'cyan'));
  console.log(colorize('=' * 80, 'cyan'));
  console.log();
}

function printSuiteInfo(suite, index) {
  console.log(colorize(`📋 ${index + 1}. ${suite.name}`, 'bright'));
  console.log(`   ${suite.description}`);
  console.log(`   Critical: ${suite.critical ? colorize('Yes', 'red') : colorize('No', 'yellow')}`);
  console.log();
}

function runTest(suite) {
  return new Promise((resolve) => {
    const testFile = path.join(__dirname, suite.file);
    
    console.log(colorize(`🚀 Running: ${suite.name}`, 'blue'));
    console.log(colorize(`   File: ${suite.file}`, 'blue'));
    
    const startTime = Date.now();
    
    const child = spawn('npm', ['test', `tests/qa/${suite.file}`, '--verbose'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const result = {
        name: suite.name,
        file: suite.file,
        critical: suite.critical,
        success: code === 0,
        duration,
        stdout,
        stderr
      };

      if (code === 0) {
        console.log(colorize(`✅ PASSED: ${suite.name} (${duration}ms)`, 'green'));
      } else {
        console.log(colorize(`❌ FAILED: ${suite.name} (${duration}ms)`, 'red'));
        if (suite.critical) {
          console.log(colorize(`⚠️  CRITICAL TEST FAILED!`, 'red'));
        }
      }
      
      console.log();
      resolve(result);
    });
  });
}

function printSummary(results) {
  console.log(colorize('=' * 80, 'cyan'));
  console.log(colorize('📊 Test Execution Summary', 'bright'));
  console.log(colorize('=' * 80, 'cyan'));
  console.log();

  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  const criticalFailed = results.filter(r => !r.success && r.critical).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  // Overall statistics
  console.log(colorize('Overall Results:', 'bright'));
  console.log(`  Total Test Suites: ${totalTests}`);
  console.log(`  Passed: ${colorize(passedTests, 'green')}`);
  console.log(`  Failed: ${colorize(failedTests, failedTests > 0 ? 'red' : 'green')}`);
  console.log(`  Critical Failures: ${colorize(criticalFailed, criticalFailed > 0 ? 'red' : 'green')}`);
  console.log(`  Total Execution Time: ${totalDuration}ms`);
  console.log();

  // Detailed results
  console.log(colorize('Detailed Results:', 'bright'));
  results.forEach((result, index) => {
    const status = result.success ? colorize('PASS', 'green') : colorize('FAIL', 'red');
    const critical = result.critical ? colorize('[CRITICAL]', 'red') : colorize('[OPTIONAL]', 'yellow');
    console.log(`  ${index + 1}. ${status} ${critical} ${result.name} (${result.duration}ms)`);
  });
  console.log();

  // Performance analysis
  console.log(colorize('Performance Analysis:', 'bright'));
  const avgDuration = totalDuration / totalTests;
  const fastestTest = results.reduce((min, r) => r.duration < min.duration ? r : min);
  const slowestTest = results.reduce((max, r) => r.duration > max.duration ? r : max);
  
  console.log(`  Average Duration: ${avgDuration.toFixed(0)}ms`);
  console.log(`  Fastest Test: ${fastestTest.name} (${fastestTest.duration}ms)`);
  console.log(`  Slowest Test: ${slowestTest.name} (${slowestTest.duration}ms)`);
  console.log();

  // Final assessment
  if (criticalFailed === 0) {
    console.log(colorize('🎉 ALL CRITICAL TESTS PASSED!', 'green'));
    if (failedTests === 0) {
      console.log(colorize('🏆 PERFECT SCORE - ALL TESTS PASSED!', 'green'));
    } else {
      console.log(colorize(`⚠️  ${failedTests} non-critical test(s) failed`, 'yellow'));
    }
  } else {
    console.log(colorize(`🚨 ${criticalFailed} CRITICAL TEST(S) FAILED!`, 'red'));
    console.log(colorize('❌ SYSTEM NOT READY FOR PRODUCTION', 'red'));
  }
  
  console.log();
  console.log(colorize('=' * 80, 'cyan'));
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    quick: args.includes('--quick') || args.includes('-q'),
    critical: args.includes('--critical-only') || args.includes('-c')
  };

  printHeader();

  // Filter test suites based on options
  let suitesToRun = testSuites;
  if (options.critical) {
    suitesToRun = testSuites.filter(suite => suite.critical);
    console.log(colorize('🎯 Running critical tests only', 'yellow'));
    console.log();
  }

  if (options.quick) {
    suitesToRun = suitesToRun.filter(suite => !suite.file.includes('performance'));
    console.log(colorize('⚡ Quick mode: skipping performance tests', 'yellow'));
    console.log();
  }

  // Show test suite information
  if (options.verbose) {
    console.log(colorize('Test Suites to Execute:', 'bright'));
    suitesToRun.forEach((suite, index) => {
      printSuiteInfo(suite, index);
    });
  }

  // Execute tests
  console.log(colorize(`🏃 Executing ${suitesToRun.length} test suite(s)...`, 'bright'));
  console.log();

  const results = [];
  for (const suite of suitesToRun) {
    const result = await runTest(suite);
    results.push(result);
    
    // Early exit on critical failure if not in verbose mode
    if (!options.verbose && !result.success && result.critical) {
      console.log(colorize('💥 Critical test failed - stopping execution', 'red'));
      break;
    }
  }

  // Print summary
  printSummary(results);

  // Exit with appropriate code
  const criticalFailed = results.filter(r => !r.success && r.critical).length;
  process.exit(criticalFailed > 0 ? 1 : 0);
}

// Handle CLI usage
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(colorize('Claude-Flow QA Test Suite Runner', 'bright'));
  console.log();
  console.log('Usage: node run-qa-tests.js [options]');
  console.log();
  console.log('Options:');
  console.log('  --verbose, -v      Show detailed test information and continue on failures');
  console.log('  --quick, -q        Skip performance tests for faster execution');
  console.log('  --critical-only, -c Run only critical tests');
  console.log('  --help, -h         Show this help message');
  console.log();
  console.log('Examples:');
  console.log('  node run-qa-tests.js                 # Run all tests');
  console.log('  node run-qa-tests.js --quick          # Run all tests except performance');
  console.log('  node run-qa-tests.js --critical-only  # Run only critical tests');
  console.log('  node run-qa-tests.js --verbose        # Detailed output with full execution');
  process.exit(0);
}

// Run the test suite
main().catch((error) => {
  console.error(colorize('💥 Fatal error running test suite:', 'red'));
  console.error(error);
  process.exit(1);
});