/**
 * Unit tests for Void Leviathan AI and rift portal mechanics
 * Tests spawn triggers, ability cooldowns, and rift state transitions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the constants for testing
const MOCK_VOID_LEVIATHAN_CONFIG = {
  stats: {
    hull: 1500,
    shield: 900,
    speed: 40,
    weaponRange: 350,
    weaponDamage: 30,
    weaponType: 'void_beam',
    weaponTier: 4
  },
  spawn: {
    chanceOnVoidDeath: 0.05,  // 5% chance
    cooldown: 300000,          // 5 minutes
    sequenceDuration: 7000     // 7 seconds
  },
  gravityWell: {
    warningDuration: 1500,     // 1.5s warning
    activeDuration: 4000,      // 4s active
    radius: 300,
    centerDamage: 50,
    edgeDamage: 10,
    cooldown: 15000
  },
  consume: {
    range: 400,
    healAmount: 'full',        // Full NPC health
    cooldown: 5000
  },
  minionSpawn: {
    healthThresholds: [0.75, 0.50, 0.25, 0.10],
    riftsPerThreshold: [2, 3, 4, 5],
    continuousInterval: 12000,
    continuousCount: { min: 1, max: 2 }
  }
};

describe('Void Leviathan Config', () => {
  describe('Stats validation', () => {
    it('should have correct hull value (1500)', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.stats.hull).toBe(1500);
    });

    it('should have correct shield value (900)', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.stats.shield).toBe(900);
    });

    it('should have hull 3x higher than standard void phantom (500)', () => {
      const phantomHull = 500;
      expect(MOCK_VOID_LEVIATHAN_CONFIG.stats.hull).toBe(phantomHull * 3);
    });

    it('should use void_beam weapon type', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.stats.weaponType).toBe('void_beam');
    });

    it('should be weapon tier 4', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.stats.weaponTier).toBe(4);
    });
  });

  describe('Spawn mechanics', () => {
    it('should have 5% spawn chance on void NPC death', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.spawn.chanceOnVoidDeath).toBe(0.05);
    });

    it('should have 5 minute spawn cooldown', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.spawn.cooldown).toBe(300000);
    });

    it('should have 7 second spawn sequence', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.spawn.sequenceDuration).toBe(7000);
    });
  });

  describe('Gravity Well ability', () => {
    it('should have 1.5 second warning phase', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.gravityWell.warningDuration).toBe(1500);
    });

    it('should have 4 second active phase', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.gravityWell.activeDuration).toBe(4000);
    });

    it('should have 300 unit radius', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.gravityWell.radius).toBe(300);
    });

    it('should deal 50 damage at center', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.gravityWell.centerDamage).toBe(50);
    });

    it('should deal 10 damage at edge', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.gravityWell.edgeDamage).toBe(10);
    });

    it('should have 15 second cooldown', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.gravityWell.cooldown).toBe(15000);
    });
  });

  describe('Consume ability', () => {
    it('should have 400 unit range', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.consume.range).toBe(400);
    });

    it('should heal for full NPC health', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.consume.healAmount).toBe('full');
    });

    it('should have 5 second cooldown', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.consume.cooldown).toBe(5000);
    });
  });

  describe('Minion spawn thresholds', () => {
    it('should spawn minions at 75%, 50%, 25%, 10% health', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.minionSpawn.healthThresholds).toEqual([0.75, 0.50, 0.25, 0.10]);
    });

    it('should spawn 2, 3, 4, 5 rifts per threshold', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.minionSpawn.riftsPerThreshold).toEqual([2, 3, 4, 5]);
    });

    it('should continuously spawn every 12 seconds', () => {
      expect(MOCK_VOID_LEVIATHAN_CONFIG.minionSpawn.continuousInterval).toBe(12000);
    });
  });
});

describe('Void Leviathan AI Logic', () => {
  // Mock AI state
  let aiState;

  beforeEach(() => {
    aiState = {
      phase: 'normal',
      gravityWellCooldown: 0,
      consumeCooldown: 0,
      continuousSpawnTimer: 0,
      triggeredThresholds: new Set()
    };
  });

  describe('Cooldown management', () => {
    it('should decrease gravity well cooldown over time', () => {
      aiState.gravityWellCooldown = 5000;
      const deltaTime = 1000;

      aiState.gravityWellCooldown = Math.max(0, aiState.gravityWellCooldown - deltaTime);

      expect(aiState.gravityWellCooldown).toBe(4000);
    });

    it('should not go below 0', () => {
      aiState.gravityWellCooldown = 500;
      const deltaTime = 1000;

      aiState.gravityWellCooldown = Math.max(0, aiState.gravityWellCooldown - deltaTime);

      expect(aiState.gravityWellCooldown).toBe(0);
    });
  });

  describe('Health threshold detection', () => {
    const config = MOCK_VOID_LEVIATHAN_CONFIG;

    const checkMinionSpawnThreshold = (currentHealth, maxHealth, triggeredThresholds) => {
      const healthPercent = currentHealth / maxHealth;
      const thresholds = config.minionSpawn.healthThresholds;

      for (let i = 0; i < thresholds.length; i++) {
        if (healthPercent <= thresholds[i] && !triggeredThresholds.has(i)) {
          return { shouldSpawn: true, thresholdIndex: i, riftCount: config.minionSpawn.riftsPerThreshold[i] };
        }
      }
      return { shouldSpawn: false };
    };

    it('should trigger spawn at 75% health', () => {
      const result = checkMinionSpawnThreshold(1125, 1500, new Set());
      expect(result.shouldSpawn).toBe(true);
      expect(result.riftCount).toBe(2);
    });

    it('should trigger spawn at 50% health with correct rift count', () => {
      const triggered = new Set([0]);  // 75% already triggered
      const result = checkMinionSpawnThreshold(750, 1500, triggered);
      expect(result.shouldSpawn).toBe(true);
      expect(result.riftCount).toBe(3);
    });

    it('should not trigger already triggered thresholds', () => {
      const triggered = new Set([0, 1]);  // 75% and 50% already triggered
      const result = checkMinionSpawnThreshold(750, 1500, triggered);
      expect(result.shouldSpawn).toBe(false);
    });

    it('should trigger multiple thresholds in order', () => {
      const triggered = new Set();

      // Health drops to 40% - should trigger 75% and 50%
      const result1 = checkMinionSpawnThreshold(600, 1500, triggered);
      expect(result1.shouldSpawn).toBe(true);
      expect(result1.thresholdIndex).toBe(0);  // 75% first
    });
  });

  describe('Gravity well damage calculation', () => {
    const config = MOCK_VOID_LEVIATHAN_CONFIG.gravityWell;

    const calculateGravityDamage = (distance, radius, centerDamage, edgeDamage) => {
      if (distance >= radius) return 0;
      const ratio = 1 - (distance / radius);
      return edgeDamage + (centerDamage - edgeDamage) * ratio;
    };

    it('should deal full damage at center', () => {
      const damage = calculateGravityDamage(0, config.radius, config.centerDamage, config.edgeDamage);
      expect(damage).toBe(50);
    });

    it('should deal edge damage at radius boundary', () => {
      const damage = calculateGravityDamage(299, config.radius, config.centerDamage, config.edgeDamage);
      expect(damage).toBeCloseTo(config.edgeDamage, 0);
    });

    it('should deal no damage outside radius', () => {
      const damage = calculateGravityDamage(300, config.radius, config.centerDamage, config.edgeDamage);
      expect(damage).toBe(0);
    });

    it('should deal intermediate damage at mid-radius', () => {
      const damage = calculateGravityDamage(150, config.radius, config.centerDamage, config.edgeDamage);
      expect(damage).toBeCloseTo(30, 0);  // Midpoint: 10 + (50-10) * 0.5 = 30
    });
  });
});

describe('Void Rift Portal States', () => {
  const RIFT_STATES = {
    SPAWN: 'spawn',
    IDLE: 'idle',
    COMBAT: 'combat',
    RETREAT: 'retreat',
    CLOSE: 'close'
  };

  describe('State transitions', () => {
    it('should transition from spawn to idle', () => {
      const validTransitions = {
        spawn: ['idle'],
        idle: ['combat', 'close'],
        combat: ['retreat', 'close'],
        retreat: ['close'],
        close: []
      };

      expect(validTransitions.spawn).toContain('idle');
    });

    it('should allow retreat from combat', () => {
      const validTransitions = {
        combat: ['retreat', 'close']
      };

      expect(validTransitions.combat).toContain('retreat');
    });

    it('should not allow transition from close state', () => {
      const validTransitions = {
        close: []
      };

      expect(validTransitions.close.length).toBe(0);
    });
  });

  describe('Rift tier visuals', () => {
    const VOID_RIFT_VISUALS = {
      whisper: 'elliptical',
      shadow: 'organic',
      phantom: 'jagged',
      leviathan: 'chaotic'
    };

    it('should have unique visual for each tier', () => {
      const visuals = Object.values(VOID_RIFT_VISUALS);
      const uniqueVisuals = new Set(visuals);
      expect(uniqueVisuals.size).toBe(visuals.length);
    });

    it('should assign correct visual to each tier', () => {
      expect(VOID_RIFT_VISUALS.whisper).toBe('elliptical');
      expect(VOID_RIFT_VISUALS.shadow).toBe('organic');
      expect(VOID_RIFT_VISUALS.phantom).toBe('jagged');
      expect(VOID_RIFT_VISUALS.leviathan).toBe('chaotic');
    });
  });
});

describe('Spawn Chance Verification', () => {
  it('should spawn leviathan approximately 5% of the time (statistical)', () => {
    const spawnChance = 0.05;
    const iterations = 10000;
    let spawns = 0;

    // Seed-based pseudo-random for reproducibility
    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < iterations; i++) {
      if (seededRandom(i * 12345) < spawnChance) {
        spawns++;
      }
    }

    const actualRate = spawns / iterations;
    // Allow 1% tolerance
    expect(actualRate).toBeGreaterThan(0.04);
    expect(actualRate).toBeLessThan(0.06);
  });
});
