/**
 * Galaxy Miner - Duplicate Handler Detection Tests
 *
 * Detects duplicate socket.on() registrations that would cause
 * events to fire multiple times.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../../..');

// Pattern to capture socket.on() registrations
const ON_PATTERN = /(?:socket|this\.socket)\.on\s*\(\s*['"`]([^'"`]+)['"`]/g;

// Client handler files
const CLIENT_HANDLER_FILES = [
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

// Server handler files
const SERVER_HANDLER_FILES = [
  'server/socket.js'
];

/**
 * Extract all socket.on() registrations with file and line info
 */
function extractHandlerRegistrations(filePath) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const registrations = [];

  const pattern = new RegExp(ON_PATTERN.source, 'g');
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split('\n').length;
    registrations.push({
      event: match[1],
      file: filePath,
      line: lineNumber
    });
  }

  return registrations;
}

/**
 * Find duplicate registrations across files
 */
function findDuplicates(registrations) {
  const eventMap = new Map();

  for (const reg of registrations) {
    if (!eventMap.has(reg.event)) {
      eventMap.set(reg.event, []);
    }
    eventMap.get(reg.event).push(reg);
  }

  // Return events registered more than once
  const duplicates = [];
  for (const [event, locations] of eventMap) {
    if (locations.length > 1) {
      duplicates.push({ event, locations });
    }
  }

  return duplicates;
}

describe('Duplicate Handler Detection', () => {
  let clientRegistrations = [];
  let serverRegistrations = [];

  beforeAll(() => {
    // Collect all client handler registrations
    for (const file of CLIENT_HANDLER_FILES) {
      clientRegistrations.push(...extractHandlerRegistrations(file));
    }

    // Collect all server handler registrations
    for (const file of SERVER_HANDLER_FILES) {
      serverRegistrations.push(...extractHandlerRegistrations(file));
    }
  });

  describe('Client Handler Duplicates', () => {
    it('should not have duplicate socket.on() registrations across all client files', () => {
      const duplicates = findDuplicates(clientRegistrations);

      if (duplicates.length > 0) {
        const messages = duplicates.map(d => {
          const locations = d.locations.map(l => `    - ${l.file}:${l.line}`).join('\n');
          return `  Event '${d.event}' registered ${d.locations.length} times:\n${locations}`;
        });

        expect.fail(
          `Found ${duplicates.length} duplicate handler registration(s):\n\n${messages.join('\n\n')}`
        );
      }

      expect(duplicates).toHaveLength(0);
    });

    it('should report total client handler count', () => {
      // This test always passes but reports useful info
      console.log(`\nTotal client handler registrations: ${clientRegistrations.length}`);

      const fileMap = new Map();
      for (const reg of clientRegistrations) {
        const count = fileMap.get(reg.file) || 0;
        fileMap.set(reg.file, count + 1);
      }

      console.log('Handlers per file:');
      for (const [file, count] of [...fileMap.entries()].sort()) {
        console.log(`  ${file}: ${count}`);
      }

      expect(clientRegistrations.length).toBeGreaterThan(0);
    });
  });

  describe('Server Handler Duplicates', () => {
    it('should not have duplicate socket.on() registrations across all server files', () => {
      const duplicates = findDuplicates(serverRegistrations);

      if (duplicates.length > 0) {
        const messages = duplicates.map(d => {
          const locations = d.locations.map(l => `    - ${l.file}:${l.line}`).join('\n');
          return `  Event '${d.event}' registered ${d.locations.length} times:\n${locations}`;
        });

        expect.fail(
          `Found ${duplicates.length} duplicate handler registration(s):\n\n${messages.join('\n\n')}`
        );
      }

      expect(duplicates).toHaveLength(0);
    });

    it('should report total server handler count', () => {
      console.log(`\nTotal server handler registrations: ${serverRegistrations.length}`);

      const fileMap = new Map();
      for (const reg of serverRegistrations) {
        const count = fileMap.get(reg.file) || 0;
        fileMap.set(reg.file, count + 1);
      }

      console.log('Handlers per file:');
      for (const [file, count] of [...fileMap.entries()].sort()) {
        console.log(`  ${file}: ${count}`);
      }

      expect(serverRegistrations.length).toBeGreaterThan(0);
    });
  });

  describe('Handler Registry', () => {
    it('should list all unique events with their locations', () => {
      const allRegistrations = [...clientRegistrations, ...serverRegistrations];
      const eventMap = new Map();

      for (const reg of allRegistrations) {
        if (!eventMap.has(reg.event)) {
          eventMap.set(reg.event, []);
        }
        eventMap.get(reg.event).push(`${reg.file}:${reg.line}`);
      }

      // Report unique events
      const uniqueEvents = [...eventMap.keys()].sort();
      console.log(`\nTotal unique events: ${uniqueEvents.length}`);

      expect(uniqueEvents.length).toBeGreaterThan(0);
    });
  });
});
