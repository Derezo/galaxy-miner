#!/usr/bin/env node
/**
 * Galaxy Miner - Handler Duplicate Audit Script
 *
 * Scans for duplicate socket.on() registrations across all files.
 * Exit codes:
 *   0 - No duplicates found
 *   1 - Duplicates found
 *
 * Usage:
 *   node scripts/audit-handler-duplicates.js
 *   node scripts/audit-handler-duplicates.js --verbose
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// Client handler files to scan
const CLIENT_FILES = [
  'client/js/network.js',
  'client/js/network/auth.js',
  'client/js/network/chat.js',
  'client/js/network/combat.js',
  'client/js/network/derelict.js',
  'client/js/network/loot.js',
  'client/js/network/marketplace.js',
  'client/js/network/mining.js',
  'client/js/network/npc.js',
  'client/js/network/player.js',
  'client/js/network/ship.js',
  'client/js/network/wormhole.js',
  'client/js/network/scavenger.js',
  'client/js/network/pirate.js'
];

// Server handler files to scan
const SERVER_FILES = [
  'server/socket.js'
];

// Pattern to find socket.on() registrations
const ON_PATTERN = /(?:socket|this\.socket)\.on\s*\(\s*['"`]([^'"`]+)['"`]/g;

const verbose = process.argv.includes('--verbose');

function extractHandlers(filePath) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const handlers = [];

  const pattern = new RegExp(ON_PATTERN.source, 'g');
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    handlers.push({
      event: match[1],
      file: filePath,
      line
    });
  }

  return handlers;
}

function findDuplicates(handlers) {
  const eventMap = new Map();

  for (const h of handlers) {
    if (!eventMap.has(h.event)) {
      eventMap.set(h.event, []);
    }
    eventMap.get(h.event).push(h);
  }

  return [...eventMap.entries()]
    .filter(([_, locs]) => locs.length > 1)
    .map(([event, locs]) => ({ event, locations: locs }));
}

// Main
console.log('====================================');
console.log('  Handler Duplicate Audit');
console.log('====================================\n');

const allClientHandlers = CLIENT_FILES.flatMap(extractHandlers);
const allServerHandlers = SERVER_FILES.flatMap(extractHandlers);

const clientDupes = findDuplicates(allClientHandlers);
const serverDupes = findDuplicates(allServerHandlers);

let hasErrors = false;

if (clientDupes.length > 0) {
  hasErrors = true;
  console.log('\x1b[31mCLIENT DUPLICATES FOUND:\x1b[0m\n');
  for (const { event, locations } of clientDupes) {
    console.log(`  \x1b[33mEvent: ${event}\x1b[0m`);
    for (const loc of locations) {
      console.log(`    - ${loc.file}:${loc.line}`);
    }
    console.log();
  }
}

if (serverDupes.length > 0) {
  hasErrors = true;
  console.log('\x1b[31mSERVER DUPLICATES FOUND:\x1b[0m\n');
  for (const { event, locations } of serverDupes) {
    console.log(`  \x1b[33mEvent: ${event}\x1b[0m`);
    for (const loc of locations) {
      console.log(`    - ${loc.file}:${loc.line}`);
    }
    console.log();
  }
}

if (!hasErrors) {
  console.log('\x1b[32mNo duplicate handler registrations found.\x1b[0m\n');
}

// Summary
console.log('------------------------------------');
console.log('Summary:');
console.log(`  Client files scanned: ${CLIENT_FILES.filter(f => fs.existsSync(path.join(PROJECT_ROOT, f))).length}`);
console.log(`  Server files scanned: ${SERVER_FILES.filter(f => fs.existsSync(path.join(PROJECT_ROOT, f))).length}`);
console.log(`  Client handlers: ${allClientHandlers.length}`);
console.log(`  Server handlers: ${allServerHandlers.length}`);
console.log(`  \x1b[${clientDupes.length > 0 ? '31' : '32'}mClient duplicates: ${clientDupes.length}\x1b[0m`);
console.log(`  \x1b[${serverDupes.length > 0 ? '31' : '32'}mServer duplicates: ${serverDupes.length}\x1b[0m`);

if (verbose) {
  console.log('\n------------------------------------');
  console.log('Handler counts per file:\n');

  const fileMap = new Map();
  for (const h of [...allClientHandlers, ...allServerHandlers]) {
    const count = fileMap.get(h.file) || 0;
    fileMap.set(h.file, count + 1);
  }

  for (const [file, count] of [...fileMap.entries()].sort()) {
    console.log(`  ${file}: ${count}`);
  }
}

console.log('------------------------------------\n');

process.exit(hasErrors ? 1 : 0);
