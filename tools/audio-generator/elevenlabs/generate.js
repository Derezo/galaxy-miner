/**
 * ElevenLabs Sound Effects Generator for Galaxy Miner
 *
 * Usage:
 *   node generate.js                    # Generate all Tier 1 sounds
 *   node generate.js --tier 2           # Generate Tier 2 sounds
 *   node generate.js --category weapons # Generate specific category
 *   node generate.js --single weapon_t1 # Generate single sound
 *   node generate.js --list             # List all sounds
 *   node generate.js --force            # Regenerate even if files exist
 */

const fs = require("fs");
const path = require("path");

// API Configuration
const API_KEY = process.env.ELEVENLABS_API_KEY || "YOUR_API_KEY_HERE";
const API_URL = "https://api.elevenlabs.io/v1/sound-generation";

// Output directory (relative to project root)
const OUTPUT_BASE = path.join(__dirname, "../../../client/assets/audio");

// Delay between API calls (ms) to avoid rate limiting
const API_DELAY = 2000;

// ElevenLabs API constraints
const MIN_DURATION = 0.5; // API minimum
const MAX_DURATION = 22.0; // API maximum

/**
 * Sound definitions organized by tier and category
 * Each sound has: id, filename, duration (seconds), prompt
 *
 * Weapon Visual Reference:
 * - T1 Burst: Cyan laser, fast single shot
 * - T2 Dual: Cyan twin parallel laser bolts
 * - T3 Pulse: Green energy orb projectile with explosion
 * - T4 Beam: Orange continuous beam weapon
 * - T5 Tesla: Blue-cyan electrical arcs with chain lightning
 *
 * NPC Faction Weapon Visuals:
 * - Pirate: Fiery cannon projectile with trailing sparks
 * - Scavenger: Flickering unstable jury-rigged laser beam
 * - Swarm: Black core with crimson tendrils, void tears
 * - Void: Pulsing dark purple energy beam
 * - Rogue Miner: Industrial yellow mining laser beam
 */
