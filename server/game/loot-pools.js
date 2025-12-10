// Galaxy Miner - Loot Pool System
// Centralized loot generation with faction-first architecture

const CONSTANTS = require('../../shared/constants.js');
const logger = require('../../shared/logger');

// ============================================
// FACTION DEFINITIONS (resources, relics, buffs, components per faction)
// ============================================
const FACTION_LOOT = {
  pirate: {
    resources: {
      common:    ['IRON', 'CARBON', 'NICKEL'],
      uncommon:  ['COPPER', 'TITANIUM', 'HELIUM3'],
      rare:      ['PLATINUM', 'DARK_MATTER', 'QUANTUM_CRYSTALS'],
      ultrarare: ['EXOTIC_MATTER', 'ANTIMATTER']
    },
    relics: ['PIRATE_TREASURE'],
    buffs: ['SHIELD_BOOST', 'SPEED_BURST', 'DAMAGE_AMP'],
    components: ['ENGINE_CORE', 'WEAPON_MATRIX']
  },

  scavenger: {
    resources: {
      common:    ['IRON', 'NICKEL', 'SILICON'],
      uncommon:  ['COPPER', 'SILVER', 'COBALT', 'LITHIUM'],
      rare:      ['GOLD', 'PLATINUM', 'IRIDIUM'],
      ultrarare: ['EXOTIC_MATTER']
    },
    relics: ['PIRATE_TREASURE', 'ANCIENT_STAR_MAP', 'SCRAP_SIPHON'],
    buffs: ['SHIELD_BOOST', 'SPEED_BURST'],
    components: ['MINING_CAPACITOR', 'ENGINE_CORE']
  },

  swarm: {
    resources: {
      common:    ['CARBON', 'PHOSPHORUS', 'NITROGEN', 'HYDROGEN'],
      uncommon:  ['HELIUM3', 'SULFUR', 'ICE_CRYSTALS'],
      rare:      ['DARK_MATTER', 'QUANTUM_CRYSTALS'],
      ultrarare: ['EXOTIC_MATTER', 'ANTIMATTER', 'VOID_CRYSTALS']
    },
    relics: ['SWARM_HIVE_CORE'],
    buffs: ['SPEED_BURST', 'DAMAGE_AMP'],
    components: ['ENGINE_CORE', 'MINING_CAPACITOR']
  },

  void: {
    resources: {
      common:    [],  // Void entities never drop commons
      uncommon:  ['XENON', 'DARK_MATTER', 'NEON'],
      rare:      ['QUANTUM_CRYSTALS', 'EXOTIC_MATTER'],
      ultrarare: ['ANTIMATTER', 'NEUTRONIUM', 'VOID_CRYSTALS']
    },
    relics: ['VOID_CRYSTAL', 'WORMHOLE_GEM', 'ANCIENT_STAR_MAP'],
    buffs: ['DAMAGE_AMP', 'RADAR_PULSE'],
    components: ['WEAPON_MATRIX', 'SHIELD_CELL']
  },

  rogue_miner: {
    resources: {
      common:    ['IRON', 'COPPER', 'SILICON'],
      uncommon:  ['TITANIUM', 'COBALT', 'LITHIUM'],
      rare:      ['GOLD', 'URANIUM', 'IRIDIUM', 'PLATINUM'],
      ultrarare: ['EXOTIC_MATTER', 'QUANTUM_CRYSTALS']
    },
    relics: ['ANCIENT_STAR_MAP', 'PIRATE_TREASURE'],
    buffs: ['SHIELD_BOOST', 'RADAR_PULSE'],
    components: ['MINING_CAPACITOR', 'SHIELD_CELL']
  }
};

