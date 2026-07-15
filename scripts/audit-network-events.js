#!/usr/bin/env node
/**
 * Galaxy Miner - Network Events Audit Script
 *
 * Scans the codebase to find all socket.emit() and socket.on() calls,
 * compares server emits with client listeners and vice versa,
 * and reports any mismatches.
 *
 * Usage:
 *   node scripts/audit-network-events.js
 *   node scripts/audit-network-events.js --verbose
 *   node scripts/audit-network-events.js --json
 *
 * Exit codes:
 *   0 - All events matched
 *   1 - Mismatches found
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = path.join(__dirname, '..');
const SERVER_PATHS = [
  'server'
];
const CLIENT_PATHS = [
  // Some UI components emit directly through Network.socket, so audit the
  // complete client source tree rather than only listener modules.
  'client/js'
];

// Patterns to match socket events
// Covers socket/io variants plus optional chaining used by UI components.
const EMIT_PATTERN = /(?:socket|io|this\.socket|player\.socket|Network\.socket|\.to\([^)]+\))\??\.emit\s*\(\s*['"`]([^'"`]+)['"`]/g;
const ON_PATTERN = /(?:socket|this\.socket)\.on\s*\(\s*['"`]([^'"`]+)['"`]/g;

// Additional patterns for helper functions that emit events
const BROADCAST_NEAR_PATTERN = /broadcastNear(?:Player|Npc|Base|All)?\s*\([^,]+,\s*['"`]([^'"`]+)['"`]/g;

// More broadcast helper patterns (different argument positions)
const BROADCAST_HELPER_PATTERNS = [
  // Generic proximity helpers. Event names are the first colon-delimited
  // string argument; the bounded span tolerates nested object arguments.
  /(?:emitNear|broadcastToNearby|broadcastWreckageNear|broadcastNearNpc|broadcastNearBase|broadcastInRange)\s*\([\s\S]{0,500}?,\s*['"`]([A-Za-z][A-Za-z0-9_-]*:[A-Za-z0-9:_-]+)['"`]\s*,/g,
  // broadcastToNearby(socket, player, 'event', data, ...) - event is 3rd arg
  /broadcastToNearby\s*\([^,]+,\s*[^,]+,\s*['"`]([^'"`]+)['"`]/g,
  // broadcastWreckageNear(wreckage, 'event', data) - event is 2nd arg
  /broadcastWreckageNear\s*\([^,]+,\s*['"`]([^'"`]+)['"`]/g,
  // broadcastNearNpc(npc, 'event', data) - event is 2nd arg
  /broadcastNearNpc\s*\([^,]+,\s*['"`]([^'"`]+)['"`]/g,
  // broadcastInRange(pos, range, 'event', data) - event is 3rd arg
  /broadcastInRange\s*\([^,]+,\s*[^,]+,\s*['"`]([^'"`]+)['"`]/g,
  // broadcastNearBase(base, 'event', data) - event is 2nd arg
  /broadcastNearBase\s*\([^,]+,\s*['"`]([^'"`]+)['"`]/g
];

// Known exceptions - events that are intentionally one-way or internal
const KNOWN_EXCEPTIONS = new Set([
  'connection',      // Socket.io internal
  'disconnect',      // Socket.io internal
  'connect',         // Socket.io internal
  'connect_error',   // Socket.io internal
  // Broadcast events for other players (informational, no handler needed)
  'player:profileChanged',     // Tells other players about profile change
  'loot:playerCollecting',     // Tells other players about collection start
  'loot:playerStopped',        // Tells other players about collection stop
  'loot:playerMultiCollecting',// Tells other players about multi-collect
  'wormhole:playerEntered',    // Tells other players about wormhole entry
  'wormhole:playerTransiting', // Tells other players about transit
  'wormhole:playerExited',     // Tells other players about wormhole exit
  'wormhole:playerCancelled',  // Tells other players about transit cancel
  // Backward-compatible/optional request contracts.
  'npc:update',                // Legacy single-NPC stream; server now emits npc:batch
  'mining:cancel',             // Optional manual cancellation (distance/death also cancel)
  'wormhole:getProgress',      // Optional polling RPC; normal flow is push-based
]);

// Parse command line arguments
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const jsonOutput = args.includes('--json');

/**
 * Recursively get all .js files in a directory
 */
