'use strict';

/**
 * Debug Sync Module for Galaxy Miner
 * Tracks and logs client-server desync events
 *
 * Enable via:
 * - Server: DEBUG_SYNC=true environment variable
 * - Client: localStorage.setItem('DEBUG_SYNC', 'true')
 * - Client: URL param ?debugSync=true
 * - Runtime: debugSync.enable()
 */

const DebugSync = {
  _enabled: false,
  _recentDesyncs: [],
  _maxRecentDesyncs: 50,
  _logThrottles: new Map(),

  // Enable/disable debug logging
  enable() {
    this._enabled = true;
    console.log('[DEBUG SYNC] Enabled');
  },

  disable() {
    this._enabled = false;
    console.log('[DEBUG SYNC] Disabled');
  },

  isEnabled() {
    return this._enabled;
  },

  /**
   * Log a desync event
   * @param {string} type - Type of desync (e.g., 'NPC_STALE', 'ENTITY_TELEPORT')
   * @param {object} data - Context data for the desync
   */
  log(type, data) {
    if (!this._enabled) return;

    // Throttle repeated identical logs (1 second minimum between same type+key)
    const throttleKey = `${type}_${this._getDataKey(data)}`;
    const lastLog = this._logThrottles.get(throttleKey) || 0;
    const now = Date.now();

    if (now - lastLog < 1000) return;
    this._logThrottles.set(throttleKey, now);

    // Clean old throttle entries periodically
    if (this._logThrottles.size > 100) {
      const cutoff = now - 5000;
      for (const [key, time] of this._logThrottles) {
        if (time < cutoff) this._logThrottles.delete(key);
      }
    }

    // Format and store
    const logEntry = {
      timestamp: now,
      type,
      data,
      brief: this._formatBrief(type, data)
    };

    // Store recent desyncs
    this._recentDesyncs.push(logEntry);
    if (this._recentDesyncs.length > this._maxRecentDesyncs) {
      this._recentDesyncs.shift();
    }

    // Console output with formatted message
    console.error(`[DESYNC:${type}] ${logEntry.brief}`, data);
  },

  /**
   * Get a key from data for throttling purposes
   */
  _getDataKey(data) {
    if (data.entityId) return data.entityId;
    if (data.npcId) return data.npcId;
    if (data.baseId) return data.baseId;
    if (data.objectId) return data.objectId;
    return JSON.stringify(data).substring(0, 30);
  },

  /**
   * Format a brief human-readable message for the desync
   */
  _formatBrief(type, data) {
    switch (type) {
      case 'NPC_STALE':
        return `${data.npcId} (${data.type}) stale ${data.staleDuration}ms, state=${data.state}`;
      case 'ENTITY_TELEPORT':
        return `${data.entityId} jumped ${data.jumpDistance} units: (${Math.round(data.previousPos?.x)},${Math.round(data.previousPos?.y)}) -> (${Math.round(data.newPos?.x)},${Math.round(data.newPos?.y)})`;
      case 'ENTITY_STALE':
        return `${data.entityId} no update for ${data.staleDuration}ms`;
      case 'UNKNOWN_ENTITY_UPDATE':
        return `${data.entityId} (${data.type}) received update but not in local map`;
      case 'RADAR_WORLD_MISMATCH':
        return `${data.entityType} ${data.entityId} in radar but not world`;
      case 'SECTOR_CHECKSUM_MISMATCH':
        return `Sector (${data.sector?.x},${data.sector?.y}) mismatch: ${data.mismatches?.join(', ')}`;
      case 'BROADCAST_EMPTY':
        return `${data.event} for ${data.npcId || data.entityId} reached 0 players`;
      case 'BASE_STATE_MISMATCH':
        return `${data.baseId} state mismatch`;
      case 'ENTITY_LOOKUP_FAILED':
        return `${data.objectId} lookup failed in sector (${data.sectorX},${data.sectorY})`;
      case 'SYSTEM':
        return data.message || 'System event';
      default:
        return JSON.stringify(data).substring(0, 80);
    }
  },

  /**
   * Get recent desync events within a time window
   * @param {number} withinMs - Time window in milliseconds
   * @returns {Array} Recent desync entries
   */
  getRecentDesyncs(withinMs = 5000) {
    const cutoff = Date.now() - withinMs;
    return this._recentDesyncs.filter(d => d.timestamp > cutoff);
  },

  /**
   * Clear recent desyncs
   */
  clearRecent() {
    this._recentDesyncs = [];
  },

  /**
   * Get summary stats of recent desyncs
   */
  getStats() {
    const byType = {};
    for (const entry of this._recentDesyncs) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
    }
    return {
      total: this._recentDesyncs.length,
      byType,
      oldestTimestamp: this._recentDesyncs[0]?.timestamp,
      newestTimestamp: this._recentDesyncs[this._recentDesyncs.length - 1]?.timestamp
    };
  }
};

// Universal export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  // Node.js - check DEBUG_SYNC env var
  if (process.env.DEBUG_SYNC === 'true') {
    DebugSync.enable();
  }
  module.exports = DebugSync;
} else if (typeof window !== 'undefined') {
  window.debugSync = DebugSync;

  // Browser - check localStorage or URL param
  const urlParams = new URLSearchParams(window.location.search);
  if (localStorage.getItem('DEBUG_SYNC') === 'true' || urlParams.get('debugSync') === 'true') {
    DebugSync.enable();
  }
}
