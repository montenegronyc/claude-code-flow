#!/usr/bin/env -S deno run --allow-all
/**
 * Backend Initialization Demo for Claude Flow
 * Demonstrates the complete backend initialization process
 */

import { initializeBackend, shutdownBackend, checkBackendHealth } from './backend-init.js';

/**
 * Demo function to show backend initialization
 */
async function demoBackendInitialization(): Promise<void> {
  console.log('🎯 Claude Flow Backend Initialization Demo\n');
  console.log('='.repeat(50));
  
  let result;
  
  try {
    // Initialize backend systems
    console.log('\n🚀 Starting backend initialization...\n');
    
    result = await initializeBackend({
      environment: 'development',
      logLevel: 'info',
      skipHealthChecks: false,
    });
    
    console.log('✅ Backend initialization successful!\n');
    
    // Display initialization results
    console.log('📊 Initialization Results:');
    console.log('='.repeat(30));
    console.log(`• Duration: ${Math.round(result.initializationTime)}ms`);
    console.log(`• Success: ${result.success ? '✅' : '❌'}`);
    console.log(`• Services Status:`, result.servicesStatus);
    
    if (result.errors.length > 0) {
      console.log(`• Errors: ${result.errors.length}`);
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n');
    
    // Demonstrate health checking
    console.log('🏥 Performing health checks...\n');
    
    const health = await checkBackendHealth(result.orchestrator);
    
    console.log('📈 Health Check Results:');
    console.log('='.repeat(30));
    console.log(`• Overall Health: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`• Services:`);
    
    for (const [service, healthy] of Object.entries(health.services)) {
      console.log(`  • ${service}: ${healthy ? '✅' : '❌'}`);
    }
    
    if (health.issues.length > 0) {
      console.log(`• Issues:`);
      health.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }
    
    console.log('\n');
    
    // Demonstrate service status checking
    console.log('📋 Service Status Details...\n');
    
    const status = await result.orchestrator.getStatus();
    console.log('🔍 Detailed Status:');
    console.log('='.repeat(30));
    console.log(`• Initialized: ${status.initialized ? '✅' : '❌'}`);
    console.log(`• Timestamp: ${status.timestamp}`);
    console.log(`• Service States:`, status.services.states);
    console.log(`• Service Health:`, status.services.health);
    
    console.log('\n');
    
    // Wait a moment to let things settle
    console.log('⏳ Running for 10 seconds to demonstrate stability...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Final health check
    const finalHealth = await checkBackendHealth(result.orchestrator);
    console.log('🔍 Final Health Check:');
    console.log('='.repeat(30));
    console.log(`• Overall Health: ${finalHealth.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`• All services operational: ${Object.values(finalHealth.services).every(h => h) ? '✅' : '❌'}`);
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Backend initialization failed!');
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    process.exit(1);
  } finally {
    // Cleanup
    if (result?.orchestrator) {
      console.log('🛑 Shutting down backend systems...\n');
      
      try {
        await shutdownBackend(result.orchestrator);
        console.log('✅ Backend shutdown completed successfully\n');
      } catch (shutdownError) {
        console.error('❌ Error during shutdown:', shutdownError);
      }
    }
  }
  
  console.log('🎉 Demo completed successfully!');
  console.log('='.repeat(50));
}

/**
 * Run the demo
 */
if (import.meta.main) {
  demoBackendInitialization().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

export { demoBackendInitialization };