function getJsFiles(dirPath) {
  const files = [];
  const fullPath = path.join(PROJECT_ROOT, dirPath);

  if (!fs.existsSync(fullPath)) {
    return files;
  }

  const stat = fs.statSync(fullPath);
  if (stat.isFile() && fullPath.endsWith('.js')) {
    return [fullPath];
  }

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(fullPath);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const entryPath = path.join(dirPath, entry);
      files.push(...getJsFiles(entryPath));
    }
  }

  return files;
}

/**
 * Extract event names from a file using a regex pattern
 */
function extractEvents(filePath, pattern) {
  const content = fs.readFileSync(filePath, 'utf8');
  const events = new Map();
  let match;

  // Reset lastIndex for global regex
  pattern.lastIndex = 0;

  while ((match = pattern.exec(content)) !== null) {
    const eventName = match[1];
    const lineNumber = content.substring(0, match.index).split('\n').length;

    if (!events.has(eventName)) {
      events.set(eventName, []);
    }
    events.get(eventName).push({
      file: path.relative(PROJECT_ROOT, filePath),
      line: lineNumber
    });
  }

  return events;
}

/**
 * Merge multiple event maps
 */
function mergeEventMaps(...maps) {
  const result = new Map();
  for (const map of maps) {
    for (const [key, value] of map) {
      if (!result.has(key)) {
        result.set(key, []);
      }
      result.get(key).push(...value);
    }
  }
  return result;
}

/**
 * Main audit function
 */
function auditNetworkEvents() {
  const results = {
    serverEmits: new Map(),
    serverListeners: new Map(),
    clientEmits: new Map(),
    clientListeners: new Map(),
    issues: []
  };

  // Collect server events
  for (const serverPath of SERVER_PATHS) {
    const files = getJsFiles(serverPath);
    for (const file of files) {
      const emits = extractEvents(file, new RegExp(EMIT_PATTERN.source, 'g'));
      const broadcastEmits = extractEvents(file, new RegExp(BROADCAST_NEAR_PATTERN.source, 'g'));
      const listeners = extractEvents(file, new RegExp(ON_PATTERN.source, 'g'));

      // Also extract from helper broadcast functions
      const helperEmits = [];
      for (const pattern of BROADCAST_HELPER_PATTERNS) {
        helperEmits.push(extractEvents(file, new RegExp(pattern.source, 'g')));
      }

      results.serverEmits = mergeEventMaps(results.serverEmits, emits, broadcastEmits, ...helperEmits);
      results.serverListeners = mergeEventMaps(results.serverListeners, listeners);
    }
  }

  // Collect client events
  for (const clientPath of CLIENT_PATHS) {
    const files = getJsFiles(clientPath);
    for (const file of files) {
      const emits = extractEvents(file, new RegExp(EMIT_PATTERN.source, 'g'));
      const listeners = extractEvents(file, new RegExp(ON_PATTERN.source, 'g'));
      results.clientEmits = mergeEventMaps(results.clientEmits, emits);
      results.clientListeners = mergeEventMaps(results.clientListeners, listeners);
    }
  }

  // Check for server emits without client listeners
  for (const [eventName, locations] of results.serverEmits) {
    if (KNOWN_EXCEPTIONS.has(eventName)) continue;

    if (!results.clientListeners.has(eventName)) {
      results.issues.push({
        type: 'MISSING_CLIENT_HANDLER',
        event: eventName,
        severity: 'error',
        message: `Server emits '${eventName}' but no client handler found`,
        locations
      });
    }
  }

  // Check for client emits without server listeners
  for (const [eventName, locations] of results.clientEmits) {
    if (KNOWN_EXCEPTIONS.has(eventName)) continue;

    if (!results.serverListeners.has(eventName)) {
      results.issues.push({
        type: 'MISSING_SERVER_HANDLER',
        event: eventName,
        severity: 'error',
        message: `Client emits '${eventName}' but no server handler found`,
        locations
      });
    }
  }

  // Check for client listeners without server emits (orphaned handlers)
  for (const [eventName, locations] of results.clientListeners) {
    if (KNOWN_EXCEPTIONS.has(eventName)) continue;

    if (!results.serverEmits.has(eventName)) {
      results.issues.push({
        type: 'ORPHANED_CLIENT_HANDLER',
        event: eventName,
        severity: 'warning',
        message: `Client listens for '${eventName}' but server never emits it`,
        locations
      });
    }
  }

  // Check for server listeners without client emits (orphaned handlers)
  for (const [eventName, locations] of results.serverListeners) {
    if (KNOWN_EXCEPTIONS.has(eventName)) continue;

    if (!results.clientEmits.has(eventName)) {
      results.issues.push({
        type: 'ORPHANED_SERVER_HANDLER',
        event: eventName,
        severity: 'warning',
        message: `Server listens for '${eventName}' but client never emits it`,
        locations
      });
    }
  }

  return results;
}

