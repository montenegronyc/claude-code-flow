/**
 * Frontend State Manager - Centralized State Management for Frontend Components
 * Provides reactive state management, persistence, and synchronization
 */

/**
 * Reactive State Manager
 */
export class FrontendStateManager {
  constructor(options = {}) {
    this.options = {
      enablePersistence: true,
      enableSynchronization: true,
      enableReactivity: true,
      persistenceKey: 'claude-flow-state',
      syncInterval: 5000,
      maxHistorySize: 100,
      ...options
    };
    
    // Core state storage
    this.state = new Map();
    this.subscribers = new Map();
    this.history = [];
    this.currentIndex = -1;
    
    // Reactive system
    this.watchers = new Map();
    this.computedProperties = new Map();
    this.effects = new Set();
    
    // Persistence system
    this.persistenceQueue = [];
    this.persistenceTimer = null;
    
    // Synchronization
    this.syncCallbacks = new Set();
    this.syncTimer = null;
    
    // Performance tracking
    this.metrics = {
      stateChanges: 0,
      persistOperations: 0,
      syncOperations: 0,
      subscriptionCalls: 0
    };
    
    this.initialize();
  }

  /**
   * Initialize state manager
   */
  initialize() {
    console.log('🗄️ Initializing Frontend State Manager...');
    
    // Load persisted state
    if (this.options.enablePersistence) {
      this.loadPersistedState();
    }
    
    // Setup persistence
    this.setupPersistence();
    
    // Setup synchronization
    if (this.options.enableSynchronization) {
      this.setupSynchronization();
    }
    
    // Setup cleanup
    this.setupCleanup();
    
    console.log('✅ Frontend State Manager initialized');
  }

  /**
   * Get state value
   */
  get(key) {
    return this.state.get(key);
  }

  /**
   * Set state value
   */
  set(key, value, options = {}) {
    const previousValue = this.state.get(key);
    const timestamp = Date.now();
    
    // Check if value actually changed
    if (this.isEqual(previousValue, value) && !options.force) {
      return false;
    }
    
    // Update state
    this.state.set(key, value);
    
    // Add to history
    if (this.options.enableReactivity) {
      this.addToHistory({
        key,
        previousValue,
        newValue: value,
        timestamp,
        action: 'set'
      });
    }
    
    // Trigger reactivity
    this.triggerReactivity(key, value, previousValue);
    
    // Queue for persistence
    if (this.options.enablePersistence && !options.skipPersistence) {
      this.queueForPersistence(key, value);
    }
    
    // Update metrics
    this.metrics.stateChanges++;
    
    return true;
  }

  /**
   * Update state value (merge objects/arrays)
   */
  update(key, updater, options = {}) {
    const currentValue = this.get(key);
    let newValue;
    
    if (typeof updater === 'function') {
      newValue = updater(currentValue);
    } else if (typeof updater === 'object' && updater !== null) {
      if (Array.isArray(currentValue)) {
        newValue = [...(currentValue || []), ...updater];
      } else if (typeof currentValue === 'object' && currentValue !== null) {
        newValue = { ...(currentValue || {}), ...updater };
      } else {
        newValue = updater;
      }
    } else {
      newValue = updater;
    }
    
    return this.set(key, newValue, options);
  }

  /**
   * Delete state value
   */
  delete(key, options = {}) {
    if (!this.state.has(key)) {
      return false;
    }
    
    const previousValue = this.state.get(key);
    this.state.delete(key);
    
    // Add to history
    if (this.options.enableReactivity) {
      this.addToHistory({
        key,
        previousValue,
        newValue: undefined,
        timestamp: Date.now(),
        action: 'delete'
      });
    }
    
    // Trigger reactivity
    this.triggerReactivity(key, undefined, previousValue);
    
    // Queue for persistence
    if (this.options.enablePersistence && !options.skipPersistence) {
      this.queueForPersistence(key, undefined);
    }
    
    return true;
  }

  /**
   * Check if state has key
   */
  has(key) {
    return this.state.has(key);
  }

  /**
   * Get all state keys
   */
  keys() {
    return Array.from(this.state.keys());
  }

  /**
   * Get all state values
   */
  values() {
    return Array.from(this.state.values());
  }

