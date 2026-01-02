/**
 * Mock Socket.io client for testing handler registration
 *
 * Tracks all event registrations and can detect duplicates at runtime.
 */

class MockSocket {
  constructor() {
    this.handlers = new Map();
    this.emittedEvents = [];
    this.registrationLog = [];
    this.duplicateWarnings = [];
    this.connected = true;
    this._anyHandler = null;
  }

  /**
   * Register an event handler (tracks duplicates)
   */
  on(event, handler) {
    const registration = {
      event,
      handler,
      stack: new Error().stack,
      timestamp: Date.now()
    };

    this.registrationLog.push(registration);

    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }

    const existing = this.handlers.get(event);
    if (existing.length > 0) {
      this.duplicateWarnings.push({
        event,
        count: existing.length + 1,
        previousRegistrations: existing.map(h => h.stack),
        newRegistration: registration.stack
      });
    }

    existing.push(registration);
    return this;
  }

  /**
   * Emit an event and track how many times handlers fire
   */
  emit(event, data) {
    const emission = {
      event,
      data,
      timestamp: Date.now(),
      handlerCount: 0,
      results: []
    };

    const handlers = this.handlers.get(event) || [];
    for (const { handler } of handlers) {
      try {
        const result = handler(data);
        emission.results.push({ success: true, result });
        emission.handlerCount++;
      } catch (error) {
        emission.results.push({ success: false, error: error.message });
        emission.handlerCount++;
      }
    }

    if (this._anyHandler) {
      this._anyHandler(event, data);
    }

    this.emittedEvents.push(emission);
    return emission;
  }

  /**
   * Simulate receiving an event from server
   */
  receive(event, data) {
    return this.emit(event, data);
  }

  /**
   * Get duplicate registration warnings
   */
  getDuplicates() {
    return this.duplicateWarnings;
  }

  /**
   * Check if any event has multiple handlers
   */
  hasDuplicates() {
    return this.duplicateWarnings.length > 0;
  }

  /**
   * Get handler count for a specific event
   */
  getHandlerCount(event) {
    return (this.handlers.get(event) || []).length;
  }

  /**
   * Get all registered events
   */
  getRegisteredEvents() {
    return [...this.handlers.keys()];
  }

  /**
   * Get all events that have multiple handlers
   */
  getEventsWithMultipleHandlers() {
    const result = [];
    for (const [event, handlers] of this.handlers) {
      if (handlers.length > 1) {
        result.push({ event, count: handlers.length });
      }
    }
    return result;
  }

  /**
   * Clear all state
   */
  reset() {
    this.handlers.clear();
    this.emittedEvents = [];
    this.registrationLog = [];
    this.duplicateWarnings = [];
  }

  /**
   * Socket.io compatibility methods
   */
  onAny(handler) {
    this._anyHandler = handler;
    return this;
  }

  offAny() {
    this._anyHandler = null;
    return this;
  }

  off(event, handler) {
    if (this.handlers.has(event)) {
      const handlers = this.handlers.get(event);
      if (handler) {
        const idx = handlers.findIndex(h => h.handler === handler);
        if (idx >= 0) {
          handlers.splice(idx, 1);
        }
      } else {
        handlers.length = 0;
      }
    }
    return this;
  }

  removeAllListeners(event) {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
    return this;
  }

  /**
   * Get a summary report of all registrations
   */
  getReport() {
    const report = {
      totalEvents: this.handlers.size,
      totalHandlers: this.registrationLog.length,
      duplicateCount: this.duplicateWarnings.length,
      eventsWithDuplicates: this.getEventsWithMultipleHandlers(),
      eventList: [...this.handlers.keys()].sort()
    };
    return report;
  }
}

// Export for CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MockSocket };
}

export { MockSocket };