const SOUNDS = {
  // ===================
  // TIER 1 - Essential
  // ===================

  weapons: {
    tier: 1,
    sounds: [
      // Player weapons - matched to visual types
      {
        id: "weapon_t1",
        filename: "weapon_player_t1.mp3",
        duration: 0.5,
        prompt:
          "Quick cyan laser blaster shot, clean electronic zap with bright energy pulse, short sci-fi pew sound, punchy and crisp",
      },
      {
        id: "weapon_t2",
        filename: "weapon_player_t2.mp3",
        duration: 0.5,
        prompt:
          "Twin cyan laser bolts firing in rapid succession, two quick electronic zaps one after another, dual blaster shot",
      },
      {
        id: "weapon_t3",
        filename: "weapon_player_t3.mp3",
        duration: 0.5,
        prompt:
          "Green energy pulse cannon firing, deep thump with rising plasma whoosh, heavy sci-fi projectile launch with bass impact",
      },
      {
        id: "weapon_t4",
        filename: "weapon_player_t4.mp3",
        duration: 0.6,
        prompt:
          "Orange energy beam weapon sustained fire, continuous laser hum with heat shimmer sound, intense focused power beam",
      },
      {
        id: "weapon_t5",
        filename: "weapon_player_t5.mp3",
        duration: 0.6,
        prompt:
          "Smooth electrical discharge with crackling arc lightning, buzzing electricity with lightning sparks, high voltage hum softly fading out",
      },
      // NPC weapons - faction specific visuals
      {
        id: "npc_pirate",
        filename: "weapon_npc_pirate.mp3",
        duration: 0.5,
        prompt:
          "Fiery cannon blast with trailing sparks, aggressive explosive shot with crackling fire trail, pirate ship weapon boom",
      },
      {
        id: "npc_scavenger",
        filename: "weapon_npc_scavenger.mp3",
        duration: 0.5,
        prompt:
          "Unstable flickering laser beam, malfunctioning energy weapon with sputtering electrical discharge, jury-rigged tech sound",
      },
      {
        id: "npc_swarm",
        filename: "weapon_npc_swarm.mp3",
        duration: 0.5,
        prompt:
          "Dark alien energy projectile with void tear effect, deep resonant pulse with organic undertones, crimson tendril whoosh",
      },
      {
        id: "npc_void",
        filename: "weapon_npc_void.mp3",
        duration: 0.5,
        prompt:
          "Ethereal dark purple energy beam, haunting otherworldly pulse with dimensional resonance, ghostly void attack",
      },
      {
        id: "npc_miner",
        filename: "weapon_npc_miner.mp3",
        duration: 0.5,
        prompt:
          "Industrial mining laser weapon fire, harsh yellow beam with mechanical grinding undertone, repurposed tool as weapon",
      },
    ],
  },

  impacts: {
    tier: 1,
    sounds: [
      // Shield impacts - electrical force field effects
      {
        id: "shield_t1",
        filename: "hit_shield_t1.mp3",
        duration: 0.5,
        prompt:
          "Light energy shield absorbing hit, soft electrical shimmer with gentle force field ripple, protective barrier deflection",
      },
      {
        id: "shield_t2",
        filename: "hit_shield_t2.mp3",
        duration: 0.5,
        prompt:
          "Energy shield blocking impact, electrical crackle with force field distortion pulse, defensive barrier sound",
      },
      {
        id: "shield_t3",
        filename: "hit_shield_t3.mp3",
        duration: 0.5,
        prompt:
          "Strong shield absorbing heavy hit, bright electrical discharge with resonant force field wave, powerful protection",
      },
      {
        id: "shield_t4",
        filename: "hit_shield_t4.mp3",
        duration: 0.5,
        prompt:
          "Powerful shield deflecting major attack, intense electrical storm with cascading force field waves, strong barrier",
      },
      {
        id: "shield_t5",
        filename: "hit_shield_t5.mp3",
        duration: 0.5,
        prompt:
          "Maximum shield absorbing devastating hit, violent electrical explosion with massive force field shockwave, overloaded barrier",
      },
      // Hull impacts - metallic damage sounds
      {
        id: "hull_t1",
        filename: "hit_hull_t1.mp3",
        duration: 0.5,
        prompt:
          "Light metal hull hit with sparks, small impact clang with minor debris scatter, ship taking glancing damage",
      },
      {
        id: "hull_t2",
        filename: "hit_hull_t2.mp3",
        duration: 0.5,
        prompt:
          "Medium hull damage impact, metallic clang with sparks flying and hull stress groan, direct hit sound",
      },
      {
        id: "hull_t3",
        filename: "hit_hull_t3.mp3",
        duration: 0.5,
        prompt:
          "Heavy hull penetration, harsh metal tearing with debris spray and alarm undertone, serious damage",
      },
      {
        id: "hull_t4",
        filename: "hit_hull_t4.mp3",
        duration: 0.5,
        prompt:
          "Severe hull breach impact, violent metal rupture with explosive decompression, critical damage alarm",
      },
      {
        id: "hull_t5",
        filename: "hit_hull_t5.mp3",
        duration: 0.5,
        prompt:
          "Catastrophic hull impact, devastating metal explosion with cascading system failures, near destruction",
      },
    ],
  },

  destruction: {
    tier: 1,
    sounds: [
      // Faction death sounds - matched to faction visual style
      {
        id: "death_pirate",
        filename: "death_pirate.mp3",
        duration: 0.8,
        prompt:
          "Pirate ship exploding, fiery metallic debris scatter with aggressive burst, flames and sparks flying",
      },
      {
        id: "death_scavenger",
        filename: "death_scavenger.mp3",
        duration: 0.8,
        prompt:
          "Scavenger vessel breaking apart, sputtering chain reaction as jerry-rigged components fail one by one",
      },
      {
        id: "death_swarm",
        filename: "death_swarm.mp3",
        duration: 1.0,
        prompt:
          "Alien swarm creature dying, organic squelch with wet dissolution, biological mass bursting and decomposing",
      },
      {
        id: "death_void",
        filename: "death_void.mp3",
        duration: 1.0,
        prompt:
          "Void entity imploding, inward dimensional collapse with ethereal wailing release, reality snapping back",
      },
      {
        id: "death_miner",
        filename: "death_miner.mp3",
        duration: 0.8,
        prompt:
          "Industrial mining ship explosion, heavy machinery breaking with metal grinding and fuel tank ignition",
      },
      {
        id: "death_player",
        filename: "death_player.mp3",
        duration: 1.5,
        prompt:
          "Dramatic player ship explosion, massive multi-layered blast with cascading secondary explosions, devastating defeat",
      },
    ],
  },

  mining: {
    tier: 1,
    sounds: [
      {
        id: "mining_complete",
        filename: "mining_complete.mp3",
        duration: 0.5,
        prompt:
          "Mining complete success chime, satisfying collection sound with resource acquisition confirmation, rewarding ding",
      },
      {
        id: "cargo_warning",
        filename: "cargo_warning.mp3",
        duration: 0.5,
        prompt:
          "Cargo hold nearly full warning alarm, urgent alert beep with capacity notification, attention needed",
      },
    ],
  },

  movement: {
    tier: 1,
    sounds: [
      // Only keeping boost sound - engine loops don't generate well
      {
        id: "boost_activate",
        filename: "boost_activation.mp3",
        duration: 0.5,
        prompt:
          "Spaceship afterburner activation, sudden thrust surge with power spike whoosh, acceleration burst",
      },
      {
        id: "collision_impact",
        filename: "collision_impact.mp3",
        duration: 0.5,
        prompt:
          "Ship collision impact, metallic crunch with hull stress thud, momentum transfer crash",
      },
    ],
  },

  ui: {
    tier: 1,
    sounds: [
      {
        id: "ui_click",
        filename: "ui_click.mp3",
        duration: 0.5,
        prompt:
          "Futuristic UI button click, soft electronic confirmation beep, clean and responsive sci-fi interface",
      },
      {
        id: "ui_hover",
        filename: "ui_hover.mp3",
        duration: 0.5,
        prompt:
          "Subtle UI hover sound, light electronic highlight tone, gentle interface feedback",
      },
      {
        id: "ui_panel_open",
        filename: "ui_panel_open.mp3",
        duration: 0.5,
        prompt:
          "Holographic panel materializing, sci-fi interface whoosh with digital expansion sweep",
      },
      {
        id: "ui_panel_close",
        filename: "ui_panel_close.mp3",
        duration: 0.5,
        prompt:
          "Holographic panel closing, interface collapse with digital contraction sweep",
      },
      {
        id: "ui_notification",
        filename: "ui_notification.mp3",
        duration: 0.5,
        prompt:
          "Important notification alert, attention-grabbing electronic chime, clear and distinct ping",
      },
      {
        id: "ui_error",
        filename: "ui_error.mp3",
        duration: 0.5,
        prompt:
          "Error notification sound, negative electronic buzz with rejection tone, something went wrong",
      },
    ],
  },

  // ===================
  // TIER 2 - Important
  // ===================

  bosses: {
    tier: 2,
    sounds: [
      // Swarm Queen - giant alien spider boss with organic sounds
      {
        id: "queen_phase1",
        filename: "queen_phase_1.mp3",
        duration: 1.5,
        prompt:
          "Giant alien spider queen awakening, rising organic drone with ominous chittering, massive creature stirring",
      },
      {
        id: "queen_phase2",
        filename: "queen_phase_2.mp3",
        duration: 1.5,
        prompt:
          "Alien spider boss powering up, intensifying organic growl with insectoid clicking, becoming aggressive",
      },
      {
        id: "queen_phase3",
        filename: "queen_phase_3.mp3",
        duration: 1.5,
        prompt:
          "Alien spider queen enraged, furious organic roar with violent chittering frenzy, very dangerous",
      },
      {
        id: "queen_phase4",
        filename: "queen_phase_4.mp3",
        duration: 2.0,
        prompt:
          "Alien spider queen at maximum power, overwhelming organic fury with reality-distorting presence, final form",
      },
      {
        id: "queen_web",
        filename: "queen_web_snare.mp3",
        duration: 0.6,
        prompt:
          "Sticky alien web attack launching, organic stretching sound with adhesive squelch, ensnaring projectile",
      },
      {
        id: "queen_acid",
        filename: "queen_acid_burst.mp3",
        duration: 0.5,
        prompt:
          "Corrosive acid spray attack, sizzling liquid burst with bubbling caustic splash, burning damage",
      },
      {
        id: "queen_roar",
        filename: "queen_roar.mp3",
        duration: 1.2,
        prompt:
          "Massive alien spider queen roar, deep menacing growl with tremolo vibration and insectoid undertones, terrifying",
      },
      {
        id: "queen_death",
        filename: "queen_death.mp3",
        duration: 7.5,
        prompt:
          "Epic alien spider boss death sequence, catastrophic multi-phase organic explosion, collapsing creature with massive debris scatter, triumphant victory",
      },
    ],
  },

  loot: {
    tier: 2,
    sounds: [
      {
        id: "loot_common",
        filename: "loot_common.mp3",
        duration: 0.5,
        prompt:
          "Common loot pickup, simple satisfying collection chime, basic reward sound",
      },
      {
        id: "loot_uncommon",
        filename: "loot_uncommon.mp3",
        duration: 0.5,
        prompt:
          "Uncommon loot pickup, slightly musical collection chime with sparkle, better reward",
      },
      {
        id: "loot_rare",
        filename: "loot_rare.mp3",
        duration: 0.5,
        prompt:
          "Rare loot pickup, exciting ascending chime with magical shimmer, valuable find",
      },
      {
        id: "loot_ultrarare",
        filename: "loot_ultrarare.mp3",
        duration: 0.6,
        prompt:
          "Ultra-rare loot pickup, epic triumphant fanfare with cosmic resonance, legendary discovery",
      },
    ],
  },

  environment: {
    tier: 2,
    sounds: [
      // One-shot environment sounds (not loops)
      {
        id: "wormhole_transit",
        filename: "wormhole_transit.mp3",
        duration: 6.0,
        prompt:
          "swirling doppler whoosh with dimensional shift, reality bending passage through space, increasing intensity and variance with deep humming growth",
      },
      {
        id: "comet_warning",
        filename: "comet_warning.mp3",
        duration: 1.5,
        prompt:
          "Approaching comet alert, whooshing approach sound with urgent warning beeps, incoming danger",
      },
      {
        id: "comet_collision",
        filename: "comet_collision.mp3",
        duration: 1.5,
        prompt:
          "Devastating comet impact, massive shockwave with debris explosion, catastrophic collision",
      },
      {
        id: "asteroid_crack",
        filename: "asteroid_crack.mp3",
        duration: 0.5,
        prompt:
          "Asteroid cracking and breaking apart, rock fracturing sound with debris scatter",
      },
    ],
  },

  ui_extended: {
    tier: 2,
    sounds: [
      {
        id: "ui_success",
        filename: "ui_success.mp3",
        duration: 0.5,
        prompt:
          "Success confirmation sound, positive electronic chime with achievement tone, something good happened",
      },
      {
        id: "ui_warning",
        filename: "ui_warning.mp3",
        duration: 0.5,
        prompt:
          "Warning notification sound, cautionary electronic tone, attention required but not critical",
      },
      {
        id: "ui_info",
        filename: "ui_info.mp3",
        duration: 0.5,
        prompt:
          "Information notification, neutral electronic ping, new data available",
      },
      {
        id: "ui_tab_switch",
        filename: "ui_tab_switch.mp3",
        duration: 0.5,
        prompt:
          "Interface tab switch, quick digital transition whoosh, smooth navigation",
      },
      {
        id: "ui_upgrade",
        filename: "ui_upgrade_purchase.mp3",
        duration: 0.6,
        prompt:
          "Ship upgrade purchased, powerful enhancement activation with system boost sound, getting stronger",
      },
      {
        id: "market_list",
        filename: "market_list.mp3",
        duration: 0.5,
        prompt:
          "Marketplace item listed, transaction initiated tone, selling something",
      },
      {
        id: "market_buy",
        filename: "market_buy.mp3",
        duration: 0.5,
        prompt:
          "Marketplace purchase complete, successful transaction chime with credits spent sound",
      },
      {
        id: "market_sell",
        filename: "market_sell.mp3",
        duration: 0.5,
        prompt:
          "Marketplace sale complete, credits received confirmation cha-ching, profitable exchange",
      },
      {
        id: "market_cancel",
        filename: "market_cancel.mp3",
        duration: 0.5,
        prompt:
          "Marketplace listing cancelled, transaction abort sound, nevermind tone",
      },
      {
        id: "chat_receive",
        filename: "chat_message.mp3",
        duration: 0.5,
        prompt:
          "Chat message received, soft communication ping, someone said something notification",
      },
    ],
  },

  // ===================
  // TIER 3 - Size Variants
  // ===================

  destruction_variants: {
    tier: 3,
    sounds: [
      // Pirate size variants - aggressive fiery explosions
      {
        id: "death_pirate_small",
        filename: "death_pirate_small.mp3",
        duration: 0.5,
        prompt:
          "Small pirate fighter exploding, quick fiery metallic burst with spark scatter",
      },
      {
        id: "death_pirate_medium",
        filename: "death_pirate_medium.mp3",
        duration: 0.7,
        prompt:
          "Medium pirate ship exploding, fiery metallic debris scatter with flames crackling",
      },
      {
        id: "death_pirate_large",
        filename: "death_pirate_large.mp3",
        duration: 1.0,
        prompt:
          "Large pirate cruiser exploding, massive fiery destruction with prolonged flaming debris rain",
      },
      // Scavenger size variants - sputtering failures
      {
        id: "death_scavenger_small",
        filename: "death_scavenger_small.mp3",
        duration: 0.5,
        prompt:
          "Small scavenger drone breaking apart, quick sputtering pops as parts scatter",
      },
      {
        id: "death_scavenger_medium",
        filename: "death_scavenger_medium.mp3",
        duration: 0.7,
        prompt:
          "Medium scavenger vessel breaking apart, sputtering chain of component failures",
      },
      {
        id: "death_scavenger_large",
        filename: "death_scavenger_large.mp3",
        duration: 1.0,
        prompt:
          "Large scavenger hauler breaking apart, prolonged sputtering cascade as massive ship disintegrates",
      },
      // Swarm size variants - organic biological deaths
      {
        id: "death_swarm_small",
        filename: "death_swarm_small.mp3",
        duration: 0.6,
        prompt:
          "Small swarm creature dying, quick organic squelch with wet pop, small biological burst",
      },
      {
        id: "death_swarm_medium",
        filename: "death_swarm_medium.mp3",
        duration: 0.8,
        prompt:
          "Medium swarm creature dying, organic squelch with wet dissolution, biological mass decomposing",
      },
      {
        id: "death_swarm_large",
        filename: "death_swarm_large.mp3",
        duration: 1.2,
        prompt:
          "Large swarm creature dying, massive organic explosion with wet dissolution, huge biological burst",
      },
      // Void size variants - dimensional implosion
      {
        id: "death_void_small",
        filename: "death_void_small.mp3",
        duration: 0.7,
        prompt:
          "Small void entity imploding, quick dimensional snap with ethereal whisper",
      },
      {
        id: "death_void_medium",
        filename: "death_void_medium.mp3",
        duration: 1.0,
        prompt:
          "Medium void entity imploding, dimensional collapse with ethereal wailing release",
      },
      {
        id: "death_void_large",
        filename: "death_void_large.mp3",
        duration: 1.3,
        prompt:
          "Large void entity imploding, massive dimensional rift collapse with reality-warping shockwave",
      },
      // Rogue Miner size variants - industrial explosions
      {
        id: "death_rogue_small",
        filename: "death_rogue_miner_small.mp3",
        duration: 0.6,
        prompt:
          "Small rogue mining drone explosion, quick industrial burst with metal grinding",
      },
      {
        id: "death_rogue_medium",
        filename: "death_rogue_miner_medium.mp3",
        duration: 0.8,
        prompt:
          "Medium rogue mining ship explosion, heavy machinery breaking with fuel ignition",
      },
      {
        id: "death_rogue_large",
        filename: "death_rogue_miner_large.mp3",
        duration: 1.2,
        prompt:
          "Large rogue mining hauler explosion, massive industrial catastrophe with heavy machinery destruction",
      },
    ],
  },

  shields: {
    tier: 3,
    sounds: [
      {
        id: "shield_absorption",
        filename: "shield_absorption.mp3",
        duration: 0.5,
        prompt:
          "Shield absorbing continuous damage, electrical energy absorption with protective pulse",
      },
      {
        id: "shield_recharge",
        filename: "shield_recharge.mp3",
        duration: 0.8,
        prompt:
          "Shield recharging, rising electrical hum with energy restoration, power building up",
      },
    ],
  },

  ui_extras: {
    tier: 3,
    sounds: [
      {
        id: "slider_tick",
        filename: "slider_tick.mp3",
        duration: 0.5,
        prompt:
          "UI slider tick, tiny electronic click, subtle feedback for slider movement",
      },
      {
        id: "toggle_on",
        filename: "toggle_on.mp3",
        duration: 0.5,
        prompt:
          "UI toggle switch on, electronic activation sound with positive confirmation",
      },
      {
        id: "toggle_off",
        filename: "toggle_off.mp3",
        duration: 0.5,
        prompt:
          "UI toggle switch off, electronic deactivation sound with gentle shutdown",
      },
      {
        id: "relic_acquired",
        filename: "relic_acquired.mp3",
        duration: 0.8,
        prompt:
          "Rare relic acquisition, magical discovery fanfare with ancient power awakening, epic find",
      },
    ],
  },

  // ===================
  // TIER 2 - Reward Popup Sounds
  // ===================

  rewards: {
    tier: 2,
    sounds: [
      // Credits
      {
        id: "reward_credits",
        filename: "credits.mp3",
        duration: 0.5,
        prompt:
          "Futuristic digital coin collection sound, satisfying electronic cash register chime with metallic sparkle, money acquired notification",
      },
      {
        id: "reward_credits_large",
        filename: "credits_large.mp3",
        duration: 0.5,
        prompt:
          "Impressive digital jackpot sound, multiple coins cascading with electronic flourish, big money reward notification, triumphant",
      },
      // Resources by rarity (improved versions)
      {
        id: "reward_common",
        filename: "loot_common.mp3",
        duration: 0.5,
        prompt:
          "Simple soft pickup chime, basic resource collection sound, subtle positive feedback, unobtrusive sci-fi tone",
      },
      {
        id: "reward_uncommon",
        filename: "loot_uncommon.mp3",
        duration: 0.5,
        prompt:
          "Pleasant ascending two-tone chime, slightly sparkly resource pickup, minor discovery sound, satisfying",
      },
      {
        id: "reward_rare",
        filename: "loot_rare.mp3",
        duration: 0.5,
        prompt:
          "Exciting shimmering pickup sound with crystalline resonance, valuable find notification, ascending musical tones with sparkle",
      },
      {
        id: "reward_ultrarare",
        filename: "loot_ultrarare.mp3",
        duration: 0.6,
        prompt:
          "Epic treasure discovery fanfare, magical crystalline shimmer with ascending triumphant tones, legendary find sound, cosmic resonance",
      },
      // Buffs
      {
        id: "reward_buff_shield",
        filename: "buff_shield.mp3",
        duration: 0.5,
        prompt:
          "Energy shield activation whoosh, protective force field powering up, defensive buff sound with electric hum",
      },
      {
        id: "reward_buff_speed",
        filename: "buff_speed.mp3",
        duration: 0.5,
        prompt:
          "Quick acceleration whoosh, speed boost activation with rising doppler effect, fast energetic sound",
      },
      {
        id: "reward_buff_damage",
        filename: "buff_damage.mp3",
        duration: 0.5,
        prompt:
          "Weapon power surge sound, aggressive energy charging up, damage amplification with electric crackle",
      },
      {
        id: "reward_buff_radar",
        filename: "buff_radar.mp3",
        duration: 0.5,
        prompt:
          "Radar ping expansion sound, scanning pulse wave extending outward, detection range enhancement",
      },
      // Components
      {
        id: "reward_component",
        filename: "component.mp3",
        duration: 0.5,
        prompt:
          "Mechanical part acquisition sound, high-tech component pickup with metallic click and electronic confirmation beep",
      },
      // Relics - faction specific
      {
        id: "reward_relic_starmap",
        filename: "relic_starmap.mp3",
        duration: 0.6,
        prompt:
          "Ancient mystical discovery sound, otherworldly cosmic chime with ethereal resonance, star map revelation",
      },
      {
        id: "reward_relic_void",
        filename: "relic_void.mp3",
        duration: 0.6,
        prompt:
          "Dark energy artifact sound, deep mysterious resonance with void echoes, cosmic horror undertone",
      },
      {
        id: "reward_relic_swarm",
        filename: "relic_swarm.mp3",
        duration: 0.6,
        prompt:
          "Organic alien artifact discovery, biological pulsing sound with wet organic shimmer, hive core acquisition",
      },
      {
        id: "reward_relic_pirate",
        filename: "relic_pirate.mp3",
        duration: 0.6,
        prompt:
          "Classic treasure chest opening sound, golden coins with metallic sparkle, pirate treasure fanfare",
      },
      {
        id: "reward_relic_wormhole",
        filename: "relic_wormhole.mp3",
        duration: 0.7,
        prompt:
          "Spacetime distortion artifact sound, dimensional warping resonance with cosmic power surge, reality-bending discovery",
      },
    ],
  },

  // ===================
  // TIER 2 - Base Destruction (8 second sequences)
  // ===================

  base_destruction: {
    tier: 2,
    sounds: [
      {
        id: "base_destruction_pirate",
        filename: "base_pirate.mp3",
        duration: 8.0,
        prompt:
          "pirate space station destruction sequence: electrical sparking for one and a half seconds, then escalating chain explosions along metal docking arms with fiery bursts for two and a half seconds, massive central explosion with expanding shockwave and debris scatter for two seconds, ending with embers crackling and metal groaning as wreckage settles for final two seconds, aggressive industrial destruction",
      },
      {
        id: "base_destruction_scavenger",
        filename: "base_scavenger.mp3",
        duration: 8.0,
        prompt:
          "scavenger space junkyard structural collapse: begins with metal groaning and creaking under stress for one and a half seconds, then support beams snapping with metallic pings and breaking sounds for two and a half seconds, cascading structural failure with crumbling debris and dust clouds for two seconds, ending with settling rubble and distant metal clanks for final two seconds, chaotic",
      },
      {
        id: "base_destruction_swarm",
        filename: "base_swarm.mp3",
        duration: 8.0,
        prompt:
          "alien organic hive dissolution begins as biotech moans down with organic membrane pulsing for one and a half seconds, then wet biological pustules begin bursting and squelching with increasing intensity for two and a half seconds, massive core rupture with organic burst and spore cloud release for two seconds, ending with dissipating biological misting and fading alien moans resonating, grotesque wet organic sounds throughout",
      },
      {
        id: "base_destruction_void",
        filename: "base_void.mp3",
        duration: 10.0,
        prompt:
          "interdimensional rift begins imploding with portal destabilization crackling sparks and gravitational whirring and distortion gradually increasing for three and a half seconds, violent implosion sucking everything inward with dimensional collapse, brief pause before massive explosion",
      },
      {
        id: "base_destruction_mining",
        filename: "base_mining.mp3",
        duration: 8.0,
        prompt:
          "electrical equipment malfunction with sparking and power surge for one and a half seconds, industrial machinery winding down for 1 second, then fireworks factory ignites and rapidly explodes",
      },
    ],
  },
};