// ============================================
// TIER TEMPLATES (reusable drop profiles)
// ============================================
const TIER_TEMPLATES = {
  low: {
    slots: { guaranteed: 1, bonus: { count: 2, chance: 0.8 } },
    rarityWeights: {
      common:    { weight: 0.60, quantityRange: [2, 5] },
      uncommon:  { weight: 0.35, quantityRange: [1, 3] },
      rare:      { weight: 0.05, quantityRange: [1, 2] },
      ultrarare: { weight: 0.00, quantityRange: [1, 1] }
    },
    specialDrops: {
      buff:      { chance: 0.05 },
      component: { chance: 0.01 },
      relic:     null  // Never for low tier
    }
  },

  mid: {
    slots: { guaranteed: 2, bonus: { count: 2, chance: 0.85 } },
    rarityWeights: {
      common:    { weight: 0.40, quantityRange: [2, 6] },
      uncommon:  { weight: 0.45, quantityRange: [2, 4] },
      rare:      { weight: 0.14, quantityRange: [1, 3] },
      ultrarare: { weight: 0.01, quantityRange: [1, 1] }
    },
    specialDrops: {
      buff:      { chance: 0.15 },
      component: { chance: 0.05 },
      relic:     null
    }
  },

  high: {
    slots: { guaranteed: 2, bonus: { count: 3, chance: 0.9 } },
    rarityWeights: {
      common:    { weight: 0.20, quantityRange: [3, 6] },
      uncommon:  { weight: 0.45, quantityRange: [2, 5] },
      rare:      { weight: 0.30, quantityRange: [2, 4] },
      ultrarare: { weight: 0.05, quantityRange: [1, 2] }
    },
    specialDrops: {
      buff:      { chance: 0.25 },
      component: { chance: 0.10 },
      relic:     null
    }
  },

  boss: {
    slots: { guaranteed: 3, bonus: { count: 3, chance: 0.95 } },
    rarityWeights: {
      common:    { weight: 0.10, quantityRange: [3, 8] },
      uncommon:  { weight: 0.30, quantityRange: [3, 6] },
      rare:      { weight: 0.45, quantityRange: [2, 5] },
      ultrarare: { weight: 0.15, quantityRange: [1, 3] }
    },
    specialDrops: {
      buff:      { chance: 0.50 },
      component: { chance: 0.30 },
      relic:     { chance: 0.15 }  // Boss-exclusive
    }
  },

  base: {
    slots: { guaranteed: 2, bonus: { count: 2, chance: 0.7 } },
    rarityWeights: {
      common:    { weight: 0.05, quantityRange: [1, 2] },
      uncommon:  { weight: 0.15, quantityRange: [2, 4] },
      rare:      { weight: 0.60, quantityRange: [3, 8] },
      ultrarare: { weight: 0.20, quantityRange: [1, 3] }
    },
    specialDrops: {
      buff:      { chance: 0.40 },
      component: { chance: 0.50 },
      relic:     null  // Bases don't drop relics
    }
  }
};

