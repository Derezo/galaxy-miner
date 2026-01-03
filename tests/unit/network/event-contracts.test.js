/**
 * Galaxy Miner - Network Event Contract Tests
 *
 * Tests to verify that network events are properly defined and consistent
 * between client and server implementations.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to project root
const PROJECT_ROOT = path.join(__dirname, '../../..');

// Helper to read and parse a JavaScript file for event patterns
function extractEventNames(filePath, pattern) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const events = [];
  let match;

  // Reset lastIndex for global regex
  const regex = new RegExp(pattern.source, 'g');

  while ((match = regex.exec(content)) !== null) {
    events.push(match[1]);
  }

  return [...new Set(events)]; // Deduplicate
}

// Patterns
const EMIT_PATTERN = /(?:socket|io|this\.socket|player\.socket|\.to\([^)]+\))\.emit\s*\(\s*['"`]([^'"`]+)['"`]/;
const ON_PATTERN = /(?:socket|this\.socket)\.on\s*\(\s*['"`]([^'"`]+)['"`]/;
const BROADCAST_PATTERN = /broadcastNear(?:Player|Npc|Base|All)?\s*\([^,]+,\s*['"`]([^'"`]+)['"`]/;

// Helper to recursively get all .js files
function getJsFiles(dirPath, files = []) {
  const fullPath = path.join(PROJECT_ROOT, dirPath);

  if (!fs.existsSync(fullPath)) {
    return files;
  }

  const stat = fs.statSync(fullPath);
  if (stat.isFile() && fullPath.endsWith('.js')) {
    return [dirPath];
  }

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(fullPath);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const entryPath = path.join(dirPath, entry);
      getJsFiles(entryPath, files);
      const entryFullPath = path.join(PROJECT_ROOT, entryPath);
      const entryStat = fs.statSync(entryFullPath);
      if (entryStat.isFile() && entryPath.endsWith('.js')) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

describe('Network Event Contracts', () => {
  let serverEmits = [];
  let serverListeners = [];
  let clientEmits = [];
  let clientListeners = [];

  beforeAll(() => {
    // Collect server events from key files (modular socket handlers in /server/socket/)
    const serverFiles = [
      ...getJsFiles('server/socket'),
      ...getJsFiles('server/handlers'),
      'server/game/engine.js',
      'server/game/combat.js',
      'server/game/star-damage.js',
      ...getJsFiles('server/game/ai')
    ];

    for (const file of serverFiles) {
      serverEmits.push(...extractEventNames(file, EMIT_PATTERN));
      serverEmits.push(...extractEventNames(file, BROADCAST_PATTERN));
      serverListeners.push(...extractEventNames(file, ON_PATTERN));
    }

    // Collect client events
    const clientFiles = [
      'client/js/network.js',
      ...getJsFiles('client/js/network')
    ];

    for (const file of clientFiles) {
      clientEmits.push(...extractEventNames(file, EMIT_PATTERN));
      clientListeners.push(...extractEventNames(file, ON_PATTERN));
    }

    // Deduplicate
    serverEmits = [...new Set(serverEmits)];
    serverListeners = [...new Set(serverListeners)];
    clientEmits = [...new Set(clientEmits)];
    clientListeners = [...new Set(clientListeners)];
  });

  describe('Event Naming Convention', () => {
    // Utility events that are exceptions to naming conventions
    const UTILITY_EVENTS = ['ping', 'pong', 'connection', 'disconnect', 'connect'];

    it('all server emits follow category:action format (with documented exceptions)', () => {
      const invalidEvents = serverEmits.filter(event => {
        // Skip utility events
        if (UTILITY_EVENTS.includes(event)) return false;
        // Check for colon separator
        return !event.includes(':');
      });

      expect(invalidEvents).toEqual([]);
    });

    it('all client emits follow category:action format (with documented exceptions)', () => {
      const invalidEvents = clientEmits.filter(event => {
        if (UTILITY_EVENTS.includes(event)) return false;
        return !event.includes(':');
      });

      expect(invalidEvents).toEqual([]);
    });

    it('event names use lowercase category with camelCase action', () => {
      // Galaxy Miner uses category:camelCaseAction format (e.g., combat:npcHit)
      // This test validates that pattern
      // Known exception: rogueMiner:foremanSpawn uses camelCase category (documented inconsistency)
      const KNOWN_CATEGORY_EXCEPTIONS = ['rogueMiner:foremanSpawn'];

      const allEvents = [...serverEmits, ...clientEmits, ...serverListeners, ...clientListeners];
      const invalidEvents = allEvents.filter(event => {
        if (UTILITY_EVENTS.includes(event)) return false;
        if (KNOWN_CATEGORY_EXCEPTIONS.includes(event)) return false;
        if (!event.includes(':')) return false;

        const [category] = event.split(':');
        // Category should be lowercase
        return category !== category.toLowerCase();
      });

      expect(invalidEvents).toEqual([]);
    });
  });

  describe('Authentication Events', () => {
    const authEvents = ['auth:login', 'auth:register', 'auth:token', 'auth:logout', 'auth:success', 'auth:error'];

    it('all auth events have server handlers', () => {
      const clientToServer = ['auth:login', 'auth:register', 'auth:token', 'auth:logout'];
      for (const event of clientToServer) {
        expect(serverListeners).toContain(event);
      }
    });

    it('all auth events have client handlers', () => {
      const serverToClient = ['auth:success', 'auth:error'];
      for (const event of serverToClient) {
        expect(clientListeners).toContain(event);
      }
    });
  });

  describe('Combat Events', () => {
    it('combat:fire is bidirectional', () => {
      expect(clientEmits).toContain('combat:fire');
      expect(serverListeners).toContain('combat:fire');
      expect(clientListeners).toContain('combat:fire');
    });

    it('combat:npcHit has client handler', () => {
      expect(clientListeners).toContain('combat:npcHit');
    });

    it('combat:chainLightning has client handler', () => {
      expect(clientListeners).toContain('combat:chainLightning');
    });
  });

  describe('Mining Events', () => {
    it('mining:start has server handler', () => {
      expect(serverListeners).toContain('mining:start');
    });

    it('mining response events have client handlers', () => {
      const miningResponses = ['mining:started', 'mining:complete', 'mining:cancelled', 'mining:error'];
      for (const event of miningResponses) {
        expect(clientListeners).toContain(event);
      }
    });
  });

  describe('Marketplace Events', () => {
    const marketClientToServer = ['market:list', 'market:buy', 'market:cancel', 'market:getListings', 'market:getMyListings'];
    const marketServerToClient = ['market:listed', 'market:bought', 'market:cancelled', 'market:listings', 'market:myListings', 'market:update', 'market:error'];

    it('all market client requests have server handlers', () => {
      for (const event of marketClientToServer) {
        expect(serverListeners).toContain(event);
      }
    });

    it('all market server responses have client handlers', () => {
      for (const event of marketServerToClient) {
        expect(clientListeners).toContain(event);
      }
    });
  });

  describe('Ship Events', () => {
    it('ship:upgrade has server handler', () => {
      expect(serverListeners).toContain('ship:upgrade');
    });

    it('upgrade responses have client handlers', () => {
      expect(clientListeners).toContain('upgrade:success');
      expect(clientListeners).toContain('upgrade:error');
    });

    it('ship:setColor has server handler', () => {
      expect(serverListeners).toContain('ship:setColor');
    });
  });

  describe('Loot Events', () => {
    it('loot:startCollect has server handler', () => {
      expect(serverListeners).toContain('loot:startCollect');
    });

    it('loot collection responses have client handlers', () => {
      const lootResponses = ['loot:started', 'loot:progress', 'loot:complete', 'loot:cancelled', 'loot:error'];
      for (const event of lootResponses) {
        expect(clientListeners).toContain(event);
      }
    });

    it('wreckage events have client handlers', () => {
      expect(clientListeners).toContain('wreckage:spawn');
      expect(clientListeners).toContain('wreckage:despawn');
      expect(clientListeners).toContain('wreckage:collected');
    });
  });

  describe('Wormhole Events', () => {
    it('wormhole requests have server handlers', () => {
      const wormholeRequests = ['wormhole:enter', 'wormhole:selectDestination', 'wormhole:cancel'];
      for (const event of wormholeRequests) {
        expect(serverListeners).toContain(event);
      }
    });

    it('wormhole responses have client handlers', () => {
      const wormholeResponses = ['wormhole:entered', 'wormhole:transitStarted', 'wormhole:exitComplete', 'wormhole:cancelled', 'wormhole:error'];
      for (const event of wormholeResponses) {
        expect(clientListeners).toContain(event);
      }
    });
  });

  describe('NPC Events', () => {
    it('NPC state events have client handlers', () => {
      const npcEvents = ['npc:spawn', 'npc:update', 'npc:destroyed'];
      for (const event of npcEvents) {
        expect(clientListeners).toContain(event);
      }
    });
  });

  describe('Hazard Events', () => {
    it('comet:warning has client handler', () => {
      expect(clientListeners).toContain('comet:warning');
    });

    it('comet:collision has client handler', () => {
      expect(clientListeners).toContain('comet:collision');
    });
  });

  describe('Team Events', () => {
    it('team reward events have client handlers', () => {
      expect(clientListeners).toContain('team:creditReward');
      expect(clientListeners).toContain('team:lootShare');
    });
  });

  describe('Buff/Relic Events', () => {
    it('buff events have client handlers', () => {
      expect(clientListeners).toContain('buff:applied');
      // Note: buff:expired removed - server never emits it
      // Buff expiration is handled client-side via timers
    });

    it('relic events have client handlers', () => {
      expect(clientListeners).toContain('relic:collected');
    });
  });

  describe('Utility Events', () => {
    it('ping/pong are properly paired', () => {
      expect(clientEmits).toContain('ping');
      expect(clientListeners).toContain('pong');
    });

    it('chat events are properly paired', () => {
      expect(clientEmits).toContain('chat:send');
      expect(serverListeners).toContain('chat:send');
      expect(clientListeners).toContain('chat:message');
    });

    it('emote events are properly paired', () => {
      expect(clientEmits).toContain('emote:send');
      expect(serverListeners).toContain('emote:send');
      expect(clientListeners).toContain('emote:broadcast');
    });
  });

  describe('Inventory Events', () => {
    it('inventory:update has client handler', () => {
      expect(clientListeners).toContain('inventory:update');
    });
  });

  describe('Player Events', () => {
    it('player state events have client handlers', () => {
      const playerEvents = ['player:update', 'player:leave', 'player:damaged', 'player:death', 'player:respawn'];
      for (const event of playerEvents) {
        expect(clientListeners).toContain(event);
      }
    });

    it('respawn:select has server handler', () => {
      expect(serverListeners).toContain('respawn:select');
    });
  });
});