/**
 * Format and print results
 */
function printResults(results) {
  if (jsonOutput) {
    console.log(JSON.stringify({
      summary: {
        serverEmits: results.serverEmits.size,
        serverListeners: results.serverListeners.size,
        clientEmits: results.clientEmits.size,
        clientListeners: results.clientListeners.size,
        issues: results.issues.length,
        errors: results.issues.filter(i => i.severity === 'error').length,
        warnings: results.issues.filter(i => i.severity === 'warning').length
      },
      issues: results.issues
    }, null, 2));
    return;
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           Galaxy Miner Network Events Audit                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log('📊 Summary:');
  console.log(`   Server emits:    ${results.serverEmits.size} unique events`);
  console.log(`   Server handlers: ${results.serverListeners.size} unique events`);
  console.log(`   Client emits:    ${results.clientEmits.size} unique events`);
  console.log(`   Client handlers: ${results.clientListeners.size} unique events`);
  console.log();

  const errors = results.issues.filter(i => i.severity === 'error');
  const warnings = results.issues.filter(i => i.severity === 'warning');

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All events are properly matched!\n');
  } else {
    if (errors.length > 0) {
      console.log(`❌ Errors: ${errors.length}`);
      for (const issue of errors) {
        console.log(`\n   ${issue.type}: ${issue.event}`);
        console.log(`   ${issue.message}`);
        if (verbose) {
          for (const loc of issue.locations) {
            console.log(`     → ${loc.file}:${loc.line}`);
          }
        }
      }
      console.log();
    }

    if (warnings.length > 0) {
      console.log(`⚠️  Warnings: ${warnings.length}`);
      for (const issue of warnings) {
        console.log(`\n   ${issue.type}: ${issue.event}`);
        console.log(`   ${issue.message}`);
        if (verbose) {
          for (const loc of issue.locations) {
            console.log(`     → ${loc.file}:${loc.line}`);
          }
        }
      }
      console.log();
    }
  }

  if (verbose) {
    console.log('\n📋 All Server Emits:');
    for (const [event, locations] of [...results.serverEmits].sort()) {
      console.log(`   ${event}`);
      for (const loc of locations) {
        console.log(`     → ${loc.file}:${loc.line}`);
      }
    }

    console.log('\n📋 All Client Emits:');
    for (const [event, locations] of [...results.clientEmits].sort()) {
      console.log(`   ${event}`);
      for (const loc of locations) {
        console.log(`     → ${loc.file}:${loc.line}`);
      }
    }
  }
}

// Run audit
const results = auditNetworkEvents();
printResults(results);

// Exit with appropriate code
const hasErrors = results.issues.some(i => i.severity === 'error');
process.exit(hasErrors ? 1 : 0);
