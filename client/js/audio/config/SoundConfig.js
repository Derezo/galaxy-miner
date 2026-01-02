// Galaxy Miner - Sound Configuration
// Defines all game sounds with their properties
// Updated to match actual generated audio files

const SoundConfig = {
  // ============================================
  // PLAYER WEAPONS (Tiered)
  // ============================================
  weapon_fire_1: {
    file: "weapons/weapon_player_t1.mp3",
    baseVolume: 0.7,
    priority: 75,
    category: "sfx",
    variations: 1,
  },
  weapon_fire_2: {
    file: "weapons/weapon_player_t2.mp3",
    baseVolume: 0.7,
    priority: 75,
    category: "sfx",
    variations: 1,
  },
  weapon_fire_3: {
    file: "weapons/weapon_player_t3.mp3",
    baseVolume: 0.75,
    priority: 75,
    category: "sfx",
    variations: 1,
  },
  weapon_fire_4: {
    file: "weapons/weapon_player_t4.mp3",
    baseVolume: 0.8,
    priority: 75,
    category: "sfx",
    variations: 1,
  },
  weapon_fire_5: {
    file: "weapons/weapon_player_t5.mp3",
    baseVolume: 0.85,
    priority: 75,
    category: "sfx",
    variations: 1,
  },

  // ============================================
  // NPC WEAPONS (Faction-specific)
  // ============================================
  npc_weapon_pirate: {
    file: "weapons/weapon_npc_pirate.mp3",
    baseVolume: 0.6,
    priority: 50,
    category: "sfx",
    variations: 1,
  },
  npc_weapon_scavenger: {
    file: "weapons/weapon_npc_scavenger.mp3",
    baseVolume: 0.5,
    priority: 50,
    category: "sfx",
    variations: 1,
  },
  npc_weapon_swarm: {
    file: "weapons/weapon_npc_swarm.mp3",
    baseVolume: 0.55,
    priority: 50,
    category: "sfx",
    variations: 1,
  },
  npc_weapon_void: {
    file: "weapons/weapon_npc_void.mp3",
    baseVolume: 0.65,
    priority: 50,
    category: "sfx",
    variations: 1,
  },
  npc_weapon_rogue: {
    file: "weapons/weapon_npc_miner.mp3",
    baseVolume: 0.6,
    priority: 50,
    category: "sfx",
    variations: 1,
  },
  // Alias for rogue_miner faction (faction name uses underscore)
  npc_weapon_rogue_miner: {
    file: "weapons/weapon_npc_miner.mp3",
    baseVolume: 0.6,
    priority: 50,
    category: "sfx",
    variations: 1,
  },

  // ============================================
  // IMPACTS - Shield Hits (Tiered)
  // ============================================
  hit_shield_1: {
    file: "impacts/hit_shield_t1.mp3",
    baseVolume: 0.8,
    priority: 75,
    category: "sfx",
    variations: 1,
  },
  hit_shield_2: {
    file: "impacts/hit_shield_t2.mp3",
    baseVolume: 0.8,
    priority: 75,
    category: "sfx",
    variations: 1,
  },
  hit_shield_3: {
    file: "impacts/hit_shield_t3.mp3",
    baseVolume: 0.8,
    priority: 75,
    category: "sfx",
    variations: 1,
  },
  hit_shield_4: {
    file: "impacts/hit_shield_t4.mp3",
    baseVolume: 0.8,
    priority: 75,
    category: "sfx",
    variations: 1,
  },
  hit_shield_5: {
    file: "impacts/hit_shield_t5.mp3",
    baseVolume: 0.8,
    priority: 75,
    category: "sfx",
    variations: 1,
  },

  // ============================================
  // IMPACTS - Hull Hits (Tiered)
  // ============================================
  hit_hull_1: {
    file: "impacts/hit_hull_t1.mp3",
    baseVolume: 0.8,
    priority: 75,
    category: "sfx",
    variations: 1,
  },
  hit_hull_2: {
    file: "impacts/hit_hull_t2.mp3",
    baseVolume: 0.8,
    priority: 75,
    category: "sfx",
    variations: 1,
  },
  hit_hull_3: {
    file: "impacts/hit_hull_t3.mp3",
    baseVolume: 0.8,
    priority: 75,
    category: "sfx",
    variations: 1,
  },
  hit_hull_4: {
    file: "impacts/hit_hull_t4.mp3",
    baseVolume: 0.8,
    priority: 75,
    category: "sfx",
    variations: 1,
  },
  hit_hull_5: {
    file: "impacts/hit_hull_t5.mp3",
    baseVolume: 0.8,
    priority: 75,
    category: "sfx",
    variations: 1,
  },

  // ============================================
  // DESTRUCTION - Player Death
  // ============================================
  death_player: {
    file: "destruction/death_player.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },

  // ============================================
  // DESTRUCTION - NPC Deaths (Faction-specific)
  // ============================================
  death_pirate: {
    file: "destruction/death_pirate_medium.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },
  death_pirate_small: {
    file: "destruction/death_pirate_small.mp3",
    baseVolume: 0.85,
    priority: 100,
    category: "sfx",
  },
  death_pirate_large: {
    file: "destruction/death_pirate_large.mp3",
    baseVolume: 0.95,
    priority: 100,
    category: "sfx",
  },
  death_scavenger: {
    file: "destruction/death_scavenger_medium.mp3",
    baseVolume: 0.85,
    priority: 100,
    category: "sfx",
  },
  death_scavenger_small: {
    file: "destruction/death_scavenger_small.mp3",
    baseVolume: 0.8,
    priority: 100,
    category: "sfx",
  },
  death_scavenger_large: {
    file: "destruction/death_scavenger_large.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },
  death_swarm: {
    file: "destruction/death_swarm_medium.mp3",
    baseVolume: 0.8,
    priority: 100,
    category: "sfx",
  },
  death_swarm_small: {
    file: "destruction/death_swarm_small.mp3",
    baseVolume: 0.75,
    priority: 100,
    category: "sfx",
  },
  death_swarm_large: {
    file: "destruction/death_swarm_large.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },
  death_void: {
    file: "destruction/death_void_medium.mp3",
    baseVolume: 0.95,
    priority: 100,
    category: "sfx",
  },
  death_void_small: {
    file: "destruction/death_void_small.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },
  death_void_large: {
    file: "destruction/death_void_large.mp3",
    baseVolume: 1.0,
    priority: 100,
    category: "sfx",
  },
  death_rogue: {
    file: "destruction/death_rogue_miner_medium.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },
  death_rogue_small: {
    file: "destruction/death_rogue_miner_small.mp3",
    baseVolume: 0.85,
    priority: 100,
    category: "sfx",
  },
  death_rogue_large: {
    file: "destruction/death_rogue_miner_large.mp3",
    baseVolume: 0.95,
    priority: 100,
    category: "sfx",
  },
  // Alias for rogue_miner faction (faction name uses underscore)
  death_rogue_miner: {
    file: "destruction/death_rogue_miner_medium.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },

  // ============================================
  // DESTRUCTION - Faction Bases (8-second sequences)
  // ============================================
  base_destruction: {
    file: "destruction/death_pirate_large.mp3",
    baseVolume: 1.0,
    priority: 100,
    category: "sfx",
  },
  // Faction-specific base destruction sounds
  base_destruction_pirate: {
    file: "destruction/base_pirate.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },
  base_destruction_scavenger: {
    file: "destruction/base_scavenger.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },
  base_destruction_swarm: {
    file: "destruction/base_swarm.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },
  base_destruction_void: {
    file: "destruction/base_void.mp3",
    baseVolume: 0.95,
    priority: 100,
    category: "sfx",
  },
  base_destruction_mining: {
    file: "destruction/base_mining.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },

  // ============================================
  // BOSSES - Queen Swarm
  // ============================================
  queen_phase_1: {
    file: "bosses/queen_phase_1.mp3",
    baseVolume: 1.0,
    priority: 100,
    category: "sfx",
  },
  queen_phase_2: {
    file: "bosses/queen_phase_2.mp3",
    baseVolume: 1.0,
    priority: 100,
    category: "sfx",
  },
  queen_phase_3: {
    file: "bosses/queen_phase_3.mp3",
    baseVolume: 1.0,
    priority: 100,
    category: "sfx",
  },
  queen_phase_4: {
    file: "bosses/queen_phase_4.mp3",
    baseVolume: 1.0,
    priority: 100,
    category: "sfx",
  },
  queen_web_snare: {
    file: "bosses/queen_web_snare.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },
  queen_acid_burst: {
    file: "bosses/queen_acid_burst.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },
  queen_roar: {
    file: "bosses/queen_roar.mp3",
    baseVolume: 1.0,
    priority: 100,
    category: "sfx",
  },
  queen_death: {
    file: "bosses/queen_death.mp3",
    baseVolume: 1.0,
    priority: 100,
    category: "sfx",
  },

  // ============================================
  // VOID LEVIATHAN BOSS
  // ============================================
  void_leviathan_spawn: {
    file: "bosses/void_leviathan_spawn.mp3",
    baseVolume: 1.0,
    priority: 100,
    category: "sfx",
  },
  void_leviathan_death: {
    file: "bosses/void_leviathan_death.mp3",
    baseVolume: 1.0,
    priority: 100,
    category: "sfx",
  },
  void_gravity_warning: {
    file: "bosses/void_gravity_warning.mp3",
    baseVolume: 0.9,
    priority: 95,
    category: "sfx",
  },
  void_gravity_active: {
    file: "bosses/void_gravity_active.mp3",
    baseVolume: 0.75,
    priority: 85,
    category: "ambient",
    loop: true,
  },
  void_consume: {
    file: "bosses/void_consume.mp3",
    baseVolume: 0.9,
    priority: 95,
    category: "sfx",
  },
  void_rift_open: {
    file: "environment/void_rift_open.mp3",
    baseVolume: 0.8,
    priority: 80,
    category: "sfx",
  },
  void_rift_close: {
    file: "environment/void_rift_close.mp3",
    baseVolume: 0.75,
    priority: 75,
    category: "sfx",
  },
  void_warp_transit: {
    file: "environment/void_warp_transit.mp3",
    baseVolume: 0.85,
    priority: 100,
    category: "sfx",
  },

  // ============================================
  // MINING
  // ============================================
  mining_drill_1: {
    file: "mining/drill_t1.mp3",
    baseVolume: 0.08,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  mining_drill_2: {
    file: "mining/drill_t2.mp3",
    baseVolume: 0.09,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  mining_drill_3: {
    file: "mining/drill_t3.mp3",
    baseVolume: 0.1,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  mining_drill_4: {
    file: "mining/drill_t4.mp3",
    baseVolume: 0.12,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  mining_drill_5: {
    file: "mining/drill_t5.mp3",
    baseVolume: 0.15,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  mining_complete: {
    file: "mining/mining_complete.mp3",
    baseVolume: 0.6,
    priority: 50,
    category: "sfx",
  },
  foreman_spawn: {
    file: "bosses/foreman_spawn.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },
  cargo_warning: {
    file: "mining/cargo_warning.mp3",
    baseVolume: 0.7,
    priority: 75,
    category: "ui",
  },

  // ============================================
  // LOOT
  // ============================================
  loot_common: {
    file: "loot/loot_common.mp3",
    baseVolume: 0.5,
    priority: 50,
    category: "sfx",
  },
  loot_uncommon: {
    file: "loot/loot_uncommon.mp3",
    baseVolume: 0.55,
    priority: 50,
    category: "sfx",
  },
  loot_rare: {
    file: "loot/loot_rare.mp3",
    baseVolume: 0.65,
    priority: 75,
    category: "sfx",
  },
  loot_ultrarare: {
    file: "loot/loot_ultrarare.mp3",
    baseVolume: 0.75,
    priority: 100,
    category: "sfx",
  },
  relic_acquired: {
    file: "ui/relic_acquired.mp3",
    baseVolume: 0.8,
    priority: 100,
    category: "sfx",
  },

  // ============================================
  // REWARDS - Popup Notification Sounds
  // ============================================
  // Credits
  reward_credits: {
    file: "rewards/credits.mp3",
    baseVolume: 0.6,
    priority: 50,
    category: "sfx",
  },
  reward_credits_large: {
    file: "rewards/credits_large.mp3",
    baseVolume: 0.7,
    priority: 75,
    category: "sfx",
  },
  // Resources by rarity
  reward_common: {
    file: "rewards/loot_common.mp3",
    baseVolume: 0.5,
    priority: 40,
    category: "sfx",
  },
  reward_uncommon: {
    file: "rewards/loot_uncommon.mp3",
    baseVolume: 0.55,
    priority: 45,
    category: "sfx",
  },
  reward_rare: {
    file: "rewards/loot_rare.mp3",
    baseVolume: 0.65,
    priority: 60,
    category: "sfx",
  },
  reward_ultrarare: {
    file: "rewards/loot_ultrarare.mp3",
    baseVolume: 0.75,
    priority: 80,
    category: "sfx",
  },
  // Buffs
  reward_buff_shield: {
    file: "rewards/buff_shield.mp3",
    baseVolume: 0.6,
    priority: 60,
    category: "sfx",
  },
  reward_buff_speed: {
    file: "rewards/buff_speed.mp3",
    baseVolume: 0.6,
    priority: 60,
    category: "sfx",
  },
  reward_buff_damage: {
    file: "rewards/buff_damage.mp3",
    baseVolume: 0.6,
    priority: 60,
    category: "sfx",
  },
  reward_buff_radar: {
    file: "rewards/buff_radar.mp3",
    baseVolume: 0.6,
    priority: 60,
    category: "sfx",
  },
  // Components
  reward_component: {
    file: "rewards/component.mp3",
    baseVolume: 0.65,
    priority: 70,
    category: "sfx",
  },
  // Relics
  reward_relic_starmap: {
    file: "rewards/relic_starmap.mp3",
    baseVolume: 0.8,
    priority: 90,
    category: "sfx",
  },
  reward_relic_void: {
    file: "rewards/relic_void.mp3",
    baseVolume: 0.8,
    priority: 90,
    category: "sfx",
  },
  reward_relic_swarm: {
    file: "rewards/relic_swarm.mp3",
    baseVolume: 0.8,
    priority: 90,
    category: "sfx",
  },
  reward_relic_pirate: {
    file: "rewards/relic_pirate.mp3",
    baseVolume: 0.8,
    priority: 90,
    category: "sfx",
  },
  reward_relic_wormhole: {
    file: "rewards/relic_wormhole.mp3",
    baseVolume: 0.85,
    priority: 95,
    category: "sfx",
  },
  reward_relic_subspace: {
    file: "rewards/relic_subspace.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },

  // ============================================
  // MOVEMENT - Engine Sounds (Tiered)
  // ============================================
  engine_1: {
    file: "movement/engine_thrust_t1.mp3",
    baseVolume: 0.05,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  engine_2: {
    file: "movement/engine_thrust_t2.mp3",
    baseVolume: 0.06,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  engine_3: {
    file: "movement/engine_thrust_t3.mp3",
    baseVolume: 0.07,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  engine_4: {
    file: "movement/engine_thrust_t4.mp3",
    baseVolume: 0.08,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  engine_5: {
    file: "movement/engine_thrust_t5.mp3",
    baseVolume: 0.1,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  boost_activate: {
    file: "movement/boost_activation.mp3",
    baseVolume: 0.5,
    priority: 50,
    category: "sfx",
  },
  boost_sustain: {
    file: "movement/boost_sustain.mp3",
    baseVolume: 0.4,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  thrust_start: {
    file: "movement/thrust_start.mp3",
    baseVolume: 0.15,
    priority: 50,
    category: "sfx",
  },
  thrust_stop: {
    file: "movement/thrust_stop.mp3",
    baseVolume: 0.1,
    priority: 25,
    category: "sfx",
  },
  collision_impact: {
    file: "movement/collision_impact.mp3",
    baseVolume: 0.7,
    priority: 75,
    category: "sfx",
  },

  // ============================================
  // SHIELDS
  // ============================================
  shield_absorption: {
    file: "movement/shield_absorption.mp3",
    baseVolume: 0.6,
    priority: 75,
    category: "sfx",
  },
  shield_recharge: {
    file: "movement/shield_recharge.mp3",
    baseVolume: 0.5,
    priority: 50,
    category: "sfx",
  },

  // ============================================
  // ENVIRONMENT - Stars (Sized)
  // ============================================
  star_small: {
    file: "environment/star_proximity_small.mp3",
    baseVolume: 0.25,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  star_medium: {
    file: "environment/star_proximity_medium.mp3",
    baseVolume: 0.3,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  star_large: {
    file: "environment/star_proximity_large.mp3",
    baseVolume: 0.35,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  space_ambient: {
    file: "environment/space_ambient.mp3",
    baseVolume: 0.15,
    priority: 10,
    category: "ambient",
    loop: true,
  },
  engine_hum: {
    file: "environment/engine_hum.mp3",
    baseVolume: 0.2,
    priority: 10,
    category: "ambient",
    loop: true,
  },

  // ============================================
  // ENVIRONMENT - Wormholes
  // ============================================
  wormhole_ambient: {
    file: "environment/wormhole_ambient.mp3",
    baseVolume: 0.4,
    priority: 25,
    category: "ambient",
    loop: true,
  },
  wormhole_transit: {
    file: "environment/wormhole_transit.mp3",
    baseVolume: 0.8,
    priority: 100,
    category: "sfx",
  },
  wormhole_select: {
    file: "ui/ui_success.mp3",
    baseVolume: 0.6,
    priority: 75,
    category: "ui",
  },

  // ============================================
  // ENVIRONMENT - Comets & Hazards
  // ============================================
  comet_warning: {
    file: "environment/comet_warning.mp3",
    baseVolume: 0.7,
    priority: 100,
    category: "ui",
  },
  comet_collision: {
    file: "environment/comet_collision.mp3",
    baseVolume: 0.9,
    priority: 100,
    category: "sfx",
  },
  asteroid_crack: {
    file: "environment/asteroid_crack.mp3",
    baseVolume: 0.6,
    priority: 50,
    category: "sfx",
  },

  // ============================================
  // UI - Interface Sounds
  // ============================================
  ui_click: {
    file: "ui/ui_click.mp3",
    baseVolume: 0.5,
    priority: 50,
    category: "ui",
  },
  ui_hover: {
    file: "ui/ui_hover.mp3",
    baseVolume: 0.3,
    priority: 25,
    category: "ui",
  },
  ui_open_panel: {
    file: "ui/ui_panel_open.mp3",
    baseVolume: 0.5,
    priority: 50,
    category: "ui",
  },
  ui_close_panel: {
    file: "ui/ui_panel_close.mp3",
    baseVolume: 0.5,
    priority: 50,
    category: "ui",
  },
  ui_tab_switch: {
    file: "ui/ui_tab_switch.mp3",
    baseVolume: 0.4,
    priority: 25,
    category: "ui",
  },
  ui_slider_tick: {
    file: "ui/slider_tick.mp3",
    baseVolume: 0.3,
    priority: 25,
    category: "ui",
  },
  ui_toggle_on: {
    file: "ui/toggle_on.mp3",
    baseVolume: 0.4,
    priority: 50,
    category: "ui",
  },
  ui_toggle_off: {
    file: "ui/toggle_off.mp3",
    baseVolume: 0.4,
    priority: 50,
    category: "ui",
  },
  chat_receive: {
    file: "ui/chat_message.mp3",
    baseVolume: 0.5,
    priority: 50,
    category: "ui",
  },

  // ============================================
  // UI - Notifications
  // ============================================
  notification_success: {
    file: "ui/ui_success.mp3",
    baseVolume: 0.6,
    priority: 75,
    category: "ui",
  },
  notification_error: {
    file: "ui/ui_error.mp3",
    baseVolume: 0.6,
    priority: 75,
    category: "ui",
  },
  notification_warning: {
    file: "ui/ui_warning.mp3",
    baseVolume: 0.6,
    priority: 75,
    category: "ui",
  },
  notification_info: {
    file: "ui/ui_info.mp3",
    baseVolume: 0.5,
    priority: 50,
    category: "ui",
  },

  // ============================================
  // UI - Ship Management
  // ============================================
  upgrade_purchase: {
    file: "ui/ui_upgrade_purchase.mp3",
    baseVolume: 0.7,
    priority: 75,
    category: "ui",
  },

  // ============================================
  // UI - Marketplace
  // ============================================
  market_list: {
    file: "ui/market_list.mp3",
    baseVolume: 0.5,
    priority: 50,
    category: "ui",
  },
  market_buy: {
    file: "ui/market_buy.mp3",
    baseVolume: 0.6,
    priority: 50,
    category: "ui",
  },
  market_sell: {
    file: "ui/market_sell.mp3",
    baseVolume: 0.6,
    priority: 50,
    category: "ui",
  },
  market_cancel: {
    file: "ui/market_cancel.mp3",
    baseVolume: 0.4,
    priority: 25,
    category: "ui",
  },
};

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = SoundConfig;
}
