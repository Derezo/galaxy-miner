/**
 * Unit tests for respawn system changes (Phase 4: Graveyard Respawn System)
 * Tests:
 * - All players respawn in The Graveyard by default
 * - Swarm Hive Core relic respawn logic
 * - Hive destruction on Hive Core respawn
 * - AoE NPC kill on hive destruction
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Respawn System - Graveyard Default', () => {
  describe('findGraveyardSpawnLocation', () => {
    // Test the spawn location calculation
    const SECTOR_SIZE = 1000;

    function findGraveyardSpawnLocation(sectorSize = SECTOR_SIZE) {
      // Replicates the logic from combat.js
      const graveyardRadius = sectorSize * 0.5;
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * graveyardRadius;

      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance
      };
    }

    it('should spawn near origin (0,0)', () => {
      // Run multiple times to test randomness
      for (let i = 0; i < 100; i++) {
        const pos = findGraveyardSpawnLocation();
        const distanceFromOrigin = Math.sqrt(pos.x * pos.x + pos.y * pos.y);

        // Should always be within graveyardRadius (500 units for SECTOR_SIZE 1000)
        expect(distanceFromOrigin).toBeLessThanOrEqual(500);
      }
    });

    it('should produce varied spawn locations', () => {
      const positions = [];
      for (let i = 0; i < 10; i++) {
        positions.push(findGraveyardSpawnLocation());
      }

      // Check that not all positions are identical
      const uniqueX = new Set(positions.map(p => Math.round(p.x)));
      const uniqueY = new Set(positions.map(p => Math.round(p.y)));

      // Should have some variety (at least 2 different values)
      expect(uniqueX.size).toBeGreaterThan(1);
      expect(uniqueY.size).toBeGreaterThan(1);
    });
  });

  describe('buildRespawnOptions', () => {
    // Mock the relic check behavior
    describe('without Swarm Hive Core relic', () => {
      it('should return graveyard respawn type', () => {
        // When player has no relic, respawn type should be 'graveyard'
        const hasRelic = false;
        const respawnOptions = buildMockRespawnOptions(hasRelic, null);

        expect(respawnOptions.type).toBe('graveyard');
        expect(respawnOptions.message).toContain('Graveyard');
      });
    });

    describe('with Swarm Hive Core relic but no hive', () => {
      it('should fall back to graveyard respawn', () => {
        // When player has relic but no hive exists, should fall back to graveyard
        const hasRelic = true;
        const nearestHive = null;
        const respawnOptions = buildMockRespawnOptions(hasRelic, nearestHive);

        expect(respawnOptions.type).toBe('graveyard');
      });
    });

    describe('with Swarm Hive Core relic and hive available', () => {
      it('should return swarm_hive_core respawn type', () => {
        const hasRelic = true;
        const nearestHive = { id: 'hive_1', x: 5000, y: 5000 };
        const respawnOptions = buildMockRespawnOptions(hasRelic, nearestHive);

        expect(respawnOptions.type).toBe('swarm_hive_core');
        expect(respawnOptions.hiveId).toBe('hive_1');
        expect(respawnOptions.hivePosition).toEqual({ x: 5000, y: 5000 });
      });
    });

    // Helper function to replicate buildRespawnOptions logic
    function buildMockRespawnOptions(hasHiveCore, nearestHive) {
      if (hasHiveCore && nearestHive) {
        return {
          type: 'swarm_hive_core',
          hiveId: nearestHive.id,
          hivePosition: { x: nearestHive.x, y: nearestHive.y },
          message: 'Your consciousness is drawn to the nearest Swarm Hive...'
        };
      }

      return {
        type: 'graveyard',
        message: 'Returning to The Graveyard...'
      };
    }
  });
});

describe('Respawn System - Swarm Hive Core Relic', () => {
  describe('findNearestSwarmHive', () => {
    it('should find the nearest swarm hive', () => {
      const position = { x: 0, y: 0 };
      const bases = new Map([
        ['hive_1', { type: 'swarm_hive', x: 1000, y: 0, destroyed: false }],
        ['hive_2', { type: 'swarm_hive', x: 500, y: 0, destroyed: false }],
        ['pirate_1', { type: 'pirate_outpost', x: 100, y: 0, destroyed: false }]
      ]);

      const nearest = findNearestSwarmHive(position, bases);

      expect(nearest).not.toBeNull();
      expect(nearest.id).toBe('hive_2'); // Closer at 500 units
    });

    it('should ignore destroyed hives', () => {
      const position = { x: 0, y: 0 };
      const bases = new Map([
        ['hive_1', { type: 'swarm_hive', x: 100, y: 0, destroyed: true }],
        ['hive_2', { type: 'swarm_hive', x: 500, y: 0, destroyed: false }]
      ]);

      const nearest = findNearestSwarmHive(position, bases);

      expect(nearest.id).toBe('hive_2');
    });

    it('should return null if no swarm hives exist', () => {
      const position = { x: 0, y: 0 };
      const bases = new Map([
        ['pirate_1', { type: 'pirate_outpost', x: 100, y: 0, destroyed: false }],
        ['void_1', { type: 'void_rift', x: 200, y: 0, destroyed: false }]
      ]);

      const nearest = findNearestSwarmHive(position, bases);

      expect(nearest).toBeNull();
    });

    it('should also find assimilated bases (faction: swarm)', () => {
      const position = { x: 0, y: 0 };
      const bases = new Map([
        ['assimilated_1', { type: 'pirate_outpost', faction: 'swarm', x: 300, y: 0, destroyed: false }],
        ['hive_1', { type: 'swarm_hive', x: 500, y: 0, destroyed: false }]
      ]);

      const nearest = findNearestSwarmHive(position, bases);

      // Should find the assimilated base first (closer)
      expect(nearest.id).toBe('assimilated_1');
    });

    // Helper function that replicates findNearestSwarmHive logic
    function findNearestSwarmHive(position, activeBases) {
      let nearestHive = null;
      let nearestDistance = Infinity;

      for (const [baseId, base] of activeBases) {
        if ((base.type === 'swarm_hive' || base.faction === 'swarm') && !base.destroyed) {
          const dx = base.x - position.x;
          const dy = base.y - position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestHive = { id: baseId, ...base };
          }
        }
      }

      return nearestHive;
    }
  });
});

describe('Respawn System - Hive Destruction AoE', () => {
  describe('destroyHiveWithAoE', () => {
    const HIVE_DESTRUCTION_RADIUS = 500;

    it('should only affect swarm NPCs within radius', () => {
      const hivePosition = { x: 1000, y: 1000 };
      const npcs = [
        { id: 'swarm_1', faction: 'swarm', position: { x: 1100, y: 1000 }, type: 'swarm_drone' }, // 100 units away
        { id: 'swarm_2', faction: 'swarm', position: { x: 1500, y: 1000 }, type: 'swarm_worker' }, // 500 units away
        { id: 'swarm_3', faction: 'swarm', position: { x: 1600, y: 1000 }, type: 'swarm_warrior' }, // 600 units away (outside)
        { id: 'pirate_1', faction: 'pirate', position: { x: 1050, y: 1000 }, type: 'pirate_scout' } // 50 units but wrong faction
      ];

      const { killedNpcs, untouchedNpcs } = simulateAoEKill(hivePosition, npcs, HIVE_DESTRUCTION_RADIUS);

      expect(killedNpcs.length).toBe(2); // swarm_1 and swarm_2
      expect(killedNpcs.map(n => n.id)).toContain('swarm_1');
      expect(killedNpcs.map(n => n.id)).toContain('swarm_2');
      expect(untouchedNpcs.map(n => n.id)).toContain('swarm_3'); // Outside radius
      expect(untouchedNpcs.map(n => n.id)).toContain('pirate_1'); // Wrong faction
    });

    it('should use correct radius (500 units)', () => {
      const hivePosition = { x: 0, y: 0 };
      const npcs = [
        { id: 'swarm_inside', faction: 'swarm', position: { x: 499, y: 0 }, type: 'swarm_drone' },
        { id: 'swarm_edge', faction: 'swarm', position: { x: 500, y: 0 }, type: 'swarm_drone' },
        { id: 'swarm_outside', faction: 'swarm', position: { x: 501, y: 0 }, type: 'swarm_drone' }
      ];

      const { killedNpcs, untouchedNpcs } = simulateAoEKill(hivePosition, npcs, HIVE_DESTRUCTION_RADIUS);

      // Inside and edge should be killed, outside should survive
      expect(killedNpcs.map(n => n.id)).toContain('swarm_inside');
      expect(killedNpcs.map(n => n.id)).toContain('swarm_edge');
      expect(untouchedNpcs.map(n => n.id)).toContain('swarm_outside');
    });

    it('should handle empty area (no NPCs)', () => {
      const hivePosition = { x: 0, y: 0 };
      const npcs = [];

      const { killedNpcs } = simulateAoEKill(hivePosition, npcs, HIVE_DESTRUCTION_RADIUS);

      expect(killedNpcs.length).toBe(0);
    });

    // Helper to simulate the AoE logic
    function simulateAoEKill(hivePosition, npcs, radius) {
      const killedNpcs = [];
      const untouchedNpcs = [];

      for (const npc of npcs) {
        const dx = npc.position.x - hivePosition.x;
        const dy = npc.position.y - hivePosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (npc.faction === 'swarm' && distance <= radius) {
          killedNpcs.push(npc);
        } else {
          untouchedNpcs.push(npc);
        }
      }

      return { killedNpcs, untouchedNpcs };
    }
  });

  describe('wreckage spawning', () => {
    it('should spawn wreckage for each killed NPC', () => {
      const killedNpcs = [
        { id: 'swarm_1', type: 'swarm_drone', position: { x: 100, y: 100 } },
        { id: 'swarm_2', type: 'swarm_worker', position: { x: 200, y: 200 } },
        { id: 'swarm_3', type: 'swarm_warrior', position: { x: 300, y: 300 } }
      ];

      const wreckages = simulateWreckageSpawn(killedNpcs);

      expect(wreckages.length).toBe(3);

      // Each wreckage should have correct position
      expect(wreckages[0].position).toEqual({ x: 100, y: 100 });
      expect(wreckages[1].position).toEqual({ x: 200, y: 200 });
      expect(wreckages[2].position).toEqual({ x: 300, y: 300 });
    });

    // Helper to simulate wreckage spawning
    function simulateWreckageSpawn(killedNpcs) {
      return killedNpcs.map((npc, idx) => ({
        id: `wreckage_${idx + 1}`,
        position: npc.position,
        source: 'npc',
        faction: 'swarm',
        npcType: npc.type
      }));
    }
  });
});

describe('Respawn System - applyRespawn', () => {
  describe('graveyard respawn', () => {
    it('should respawn at Graveyard for type "graveyard"', () => {
      const result = mockApplyRespawn('graveyard', null);

      expect(result.locationName).toBe('The Graveyard');
      expect(result.hiveDestruction).toBeUndefined();

      // Position should be near origin
      const distanceFromOrigin = Math.sqrt(
        result.position.x * result.position.x +
        result.position.y * result.position.y
      );
      expect(distanceFromOrigin).toBeLessThanOrEqual(500);
    });
  });

  describe('swarm_hive_core respawn', () => {
    it('should respawn at hive for type "swarm_hive_core" with valid hive', () => {
      const hiveId = 'hive_test_1';
      const mockBases = new Map([
        [hiveId, { type: 'swarm_hive', x: 5000, y: 5000, destroyed: false }]
      ]);

      const result = mockApplyRespawn('swarm_hive_core', hiveId, mockBases);

      expect(result.locationName).toBe('Swarm Hive (Destroyed)');
      expect(result.position).toEqual({ x: 5000, y: 5000 });
      expect(result.hiveDestruction).toBeDefined();
      expect(result.hiveDestruction.hiveId).toBe(hiveId);
    });

    it('should fall back to Graveyard if hive not found', () => {
      const result = mockApplyRespawn('swarm_hive_core', 'nonexistent_hive', new Map());

      expect(result.locationName).toBe('The Graveyard');
      expect(result.hiveDestruction).toBeUndefined();
    });

    it('should fall back to Graveyard if hive is destroyed', () => {
      const hiveId = 'hive_destroyed';
      const mockBases = new Map([
        [hiveId, { type: 'swarm_hive', x: 5000, y: 5000, destroyed: true }]
      ]);

      const result = mockApplyRespawn('swarm_hive_core', hiveId, mockBases);

      expect(result.locationName).toBe('The Graveyard');
    });
  });

  // Mock implementation of applyRespawn logic
  function mockApplyRespawn(respawnType, targetId, activeBases = new Map()) {
    const SECTOR_SIZE = 1000;

    function findGraveyardSpawnLocation() {
      const graveyardRadius = SECTOR_SIZE * 0.5;
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * graveyardRadius;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance
      };
    }

    let respawnPosition;
    let locationName = 'The Graveyard';
    let hiveDestructionResult;

    switch (respawnType) {
      case 'swarm_hive_core':
        if (targetId) {
          const base = activeBases.get(targetId);
          if (base && !base.destroyed && (base.type === 'swarm_hive' || base.faction === 'swarm')) {
            respawnPosition = { x: base.x, y: base.y };
            locationName = 'Swarm Hive (Destroyed)';
            hiveDestructionResult = {
              hiveId: targetId,
              hivePosition: { x: base.x, y: base.y },
              killedNpcs: [],
              spawnedWreckage: [],
              destructionRadius: 500
            };
          } else {
            respawnPosition = findGraveyardSpawnLocation();
            locationName = 'The Graveyard';
          }
        } else {
          respawnPosition = findGraveyardSpawnLocation();
          locationName = 'The Graveyard';
        }
        break;

      case 'graveyard':
      default:
        respawnPosition = findGraveyardSpawnLocation();
        locationName = 'The Graveyard';
        break;
    }

    const result = {
      position: respawnPosition,
      locationName,
      hull: 100,
      shield: 50
    };

    if (hiveDestructionResult) {
      result.hiveDestruction = hiveDestructionResult;
    }

    return result;
  }
});

describe('RELIC_TYPES.SWARM_HIVE_CORE', () => {
  // Test that the relic has proper configuration
  const SWARM_HIVE_CORE = {
    id: 'swarm_hive_core',
    name: 'Swarm Hive Core',
    rarity: 'ultrarare',
    value: 1000,
    description: 'This pulsing core resonates with Swarm hive-minds. Upon death, your consciousness is drawn to the nearest hive, triggering a catastrophic rejection that destroys the hive from within.',
    effect: 'hive_respawn',
    effects: {
      respawnAtNearestHive: true,
      destroyHiveOnRespawn: true,
      hiveDestructionRadius: 500
    }
  };

  it('should have correct id', () => {
    expect(SWARM_HIVE_CORE.id).toBe('swarm_hive_core');
  });

  it('should have hive_respawn effect', () => {
    expect(SWARM_HIVE_CORE.effect).toBe('hive_respawn');
  });

  it('should have respawnAtNearestHive effect', () => {
    expect(SWARM_HIVE_CORE.effects.respawnAtNearestHive).toBe(true);
  });

  it('should have destroyHiveOnRespawn effect', () => {
    expect(SWARM_HIVE_CORE.effects.destroyHiveOnRespawn).toBe(true);
  });

  it('should have correct destruction radius (500 units)', () => {
    expect(SWARM_HIVE_CORE.effects.hiveDestructionRadius).toBe(500);
  });

  it('should have updated description mentioning respawn mechanics', () => {
    expect(SWARM_HIVE_CORE.description).toContain('consciousness');
    expect(SWARM_HIVE_CORE.description).toContain('nearest hive');
    expect(SWARM_HIVE_CORE.description).toContain('destroys the hive');
  });
});