/**
 * Generate a single sound using ElevenLabs API
 */
async function generateSound(soundConfig, category, forceRegenerate = false) {
  const outputDir = path.join(OUTPUT_BASE, category);
  const outputPath = path.join(outputDir, soundConfig.filename);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Skip if file already exists (unless force)
  if (fs.existsSync(outputPath) && !forceRegenerate) {
    console.log(`  [SKIP] ${soundConfig.id} - already exists`);
    return { success: true, skipped: true };
  }

  // Enforce minimum duration for API
  const apiDuration = Math.max(
    MIN_DURATION,
    Math.min(soundConfig.duration, MAX_DURATION)
  );

  console.log(`  [GEN] ${soundConfig.id} (${apiDuration}s)...`);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: soundConfig.prompt,
        duration_seconds: apiDuration,
        output_format: "mp3_44100_128",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error}`);
    }

    // Get audio data as buffer
    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // Save to file
    fs.writeFileSync(outputPath, audioBuffer);

    console.log(
      `  [OK] ${soundConfig.filename} (${(audioBuffer.length / 1024).toFixed(
        1
      )}KB)`
    );
    return { success: true, size: audioBuffer.length };
  } catch (error) {
    console.error(`  [ERR] ${soundConfig.id}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Generate all sounds in a category
 */