  /**
   * Get all state entries
   */
  entries() {
    return Array.from(this.state.entries());
  }

  /**
   * Get state size
   */
  size() {
    return this.state.size;
  }

  /**
   * Clear all state
   */
  clear(options = {}) {
    const keys = Array.from(this.state.keys());
    this.state.clear();
    
    // Add to history
    if (this.options.enableReactivity) {
      this.addToHistory({
        key: '*',
        previousValue: keys,
        newValue: undefined,
        timestamp: Date.now(),
        action: 'clear'
      });
    }
    
    // Trigger reactivity for all keys
    keys.forEach(key => {
      this.triggerReactivity(key, undefined, this.state.get(key));
    });
    
    // Queue for persistence
    if (this.options.enablePersistence && !options.skipPersistence) {
      this.queueForPersistence('*', undefined);
    }
    
    return true;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(key, callback, options = {}) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    const subscription = {
      callback,
      immediate: options.immediate !== false,
      once: options.once === true,
      filter: options.filter,
      transform: options.transform
    };
    
    this.subscribers.get(key).add(subscription);
    
    // Call immediately if requested and value exists
    if (subscription.immediate && this.has(key)) {
      try {
        const value = this.get(key);
        const transformedValue = subscription.transform ? subscription.transform(value) : value;
        
        if (!subscription.filter || subscription.filter(transformedValue)) {
          subscription.callback(transformedValue, key);
        }
      } catch (error) {
        console.error('Subscription callback error:', error);
      }
    }
    
    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(key);
      if (subscribers) {
        subscribers.delete(subscription);
        if (subscribers.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  /**
   * Watch state changes with reactive updates
   */
  watch(key, callback, options = {}) {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }
    
    const watcher = {
      callback,
      deep: options.deep === true,
      immediate: options.immediate !== false
    };
    
    this.watchers.get(key).add(watcher);
    
    // Call immediately if requested
    if (watcher.immediate && this.has(key)) {
      try {
        watcher.callback(this.get(key), undefined, key);
      } catch (error) {
        console.error('Watcher callback error:', error);
      }
    }
    
    // Return unwatch function
    return () => {
      const watchers = this.watchers.get(key);
      if (watchers) {
        watchers.delete(watcher);
        if (watchers.size === 0) {
          this.watchers.delete(key);
        }
      }
    };
  }

  /**
   * Create computed property
   */
  computed(key, computeFunction, dependencies = []) {
    const computedProp = {
      compute: computeFunction,
      dependencies,
      cache: null,
      cached: false
    };
    
    this.computedProperties.set(key, computedProp);
    
    // Setup watchers for dependencies
    const unwatchers = dependencies.map(dep => {
      return this.watch(dep, () => {
        computedProp.cached = false;
        this.triggerComputed(key);
      }, { immediate: false });
    });
    
    // Compute initial value
    this.triggerComputed(key);
    
    // Return function to remove computed property
    return () => {
      unwatchers.forEach(unwatch => unwatch());
      this.computedProperties.delete(key);
    };
  }

  /**
   * Create reactive effect
   */
  effect(effectFunction, dependencies = []) {
    const effect = {
      fn: effectFunction,
      dependencies,
      cleanup: null
    };
    
    this.effects.add(effect);
    
    // Setup watchers for dependencies
    const unwatchers = dependencies.map(dep => {
      return this.watch(dep, () => {
        this.runEffect(effect);
      }, { immediate: false });
    });
    
    // Run effect immediately
    this.runEffect(effect);
    
    // Return cleanup function
    return () => {
      if (effect.cleanup) {
        effect.cleanup();
      }
      unwatchers.forEach(unwatch => unwatch());
      this.effects.delete(effect);
    };
  }

  /**
   * Get state snapshot
   */
  getSnapshot() {
    return {
      state: Object.fromEntries(this.state),
      timestamp: Date.now(),
      size: this.state.size
    };
  }

  /**
   * Restore from snapshot
   */
  restoreSnapshot(snapshot, options = {}) {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new Error('Invalid snapshot');
    }
    
    // Clear current state if requested
    if (options.clear) {
      this.clear({ skipPersistence: true });
    }
    
    // Restore state
    Object.entries(snapshot.state || {}).forEach(([key, value]) => {
      this.set(key, value, { skipPersistence: true });
    });
    
    // Persist if enabled
    if (this.options.enablePersistence && !options.skipPersistence) {
      this.persistState();
    }
    
    console.log(`✅ Restored state from snapshot (${Object.keys(snapshot.state || {}).length} keys)`);
  }

  /**
   * Undo last state change
   */
  undo() {
    if (this.currentIndex >= 0 && this.history.length > 0) {
      const change = this.history[this.currentIndex];
      this.currentIndex--;
      
      if (change.action === 'set' || change.action === 'update') {
        this.set(change.key, change.previousValue, { skipPersistence: true });
      } else if (change.action === 'delete') {
        this.set(change.key, change.previousValue, { skipPersistence: true });
      } else if (change.action === 'clear') {
        this.clear({ skipPersistence: true });
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Redo last undone change
   */
  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      const change = this.history[this.currentIndex];
      
      if (change.action === 'set' || change.action === 'update') {
        this.set(change.key, change.newValue, { skipPersistence: true });
      } else if (change.action === 'delete') {
        this.delete(change.key, { skipPersistence: true });
      } else if (change.action === 'clear') {
        this.clear({ skipPersistence: true });
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Get state history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Trigger reactivity for a key
   */
  triggerReactivity(key, newValue, previousValue) {
    if (!this.options.enableReactivity) return;
    
    // Update metrics
    this.metrics.subscriptionCalls++;
    
    // Trigger subscribers
    const subscribers = this.subscribers.get(key);
    if (subscribers) {
      subscribers.forEach(subscription => {
        try {
          const value = subscription.transform ? subscription.transform(newValue) : newValue;
          
          if (!subscription.filter || subscription.filter(value)) {
            subscription.callback(value, key, previousValue);
            
            // Remove if it's a one-time subscription
            if (subscription.once) {
              subscribers.delete(subscription);
            }
          }
        } catch (error) {
          console.error('Subscription callback error:', error);
        }
      });
    }
    
    // Trigger watchers
    const watchers = this.watchers.get(key);
    if (watchers) {
      watchers.forEach(watcher => {
        try {
          watcher.callback(newValue, previousValue, key);
        } catch (error) {
          console.error('Watcher callback error:', error);
        }
      });
    }
    
    // Trigger computed properties that depend on this key
    this.computedProperties.forEach((computedProp, computedKey) => {
      if (computedProp.dependencies.includes(key)) {
        computedProp.cached = false;
        this.triggerComputed(computedKey);
      }
    });
    
    // Trigger effects that depend on this key
    this.effects.forEach(effect => {
      if (effect.dependencies.includes(key)) {
        this.runEffect(effect);
      }
    });
  }

  /**
   * Trigger computed property recalculation
   */
  triggerComputed(key) {
    const computedProp = this.computedProperties.get(key);
    if (!computedProp) return;
    
    if (!computedProp.cached) {
      try {
        const dependencies = computedProp.dependencies.map(dep => this.get(dep));
        const newValue = computedProp.compute(...dependencies);
        computedProp.cache = newValue;
        computedProp.cached = true;
        
        // Set the computed value in state
        this.set(key, newValue, { skipPersistence: true });
      } catch (error) {
        console.error(`Computed property ${key} error:`, error);
      }
    }
  }

  /**
   * Run reactive effect
   */
  runEffect(effect) {
    try {
      // Cleanup previous effect if it exists
      if (effect.cleanup) {
        effect.cleanup();
      }
      
      // Run effect and capture cleanup function
      const dependencies = effect.dependencies.map(dep => this.get(dep));
      const cleanup = effect.fn(...dependencies);
      
      if (typeof cleanup === 'function') {
        effect.cleanup = cleanup;
      }
    } catch (error) {
      console.error('Effect error:', error);
    }
  }

  /**
   * Add change to history
   */
  addToHistory(change) {
    // Remove any future history if we're not at the end
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }
    
    // Add new change
    this.history.push(change);
    this.currentIndex++;
    
    // Limit history size
    if (this.history.length > this.options.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  /**
   * Setup persistence
   */
  setupPersistence() {
    if (!this.options.enablePersistence) return;
    
    // Setup periodic persistence
    this.persistenceTimer = setInterval(() => {
      if (this.persistenceQueue.length > 0) {
        this.persistState();
      }
    }, 1000);
  }

  /**
   * Queue state for persistence
   */
  queueForPersistence(key, value) {
    this.persistenceQueue.push({ key, value, timestamp: Date.now() });
  }

  /**
   * Persist state to storage
   */
  persistState() {
    if (!this.options.enablePersistence) return;
    
    try {
      const snapshot = this.getSnapshot();
      
      // Use localStorage if available
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.options.persistenceKey, JSON.stringify(snapshot));
      }
      
      // Use sessionStorage as fallback
      else if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(this.options.persistenceKey, JSON.stringify(snapshot));
      }
      
      // Clear persistence queue
      this.persistenceQueue = [];
      this.metrics.persistOperations++;
      
    } catch (error) {
      console.error('State persistence error:', error);
    }
  }

  /**
   * Load persisted state
   */
  loadPersistedState() {
    try {
      let persistedData = null;
      
      // Try localStorage first
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.options.persistenceKey);
        if (stored) {
          persistedData = JSON.parse(stored);
        }
      }
      
      // Try sessionStorage if localStorage failed
      if (!persistedData && typeof sessionStorage !== 'undefined') {
        const stored = sessionStorage.getItem(this.options.persistenceKey);
        if (stored) {
          persistedData = JSON.parse(stored);
        }
      }
      
      if (persistedData && persistedData.state) {
        this.restoreSnapshot(persistedData, { skipPersistence: true });
        console.log(`✅ Loaded persisted state (${Object.keys(persistedData.state).length} keys)`);
      }
      
    } catch (error) {
      console.error('Failed to load persisted state:', error);
    }
  }

  /**
   * Setup synchronization
   */
  setupSynchronization() {
    this.syncTimer = setInterval(() => {
      this.synchronizeState();
    }, this.options.syncInterval);
  }

  /**
   * Synchronize state with external systems
   */
  synchronizeState() {
    if (this.syncCallbacks.size === 0) return;
    
    const snapshot = this.getSnapshot();
    
    this.syncCallbacks.forEach(callback => {
      try {
        callback(snapshot);
      } catch (error) {
        console.error('Sync callback error:', error);
      }
    });
    
    this.metrics.syncOperations++;
  }

  /**
   * Add synchronization callback
   */
  addSyncCallback(callback) {
    this.syncCallbacks.add(callback);
    
    return () => {
      this.syncCallbacks.delete(callback);
    };
  }

  /**
   * Setup cleanup handlers
   */
  setupCleanup() {
    const cleanup = () => {
      this.persistState();
      this.cleanup();
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', cleanup);
    }
    
    if (typeof process !== 'undefined') {
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    }
  }

  /**
   * Deep equality check
   */
  isEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      for (const key of keysA) {
        if (!keysB.includes(key) || !this.isEqual(a[key], b[key])) {
          return false;
        }
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      stateSize: this.state.size,
      subscriberCount: Array.from(this.subscribers.values()).reduce((sum, set) => sum + set.size, 0),
      watcherCount: Array.from(this.watchers.values()).reduce((sum, set) => sum + set.size, 0),
      computedCount: this.computedProperties.size,
      effectCount: this.effects.size,
      historySize: this.history.length
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    console.log('🧹 Cleaning up Frontend State Manager...');
    
    // Clear timers
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
    }
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    // Final persistence
    this.persistState();
    
    // Clear all reactive systems
    this.subscribers.clear();
    this.watchers.clear();
    this.computedProperties.clear();
    this.effects.clear();
    this.syncCallbacks.clear();
    
    // Clear state and history
    this.state.clear();
    this.history = [];
    this.currentIndex = -1;
    
    console.log('✅ Frontend State Manager cleanup complete');
  }
}

// Create global instance
const frontendStateManager = new FrontendStateManager();

// Export both class and instance
export default frontendStateManager;

// Make globally available in browser environments
if (typeof window !== 'undefined') {
  window.claudeFlowState = frontendStateManager;
}