// ============================================
// NPC LOOT MAPPING (minimal - just faction + tier)
// ============================================
const NPC_LOOT_MAPPING = {
  // Pirates
  pirate_scout:       { faction: 'pirate', tier: 'low' },
  pirate_fighter:     { faction: 'pirate', tier: 'mid' },
  pirate_captain:     { faction: 'pirate', tier: 'high' },
  pirate_dreadnought: { faction: 'pirate', tier: 'boss' },
  pirate_outpost:     { faction: 'pirate', tier: 'base' },

  // Scavengers
  scavenger_scrapper:  { faction: 'scavenger', tier: 'low' },
  scavenger_salvager:  { faction: 'scavenger', tier: 'low' },
  scavenger_collector: { faction: 'scavenger', tier: 'mid' },
  scavenger_hauler:    { faction: 'scavenger', tier: 'high' },  // NOT boss - they flee
  scavenger_barnacle_king: { faction: 'scavenger', tier: 'boss' },
  scavenger_yard:      { faction: 'scavenger', tier: 'base' },

  // Swarm
  swarm_drone:   { faction: 'swarm', tier: 'low' },
  swarm_worker:  { faction: 'swarm', tier: 'low' },
  swarm_warrior: { faction: 'swarm', tier: 'mid' },
  swarm_queen:   { faction: 'swarm', tier: 'boss' },
  swarm_hive:    { faction: 'swarm', tier: 'base' },

  // Void (no commons - faction definition handles this)
  void_whisper:   { faction: 'void', tier: 'low' },
  void_shadow:    { faction: 'void', tier: 'mid' },
  void_phantom:   { faction: 'void', tier: 'high' },
  void_leviathan: { faction: 'void', tier: 'boss' },
  void_rift:      { faction: 'void', tier: 'base' },

  // Rogue Miners
  rogue_prospector: { faction: 'rogue_miner', tier: 'low' },
  rogue_driller:    { faction: 'rogue_miner', tier: 'mid' },
  rogue_excavator:  { faction: 'rogue_miner', tier: 'high' },
  rogue_foreman:    { faction: 'rogue_miner', tier: 'boss' },
  mining_claim:     { faction: 'rogue_miner', tier: 'base' }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function randomInRange(range) {
  const [min, max] = range;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(array) {
  if (!array || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}

function weightedRarityPick(rarityWeights) {
  const roll = Math.random();
  let cumulative = 0;

  for (const [rarity, config] of Object.entries(rarityWeights)) {
    cumulative += config.weight;
    if (roll < cumulative) {
      return rarity;
    }
  }

  // Fallback to common if weights don't sum to 1
  return 'common';
}

function rollBonusSlots(bonusConfig) {
  let count = 0;
  for (let i = 0; i < bonusConfig.count; i++) {
    if (Math.random() < bonusConfig.chance) {
      count++;
    }
  }
  return count;
}

function getResourceRarity(resourceType) {
  const resource = CONSTANTS.RESOURCE_TYPES[resourceType];
  return resource ? resource.rarity : 'common';
}

// ============================================
// MAIN LOOT GENERATION FUNCTION
// ============================================

function generateLoot(npcType) {
  const mapping = NPC_LOOT_MAPPING[npcType];
  if (!mapping) {
    logger.warn(`No loot mapping found for NPC type: ${npcType}`);
    return [];
  }

  const faction = FACTION_LOOT[mapping.faction];
  const template = TIER_TEMPLATES[mapping.tier];

  if (!faction || !template) {
    logger.warn(`Invalid faction or tier for NPC type: ${npcType}`);
    return [];
  }

  const loot = new Map();  // Accumulates quantities, prevents duplicates
  const contents = [];

  // Roll for resources using template weights + faction resources
  const totalSlots = template.slots.guaranteed + rollBonusSlots(template.slots.bonus);

  for (let i = 0; i < totalSlots; i++) {
    const rarity = weightedRarityPick(template.rarityWeights);
    const resources = faction.resources[rarity];

    // Skip if faction has no resources at this rarity (e.g., void commons)
    if (!resources || resources.length === 0) continue;

    const resource = randomPick(resources);
    if (!resource) continue;

    const quantity = randomInRange(template.rarityWeights[rarity].quantityRange);

    // Accumulate into Map (deduplication!)
    loot.set(resource, (loot.get(resource) || 0) + quantity);
  }

  // Convert Map to array format with rarity info
  for (const [resourceType, quantity] of loot) {
    contents.push({
      type: 'resource',
      resourceType,
      quantity,
      rarity: getResourceRarity(resourceType)
    });
  }

  // Roll for special drops (buff, component, relic)
  if (template.specialDrops.buff && Math.random() < template.specialDrops.buff.chance) {
    const buffType = randomPick(faction.buffs);
    if (buffType) {
      contents.push({
        type: 'buff',
        buffType
      });
    }
  }

  if (template.specialDrops.component && Math.random() < template.specialDrops.component.chance) {
    const componentType = randomPick(faction.components);
    if (componentType) {
      contents.push({
        type: 'component',
        componentType
      });
    }
  }

  // Relics are boss-exclusive
  if (template.specialDrops.relic && Math.random() < template.specialDrops.relic.chance) {
    const relicType = randomPick(faction.relics);
    if (relicType) {
      contents.push({
        type: 'relic',
        relicType
      });
    }
  }

  // Guaranteed SCRAP_SIPHON drop for Barnacle King
  if (npcType === 'scavenger_barnacle_king') {
    contents.push({
      type: 'relic',
      relicType: 'SCRAP_SIPHON'
    });
  }

  return contents;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getMappingForNpc(npcType) {
  return NPC_LOOT_MAPPING[npcType] || null;
}

function getFactionLoot(factionName) {
  return FACTION_LOOT[factionName] || null;
}

function getTierTemplate(tierName) {
  return TIER_TEMPLATES[tierName] || null;
}

function isBossTier(npcType) {
  const mapping = NPC_LOOT_MAPPING[npcType];
  return mapping && mapping.tier === 'boss';
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  FACTION_LOOT,
  TIER_TEMPLATES,
  NPC_LOOT_MAPPING,
  generateLoot,
  getMappingForNpc,
  getFactionLoot,
  getTierTemplate,
  isBossTier,
  getResourceRarity
};