async function generateCategory(
  categoryName,
  categoryData,
  forceRegenerate = false
) {
  console.log(
    `\n=== ${categoryName.toUpperCase()} (${
      categoryData.sounds.length
    } sounds) ===`
  );

  const results = { success: 0, skipped: 0, failed: 0 };

  // Map category name to output folder
  const categoryMap = {
    ui_extended: "ui",
    ui_extras: "ui",
    destruction_variants: "destruction",
    shields: "movement",
    environment_extras: "environment",
    rewards: "rewards",
    base_destruction: "destruction",
  };
  const outputCategory = categoryMap[categoryName] || categoryName;

  for (const sound of categoryData.sounds) {
    const result = await generateSound(sound, outputCategory, forceRegenerate);

    if (result.success) {
      if (result.skipped) {
        results.skipped++;
      } else {
        results.success++;
      }
    } else {
      results.failed++;
    }

    // Delay between API calls
    if (!result.skipped) {
      await new Promise((resolve) => setTimeout(resolve, API_DELAY));
    }
  }

  return results;
}

/**
 * Generate sounds by tier
 */
async function generateByTier(targetTier, forceRegenerate = false) {
  console.log(`\nGenerating Tier ${targetTier} sounds...\n`);

  const totals = { success: 0, skipped: 0, failed: 0 };

  for (const [categoryName, categoryData] of Object.entries(SOUNDS)) {
    if (categoryData.tier === targetTier) {
      const results = await generateCategory(
        categoryName,
        categoryData,
        forceRegenerate
      );
      totals.success += results.success;
      totals.skipped += results.skipped;
      totals.failed += results.failed;
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Generated: ${totals.success}`);
  console.log(`Skipped: ${totals.skipped}`);
  console.log(`Failed: ${totals.failed}`);

  return totals;
}

/**
 * Generate a single sound by ID
 */
async function generateSingle(soundId, forceRegenerate = false) {
  for (const [categoryName, categoryData] of Object.entries(SOUNDS)) {
    const sound = categoryData.sounds.find((s) => s.id === soundId);
    if (sound) {
      const categoryMap = {
        ui_extended: "ui",
        ui_extras: "ui",
        destruction_variants: "destruction",
        shields: "movement",
        rewards: "rewards",
        base_destruction: "destruction",
      };
      const outputCategory = categoryMap[categoryName] || categoryName;
      await generateSound(sound, outputCategory, forceRegenerate);
      return;
    }
  }
  console.error(`Sound not found: ${soundId}`);
}

/**
 * List all sounds
 */
function listSounds() {
  console.log("\n=== ALL SOUNDS ===\n");

  let total = 0;

  for (const [categoryName, categoryData] of Object.entries(SOUNDS)) {
    console.log(`\n[Tier ${categoryData.tier}] ${categoryName}:`);
    for (const sound of categoryData.sounds) {
      console.log(`  ${sound.id} (${sound.duration}s) - ${sound.filename}`);
      total++;
    }
  }

  console.log(`\nTotal: ${total} sounds`);
}

/**
 * Count sounds by tier
 */
function countSounds() {
  const counts = { 1: 0, 2: 0, 3: 0 };

  for (const categoryData of Object.values(SOUNDS)) {
    counts[categoryData.tier] += categoryData.sounds.length;
  }

  return counts;
}

// ================
// CLI Entry Point
// ================

async function main() {
  const args = process.argv.slice(2);
  const forceRegenerate = args.includes("--force");

  console.log("Galaxy Miner - ElevenLabs Sound Generator");
  console.log("=========================================");

  // Parse arguments
  if (args.includes("--list")) {
    listSounds();
    return;
  }

  if (args.includes("--count")) {
    const counts = countSounds();
    console.log(`\nSound counts by tier:`);
    console.log(`  Tier 1: ${counts[1]} sounds`);
    console.log(`  Tier 2: ${counts[2]} sounds`);
    console.log(`  Tier 3: ${counts[3]} sounds`);
    console.log(`  Total: ${counts[1] + counts[2] + counts[3]} sounds`);
    return;
  }

  const tierIndex = args.indexOf("--tier");
  if (tierIndex !== -1 && args[tierIndex + 1]) {
    const tier = parseInt(args[tierIndex + 1]);
    await generateByTier(tier, forceRegenerate);
    return;
  }

  const categoryIndex = args.indexOf("--category");
  if (categoryIndex !== -1 && args[categoryIndex + 1]) {
    const categoryName = args[categoryIndex + 1];
    if (SOUNDS[categoryName]) {
      await generateCategory(
        categoryName,
        SOUNDS[categoryName],
        forceRegenerate
      );
    } else {
      console.error(`Unknown category: ${categoryName}`);
      console.log("Available categories:", Object.keys(SOUNDS).join(", "));
    }
    return;
  }

  const singleIndex = args.indexOf("--single");
  if (singleIndex !== -1 && args[singleIndex + 1]) {
    await generateSingle(args[singleIndex + 1], forceRegenerate);
    return;
  }

  // Default: generate Tier 1 sounds
  console.log(
    "\nNo arguments provided. Generating Tier 1 (essential) sounds..."
  );
  console.log("Use --help for options.\n");

  await generateByTier(1, forceRegenerate);
}

// Show help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
Usage: node generate.js [options]

Options:
  --list              List all sound definitions
  --count             Show sound counts by tier
  --tier <n>          Generate all sounds of tier n (1, 2, or 3)
  --category <name>   Generate specific category
  --single <id>       Generate a single sound by ID
  --force             Regenerate even if files exist
  --help, -h          Show this help

Categories: ${Object.keys(SOUNDS).join(", ")}

Examples:
  node generate.js                    # Generate Tier 1 sounds
  node generate.js --tier 2           # Generate Tier 2 sounds
  node generate.js --category weapons # Generate weapon sounds
  node generate.js --single queen_roar # Generate single sound
  node generate.js --force --tier 1   # Force regenerate Tier 1
`);
  process.exit(0);
}

main().catch(console.error);
