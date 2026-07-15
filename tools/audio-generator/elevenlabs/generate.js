/**
 * ElevenLabs Sound Effects Generator for Galaxy Miner
 *
 * Usage:
 *   node generate.js                    # Generate all Tier 1 sounds
 *   node generate.js --tier 2           # Generate Tier 2 sounds
 *   node generate.js --category weapons # Generate specific category
 *   node generate.js --collection ui    # Generate every UI category
 *   node generate.js --single weapon_t1 # Generate single sound
 *   node generate.js --dry-run --collection weapons
 *   node generate.js --list             # List all sounds
 *   node generate.js --force            # Regenerate even if files exist
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

// API configuration. Environment overrides make credential-free dry runs and
// local contract tests possible without ever redirecting production assets.
const DEFAULT_API_URL = "https://api.elevenlabs.io/v1/sound-generation";
const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";
const DEFAULT_MODEL_ID = "eleven_text_to_sound_v2";
const DEFAULT_PROMPT_INFLUENCE = 0.6;

// Output directory (relative to project root)
const DEFAULT_OUTPUT_BASE = path.join(
  __dirname,
  "../../../client/assets/audio"
);

// Delay between API calls (ms) to avoid rate limiting
const DEFAULT_API_DELAY = 2000;
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_ATTEMPTS = 3;

// ElevenLabs API constraints
const MIN_DURATION = 0.5; // API minimum
const MAX_DURATION = 30.0; // API maximum

// The model is more consistent when every short game cue describes its
// envelope and isolation requirements. Individual definitions provide the
// identity; these suffixes keep weapon fire separate from impacts/destruction
// and keep UI feedback from turning into music or ambience.
function weaponPrompt(identity, activeMilliseconds) {
  return `Dry isolated game-ready weapon one-shot: ${identity} Clean cutoff within ${activeMilliseconds} milliseconds; punchy mono-compatible mix. Firing only—no projectile flight, impact, ricochet, explosion, destruction, reverb, echo, ambience, music, or voice.`;
}

function uiPrompt(identity, activeMilliseconds) {
  return `Dry isolated game-ready spaceship-interface one-shot: ${identity} Clean cutoff within ${activeMilliseconds} milliseconds; mono-compatible and non-fatiguing when repeated. No ambience, music, voice, reverb, echo, or long tail.`;
}

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
        variationPattern: "weapon_player_t1_{index}.mp3",
        variations: 3,
        duration: 0.5,
        activeDuration: 0.09,
        prompt: weaponPrompt(
          "compact cyan pulse blaster with a needle-sharp electronic snap, bright glassy zap, and tiny power-cell chirp.",
          90
        ),
      },
      {
        id: "weapon_t2",
        filename: "weapon_player_t2.mp3",
        variationPattern: "weapon_player_t2_{index}.mp3",
        variations: 3,
        duration: 0.5,
        activeDuration: 0.12,
        prompt: weaponPrompt(
          "paired cyan emitters fire two tightly offset laser snaps about 20 milliseconds apart, with crisp electrical transients and a brighter energy body than tier one.",
          120
        ),
      },
      {
        id: "weapon_t3",
        filename: "weapon_player_t3.mp3",
        variationPattern: "weapon_player_t3_{index}.mp3",
        variations: 3,
        duration: 0.5,
        activeDuration: 0.16,
        prompt: weaponPrompt(
          "green plasma-orb launcher with a firm capacitor punch, dense rounded energy bloom, and fast ion hiss; weighty low-mid body without a cinematic boom.",
          160
        ),
      },
      {
        id: "weapon_t4",
        filename: "weapon_player_t4.mp3",
        variationPattern: "weapon_player_t4_{index}.mp3",
        variations: 3,
        duration: 0.6,
        activeDuration: 0.16,
        prompt: weaponPrompt(
          "orange thermal beam ignition, a hard contact snap into a compact searing energy buzz with a precise power-gate cutoff; hot, focused, and intense.",
          160
        ),
      },
      {
        id: "weapon_t5",
        filename: "weapon_player_t5.mp3",
        variationPattern: "weapon_player_t5_{index}.mp3",
        variations: 5,
        duration: 0.6,
        activeDuration: 0.15,
        prompt: weaponPrompt(
          "Tesla cannon discharge with a violent coil snap, branching blue-cyan electrical arcs, and a brief high-voltage crackle; dense and powerful but compact, without thunder or sustained hum.",
          150
        ),
      },
      // NPC weapons - faction specific visuals
      {
        id: "npc_pirate",
        filename: "weapon_npc_pirate.mp3",
        variationPattern: "weapon_pirate_{index}.mp3",
        variations: 3,
        duration: 0.5,
        activeDuration: 0.14,
        prompt: weaponPrompt(
          "brutal pirate cannon muzzle report with a hot propellant punch, scorched-metal crack, and short spark spit; gritty, heavy, and compact.",
          140
        ),
      },
      {
        id: "npc_scavenger",
        filename: "weapon_npc_scavenger.mp3",
        variationPattern: "weapon_scavenger_{index}.mp3",
        variations: 3,
        duration: 0.5,
        activeDuration: 0.13,
        prompt: weaponPrompt(
          "jury-rigged scavenger laser with an uneven double energy spit, loose relay tick, and unstable capacitor crackle; cheap, erratic, and compact.",
          130
        ),
      },
      {
        id: "npc_swarm",
        filename: "weapon_npc_swarm.mp3",
        variationPattern: "weapon_swarm_{index}.mp3",
        variations: 3,
        duration: 0.5,
        activeDuration: 0.16,
        prompt: weaponPrompt(
          "Swarm bio-projectile launch with a hard chitin click, compact wet membrane snap, deep vacuum pulse, and short tendril hiss; organic but non-vocal.",
          160
        ),
      },
      {
        id: "npc_void",
        filename: "weapon_npc_void.mp3",
        variationPattern: "weapon_void_{index}.mp3",
        variations: 3,
        duration: 0.5,
        activeDuration: 0.18,
        prompt: weaponPrompt(
          "focused Void beam ignition, a brief inverse-suction transient into a dense low energy pulse with a cold crystalline edge and abrupt dimensional snap; mysterious but punchy, never ghostly or vocal.",
          180
        ),
      },
      {
        id: "npc_miner",
        filename: "weapon_npc_miner.mp3",
        variationPattern: "weapon_rogue_miner_{index}.mp3",
        variations: 3,
        duration: 0.5,
        activeDuration: 0.16,
        prompt: weaponPrompt(
          "repurposed industrial mining laser with a heavy contactor clack, short abrasive cutting arc, and brief motor strain; rugged mechanical weight without a continuous drill or long grind.",
          160
        ),
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
      {
        id: "base_hit",
        filename: "base_hit.mp3",
        duration: 0.6,
        prompt:
          "Heavy metallic impact on large space station hull with deep resonant clang and structural vibration then massive armored surface being struck with reverberating bass thud",
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
        activeDuration: 0.06,
        prompt: uiPrompt(
          "tactile console button press, a tiny polymer click layered with one clean high digital tick; neutral and responsive.",
          60
        ),
      },
      {
        id: "ui_hover",
        filename: "ui_hover.mp3",
        duration: 0.5,
        activeDuration: 0.04,
        prompt: uiPrompt(
          "very quiet feather-light capacitive hover tick, one soft glassy blip with no bass; subtle enough for frequent repetition.",
          40
        ),
      },
      {
        id: "ui_panel_open",
        filename: "ui_panel_open.mp3",
        duration: 0.5,
        activeDuration: 0.18,
        prompt: uiPrompt(
          "holographic panel opens with a fast rising filtered-data sweep, two delicate scan ticks, and a soft digital latch; crisp and restrained, never a cinematic whoosh.",
          180
        ),
      },
      {
        id: "ui_panel_close",
        filename: "ui_panel_close.mp3",
        duration: 0.5,
        activeDuration: 0.16,
        prompt: uiPrompt(
          "holographic panel closes with a quick descending filtered-data sweep and muted digital latch; clearly the inverse of panel open, crisp and restrained.",
          160
        ),
      },
      {
        id: "ui_notification",
        filename: "ui_notification.mp3",
        duration: 0.5,
        activeDuration: 0.22,
        prompt: uiPrompt(
          "neutral two-pulse data alert, a rounded first ping followed by a slightly brighter answer ping; noticeable without sounding urgent or becoming an alarm loop.",
          220
        ),
      },
      {
        id: "ui_error",
        filename: "ui_error.mp3",
        duration: 0.5,
        activeDuration: 0.2,
        prompt: uiPrompt(
          "short electronic refusal, two tight low dissonant buzz pulses ending in a muted terminal thunk; assertive but not abrasive, never a siren.",
          200
        ),
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
      {
        id: "void_leviathan_death",
        filename: "void_leviathan_death.mp3",
        duration: 5.0,
        prompt:
          "Massive void entity dying with dimensional implosion and dark energy collapsing inward with reality tearing apart then deep bass shockwave followed by ethereal silence and cosmic horror creature death with otherworldly wailing fading into void",
      },
      {
        id: "foreman_spawn",
        filename: "foreman_spawn.mp3",
        duration: 2.0,
        prompt:
          "Heavy industrial mining boss emerging with massive machinery powering up and grinding metal then deep diesel engine roar with hydraulic pressure release and menacing mechanical awakening",
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
      {
        id: "salvage",
        filename: "salvage.mp3",
        duration: 0.6,
        prompt:
          "Derelict ship salvage collection sound with metal scraping and mechanical parts being gathered then tractor beam pulling debris with satisfying acquisition chime",
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
      {
        id: "void_warp_transit",
        filename: "void_warp_transit.mp3",
        duration: 2.0,
        prompt:
          "Deep warping subspace warp drive sound, distorted spacetime tearing, low rumbling bass with ethereal high-frequency shimmer, sci-fi faster-than-light jump, darker and more intense than a normal wormhole transit",
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
        activeDuration: 0.24,
        prompt: uiPrompt(
          "clean two-step success confirmation, a rounded digital ping followed by a brighter resolved sparkle; satisfying and restrained, never a fanfare or coin sound.",
          240
        ),
      },
      {
        id: "ui_warning",
        filename: "ui_warning.mp3",
        duration: 0.5,
        activeDuration: 0.3,
        prompt: uiPrompt(
          "two evenly spaced warning beeps over one firm low electronic pulse; cautionary and clear but not an emergency siren or alarm loop.",
          300
        ),
      },
      {
        id: "ui_info",
        filename: "ui_info.mp3",
        duration: 0.5,
        activeDuration: 0.14,
        prompt: uiPrompt(
          "one neutral data ping with a tiny soft interface click beneath it; calm, unobtrusive, and without a sparkle cascade or warning tone.",
          140
        ),
      },
      {
        id: "ui_tab_switch",
        filename: "ui_tab_switch.mp3",
        duration: 0.5,
        activeDuration: 0.07,
        prompt: uiPrompt(
          "tiny lateral digital swipe ending in a crisp mechanical detent; very short and light for rapid tab navigation, never a broad whoosh.",
          70
        ),
      },
      {
        id: "ui_upgrade",
        filename: "ui_upgrade_purchase.mp3",
        duration: 0.6,
        activeDuration: 0.4,
        prompt: uiPrompt(
          "ship upgrade locks into place with a compact mechanical clunk, rising electrical power surge, and bright energy seal; substantial and rewarding, without a fanfare or explosion.",
          400
        ),
      },
      {
        id: "market_list",
        filename: "market_list.mp3",
        duration: 0.5,
        activeDuration: 0.16,
        prompt: uiPrompt(
          "marketplace listing upload, a scanner click followed by one short upward data chirp and final register tick; neutral transaction feedback, never a cash register.",
          160
        ),
      },
      {
        id: "market_buy",
        filename: "market_buy.mp3",
        duration: 0.5,
        activeDuration: 0.22,
        prompt: uiPrompt(
          "marketplace purchase approved, a crisp terminal stamp followed by a short descending two-step digital debit tone; clear and restrained, without coins or fanfare.",
          220
        ),
      },
      {
        id: "market_sell",
        filename: "market_sell.mp3",
        duration: 0.5,
        activeDuration: 0.24,
        prompt: uiPrompt(
          "marketplace sale completed, a crisp terminal tick followed by a quick ascending credit-arrival cascade and one bright final ping; positive but restrained, without coins or cash register.",
          240
        ),
      },
      {
        id: "market_cancel",
        filename: "market_cancel.mp3",
        duration: 0.5,
        activeDuration: 0.15,
        prompt: uiPrompt(
          "marketplace listing cancelled, a muted reverse data chirp ending in a soft mechanical release click; neutral and non-alarming, without an error buzz or dramatic whoosh.",
          150
        ),
      },
      {
        id: "chat_receive",
        filename: "chat_message.mp3",
        duration: 0.5,
        activeDuration: 0.13,
        prompt: uiPrompt(
          "incoming spacecraft comms message, two tiny rounded radio-data pips; friendly, soft, and low-distraction for frequent use, without static or a ringtone.",
          130
        ),
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
        activeDuration: 0.03,
        prompt: uiPrompt(
          "extremely short and quiet unpitched mechanical detent tick for one slider step; crisp, with no beep, tonal ring, or bass.",
          30
        ),
      },
      {
        id: "toggle_on",
        filename: "toggle_on.mp3",
        duration: 0.5,
        activeDuration: 0.08,
        prompt: uiPrompt(
          "small physical switch snap paired with one short rising electronic activation blip; positive and compact, without a power-up swell or bass hit.",
          80
        ),
      },
      {
        id: "toggle_off",
        filename: "toggle_off.mp3",
        duration: 0.5,
        activeDuration: 0.08,
        prompt: uiPrompt(
          "small physical switch snap paired with one short falling electronic deactivation blip; softer and darker than toggle on, without a shutdown swell or bass hit.",
          80
        ),
      },
      {
        id: "relic_acquired",
        filename: "relic_acquired.mp3",
        duration: 0.8,
        activeDuration: 0.48,
        prompt: uiPrompt(
          "ancient crystalline relic activates with a compact low energy bloom, layered glass shimmer, and one final harmonic ping; mysterious, rare, and valuable, without a fanfare, choir, explosion, or long drone.",
          480
        ),
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
      {
        id: "reward_relic_subspace",
        filename: "relic_subspace.mp3",
        duration: 0.7,
        prompt:
          "Subspace warp drive artifact discovery with dimensional warping resonance and faster-than-light energy surge then deep space-bending vibration with ascending ethereal tones",
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

const CATEGORY_OUTPUT_MAP = Object.freeze({
  ui_extended: "ui",
  ui_extras: "ui",
  destruction_variants: "destruction",
  shields: "movement",
  environment_extras: "environment",
  rewards: "rewards",
  base_destruction: "destruction",
});

// These are deliberately narrow safe selections. In particular, neither
// collection includes NPC death, boss death, or base-destruction definitions.
const COLLECTIONS = Object.freeze({
  weapons: ["weapons"],
  ui: ["ui", "ui_extended", "ui_extras"],
  "weapon-ui": ["weapons", "ui", "ui_extended", "ui_extras"],
});

function getRuntimeOptions(overrides = {}) {
  return {
    apiKey: overrides.apiKey ?? process.env.ELEVENLABS_API_KEY,
    apiUrl:
      overrides.apiUrl ??
      process.env.ELEVENLABS_API_URL ??
      DEFAULT_API_URL,
    outputBase:
      overrides.outputBase ??
      process.env.ELEVENLABS_OUTPUT_DIR ??
      DEFAULT_OUTPUT_BASE,
    outputFormat:
      overrides.outputFormat ??
      process.env.ELEVENLABS_OUTPUT_FORMAT ??
      DEFAULT_OUTPUT_FORMAT,
    modelId:
      overrides.modelId ??
      process.env.ELEVENLABS_MODEL_ID ??
      DEFAULT_MODEL_ID,
    promptInfluence: Number(
      overrides.promptInfluence ??
        process.env.ELEVENLABS_PROMPT_INFLUENCE ??
        DEFAULT_PROMPT_INFLUENCE
    ),
    apiDelay: Number(
      overrides.apiDelay ??
        process.env.ELEVENLABS_API_DELAY_MS ??
        DEFAULT_API_DELAY
    ),
    timeoutMs: Number(
      overrides.timeoutMs ??
        process.env.ELEVENLABS_TIMEOUT_MS ??
        DEFAULT_TIMEOUT_MS
    ),
    maxAttempts: Number(overrides.maxAttempts ?? MAX_ATTEMPTS),
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    sleep:
      overrides.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds))),
    audioProcessor: overrides.audioProcessor ?? trimMp3ToActiveDuration,
    spawnSyncImpl: overrides.spawnSyncImpl ?? spawnSync,
    logger: overrides.logger ?? console,
    dryRun: Boolean(overrides.dryRun),
    forceRegenerate: Boolean(overrides.forceRegenerate),
    includeVariations: overrides.includeVariations !== false,
  };
}

function outputCategoryFor(categoryName) {
  return CATEGORY_OUTPUT_MAP[categoryName] || categoryName;
}

function formatVariationFilename(pattern, index) {
  return pattern.split("{index}").join(String(index).padStart(2, "0"));
}

function expandSoundAssets(soundConfig, includeVariations = true) {
  const assets = [
    {
      ...soundConfig,
      definitionId: soundConfig.id,
      variation: null,
    },
  ];

  if (
    !includeVariations ||
    !Number.isInteger(soundConfig.variations) ||
    soundConfig.variations < 1 ||
    typeof soundConfig.variationPattern !== "string"
  ) {
    return assets;
  }

  for (let index = 1; index <= soundConfig.variations; index++) {
    const suffix = String(index).padStart(2, "0");
    assets.push({
      ...soundConfig,
      id: `${soundConfig.id}_${suffix}`,
      definitionId: soundConfig.id,
      filename: formatVariationFilename(soundConfig.variationPattern, index),
      variation: index,
    });
  }

  return assets;
}

function getCategoryAssets(categoryName, includeVariations = true) {
  const categoryData = SOUNDS[categoryName];
  if (!categoryData) return [];

  const outputCategory = outputCategoryFor(categoryName);
  return categoryData.sounds.flatMap((sound) =>
    expandSoundAssets(sound, includeVariations).map((asset) => ({
      ...asset,
      categoryName,
      outputCategory,
      relativePath: path.posix.join(outputCategory, asset.filename),
    }))
  );
}

function findSound(soundId) {
  for (const [categoryName, categoryData] of Object.entries(SOUNDS)) {
    const sound = categoryData.sounds.find((candidate) => candidate.id === soundId);
    if (sound) return { categoryName, sound };
  }
  return null;
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.normalize(value);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

function validateCatalog() {
  const errors = [];
  const ids = new Set();
  const outputPaths = new Set();

  for (const [categoryName, categoryData] of Object.entries(SOUNDS)) {
    if (![1, 2, 3].includes(categoryData.tier)) {
      errors.push(`${categoryName}: invalid tier ${categoryData.tier}`);
    }

    for (const sound of categoryData.sounds) {
      if (ids.has(sound.id)) errors.push(`duplicate sound ID: ${sound.id}`);
      ids.add(sound.id);

      if (typeof sound.prompt !== "string" || sound.prompt.length === 0) {
        errors.push(`${sound.id}: prompt is empty`);
      } else if (sound.prompt.length > 450) {
        errors.push(`${sound.id}: prompt exceeds 450 characters`);
      }

      if (
        typeof sound.duration !== "number" ||
        sound.duration < MIN_DURATION ||
        sound.duration > MAX_DURATION
      ) {
        errors.push(`${sound.id}: duration must be ${MIN_DURATION}-${MAX_DURATION}s`);
      }

      if (
        sound.activeDuration !== undefined &&
        (sound.activeDuration <= 0 || sound.activeDuration > sound.duration)
      ) {
        errors.push(`${sound.id}: invalid activeDuration`);
      }

      if (
        sound.variationPattern !== undefined &&
        !sound.variationPattern.includes("{index}")
      ) {
        errors.push(`${sound.id}: variationPattern must contain {index}`);
      }

      for (const asset of getCategoryAssets(categoryName)) {
        if (asset.definitionId !== sound.id) continue;
        if (!isSafeRelativePath(asset.relativePath)) {
          errors.push(`${asset.id}: unsafe output path ${asset.relativePath}`);
        }
        if (outputPaths.has(asset.relativePath)) {
          errors.push(`duplicate output path: ${asset.relativePath}`);
        }
        outputPaths.add(asset.relativePath);
      }
    }
  }

  return errors;
}

function buildApiRequest(soundConfig, overrides = {}) {
  const options = getRuntimeOptions(overrides);
  const url = new URL(options.apiUrl);
  url.searchParams.set("output_format", options.outputFormat);

  return {
    url: url.toString(),
    body: {
      text: soundConfig.prompt,
      duration_seconds: Math.max(
        MIN_DURATION,
        Math.min(soundConfig.duration, MAX_DURATION)
      ),
      prompt_influence: options.promptInfluence,
      model_id: options.modelId,
      loop: false,
    },
  };
}

function assertApiKey(apiKey) {
  if (
    typeof apiKey !== "string" ||
    apiKey.trim().length === 0 ||
    apiKey === "YOUR_API_KEY_HERE"
  ) {
    throw new Error("ELEVENLABS_API_KEY is required for generation");
  }
}

function looksLikeMp3(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  const hasId3 = buffer.subarray(0, 3).toString("ascii") === "ID3";
  const hasFrameSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  return hasId3 || hasFrameSync;
}

function trimMp3ToActiveDuration(audioBuffer, soundConfig, options) {
  if (
    typeof soundConfig.activeDuration !== "number" ||
    soundConfig.activeDuration >= soundConfig.duration
  ) {
    return audioBuffer;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "galaxy-miner-sfx-"));
  const sourcePath = path.join(tempDir, "source.mp3");
  const outputPath = path.join(tempDir, "trimmed.mp3");
  const fadeDuration = Math.min(0.008, soundConfig.activeDuration / 4);
  const fadeStart = Math.max(0, soundConfig.activeDuration - fadeDuration);
  const filter = [
    "silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB:start_silence=0.002",
    `atrim=duration=${soundConfig.activeDuration.toFixed(3)}`,
    `afade=t=out:st=${fadeStart.toFixed(3)}:d=${fadeDuration.toFixed(3)}`,
    "loudnorm=I=-18:TP=-3:LRA=7",
  ].join(",");

  try {
    fs.writeFileSync(sourcePath, audioBuffer);
    const result = options.spawnSyncImpl(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        sourcePath,
        "-af",
        filter,
        "-ac",
        "1",
        "-ar",
        "44100",
        "-b:a",
        "128k",
        outputPath,
      ],
      { encoding: "utf8" }
    );

    if (result.error) {
      throw new Error(`ffmpeg is required to trim short cues: ${result.error.message}`);
    }
    if (result.status !== 0 || !fs.existsSync(outputPath)) {
      const details = (result.stderr || "unknown ffmpeg error").trim();
      throw new Error(`ffmpeg could not trim ${soundConfig.id}: ${details}`);
    }

    const trimmed = fs.readFileSync(outputPath);
    if (!looksLikeMp3(trimmed)) {
      throw new Error(`ffmpeg produced invalid MP3 data for ${soundConfig.id}`);
    }
    return trimmed;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeFileAtomically(outputPath, audioBuffer) {
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });
  const temporaryPath = `${outputPath}.tmp-${process.pid}-${Date.now()}`;

  try {
    fs.writeFileSync(temporaryPath, audioBuffer);
    fs.renameSync(temporaryPath, outputPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1000, 10000);
  }
  return Math.min(500 * 2 ** (attempt - 1), 4000);
}

async function requestAudio(soundConfig, options) {
  assertApiKey(options.apiKey);
  if (typeof options.fetchImpl !== "function") {
    throw new Error("This Node.js runtime does not provide fetch");
  }

  const request = buildApiRequest(soundConfig, options);
  let lastError;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await options.fetchImpl(request.url, {
        method: "POST",
        headers: {
          "xi-api-key": options.apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify(request.body),
        signal: controller.signal,
      });

      if (response.ok) {
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        if (!looksLikeMp3(audioBuffer)) {
          throw new Error("ElevenLabs returned empty or invalid MP3 data");
        }
        return audioBuffer;
      }

      const responseText = (await response.text()).replace(/\s+/g, " ").slice(0, 500);
      const error = new Error(
        `ElevenLabs API error ${response.status}: ${responseText || response.statusText}`
      );
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === options.maxAttempts) throw error;
      lastError = error;
      await options.sleep(retryDelay(response, attempt));
    } catch (error) {
      const isAbort = error?.name === "AbortError";
      const retryable = isAbort || error instanceof TypeError;
      lastError = isAbort
        ? new Error(`ElevenLabs request timed out after ${options.timeoutMs}ms`)
        : error;
      if (!retryable || attempt === options.maxAttempts) throw lastError;
      await options.sleep(retryDelay(null, attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("ElevenLabs request failed");
}

/** Generate one concrete output asset using the ElevenLabs API. */
async function generateSound(soundConfig, category, overrides = {}) {
  const options = getRuntimeOptions(overrides);
  const outputPath = path.join(options.outputBase, category, soundConfig.filename);

  if (fs.existsSync(outputPath) && !options.forceRegenerate) {
    options.logger.log(`  [SKIP] ${soundConfig.id} - already exists`);
    return { success: true, skipped: true, outputPath };
  }

  if (options.dryRun) {
    options.logger.log(
      `  [DRY] ${soundConfig.id} (${soundConfig.duration}s) -> ${outputPath}`
    );
    return { success: true, dryRun: true, outputPath };
  }

  options.logger.log(`  [GEN] ${soundConfig.id} (${soundConfig.duration}s)...`);

  try {
    const sourceAudio = await requestAudio(soundConfig, options);
    const processedAudio = await options.audioProcessor(
      sourceAudio,
      soundConfig,
      options
    );
    if (!looksLikeMp3(processedAudio)) {
      throw new Error(`Audio processor returned invalid MP3 data for ${soundConfig.id}`);
    }
    writeFileAtomically(outputPath, processedAudio);
    options.logger.log(
      `  [OK] ${soundConfig.filename} (${(processedAudio.length / 1024).toFixed(1)}KB)`
    );
    return {
      success: true,
      generated: true,
      outputPath,
      size: processedAudio.length,
    };
  } catch (error) {
    options.logger.error(`  [ERR] ${soundConfig.id}: ${error.message}`);
    return { success: false, outputPath, error: error.message };
  }
}

function emptyResults() {
  return { success: 0, skipped: 0, dryRun: 0, failed: 0 };
}

function addResult(totals, result) {
  if (!result.success) totals.failed++;
  else if (result.skipped) totals.skipped++;
  else if (result.dryRun) totals.dryRun++;
  else totals.success++;
}

function mergeResults(totals, results) {
  for (const key of Object.keys(totals)) totals[key] += results[key] || 0;
}

/** Generate every concrete asset in one definition category. */
async function generateCategory(categoryName, categoryData, overrides = {}) {
  const options = getRuntimeOptions(overrides);
  const assets = getCategoryAssets(categoryName, options.includeVariations);
  options.logger.log(
    `\n=== ${categoryName.toUpperCase()} (${assets.length} assets) ===`
  );
  const results = emptyResults();

  for (let index = 0; index < assets.length; index++) {
    const asset = assets[index];
    const result = await generateSound(asset, asset.outputCategory, options);
    addResult(results, result);

    if (result.generated && index < assets.length - 1 && options.apiDelay > 0) {
      await options.sleep(options.apiDelay);
    }
  }

  return results;
}

async function generateCategories(categoryNames, overrides = {}) {
  const options = getRuntimeOptions(overrides);
  const totals = emptyResults();

  for (const categoryName of categoryNames) {
    const results = await generateCategory(categoryName, SOUNDS[categoryName], options);
    mergeResults(totals, results);
  }

  options.logger.log("\n=== SUMMARY ===");
  options.logger.log(`Generated: ${totals.success}`);
  options.logger.log(`Dry run: ${totals.dryRun}`);
  options.logger.log(`Skipped: ${totals.skipped}`);
  options.logger.log(`Failed: ${totals.failed}`);
  return totals;
}

async function generateByTier(targetTier, overrides = {}) {
  const categoryNames = Object.entries(SOUNDS)
    .filter(([, categoryData]) => categoryData.tier === targetTier)
    .map(([categoryName]) => categoryName);
  return generateCategories(categoryNames, overrides);
}

async function generateCollection(collectionName, overrides = {}) {
  const categoryNames = COLLECTIONS[collectionName];
  if (!categoryNames) throw new Error(`Unknown collection: ${collectionName}`);
  return generateCategories(categoryNames, overrides);
}

async function generateSingle(soundId, overrides = {}) {
  const found = findSound(soundId);
  if (!found) throw new Error(`Sound not found: ${soundId}`);
  const options = getRuntimeOptions(overrides);
  const assets = expandSoundAssets(found.sound, options.includeVariations);
  const totals = emptyResults();

  for (let index = 0; index < assets.length; index++) {
    const result = await generateSound(
      assets[index],
      outputCategoryFor(found.categoryName),
      options
    );
    addResult(totals, result);
    if (result.generated && index < assets.length - 1 && options.apiDelay > 0) {
      await options.sleep(options.apiDelay);
    }
  }

  return totals;
}

function listSounds(logger = console) {
  logger.log("\n=== ALL SOUNDS ===\n");
  let definitions = 0;
  let assets = 0;

  for (const [categoryName, categoryData] of Object.entries(SOUNDS)) {
    logger.log(`\n[Tier ${categoryData.tier}] ${categoryName}:`);
    for (const sound of categoryData.sounds) {
      const assetCount = expandSoundAssets(sound).length;
      logger.log(
        `  ${sound.id} (${sound.duration}s, ${assetCount} asset${assetCount === 1 ? "" : "s"}) - ${sound.filename}`
      );
      definitions++;
      assets += assetCount;
    }
  }

  logger.log(`\nTotal: ${definitions} definitions, ${assets} output assets`);
}

function countSounds() {
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const categoryData of Object.values(SOUNDS)) {
    counts[categoryData.tier] += categoryData.sounds.length;
  }
  return counts;
}

function optionValue(args, option) {
  const index = args.indexOf(option);
  return index === -1 ? undefined : args[index + 1];
}

function printHelp(logger = console) {
  logger.log(`
Usage: node generate.js [selection] [options]

Selections (choose one):
  --collection <name> Generate a safe aggregate collection
  --category <name>   Generate one exact definition category
  --single <id>       Generate one sound family by ID
  --tier <n>          Generate every category in tier n

Options:
  --base-only         Do not generate configured variations
  --dry-run           Show every output without API calls or writes
  --output-dir <path> Override the production audio output directory
  --force             Regenerate files that already exist
  --validate          Validate prompts, durations, IDs, and paths
  --list              List all sound definitions and asset counts
  --count             Show definition counts by tier
  --help, -h          Show this help

Collections: ${Object.keys(COLLECTIONS).join(", ")}
Categories: ${Object.keys(SOUNDS).join(", ")}

Examples:
  node generate.js --dry-run --collection weapon-ui
  node generate.js --force --collection weapons
  node generate.js --force --collection ui
  node generate.js --single weapon_t1 --base-only --output-dir /tmp/sfx-smoke

Use ELEVENLABS_API_KEY for authentication. Tier selections can include
destruction sounds; use the weapon-ui collection when refreshing weapons/UI.
`);
}

async function main(args = process.argv.slice(2), overrides = {}) {
  const logger = overrides.logger ?? console;

  if (args.includes("--help") || args.includes("-h")) {
    printHelp(logger);
    return 0;
  }

  logger.log("Galaxy Miner - ElevenLabs Sound Generator");
  logger.log("=========================================");

  if (args.includes("--validate")) {
    const errors = validateCatalog();
    if (errors.length > 0) {
      errors.forEach((error) => logger.error(`  [ERR] ${error}`));
      return 1;
    }
    logger.log("Catalog valid.");
    return 0;
  }

  if (args.includes("--list")) {
    listSounds(logger);
    return 0;
  }

  if (args.includes("--count")) {
    const counts = countSounds();
    logger.log("\nSound definition counts by tier:");
    logger.log(`  Tier 1: ${counts[1]}`);
    logger.log(`  Tier 2: ${counts[2]}`);
    logger.log(`  Tier 3: ${counts[3]}`);
    logger.log(`  Total: ${counts[1] + counts[2] + counts[3]}`);
    return 0;
  }

  const selections = ["--collection", "--category", "--single", "--tier"].filter(
    (option) => args.includes(option)
  );
  if (selections.length !== 1) {
    logger.error("Choose exactly one generation selection.");
    printHelp(logger);
    return 1;
  }

  const outputBase = optionValue(args, "--output-dir");
  if (args.includes("--output-dir") && !outputBase) {
    logger.error("--output-dir requires a path");
    return 1;
  }

  const options = getRuntimeOptions({
    ...overrides,
    outputBase: outputBase ? path.resolve(outputBase) : overrides.outputBase,
    forceRegenerate: args.includes("--force"),
    dryRun: args.includes("--dry-run"),
    includeVariations: !args.includes("--base-only"),
    logger,
  });

  try {
    let results;
    if (selections[0] === "--collection") {
      const collectionName = optionValue(args, "--collection");
      if (!COLLECTIONS[collectionName]) {
        logger.error(`Unknown collection: ${collectionName || "(missing)"}`);
        return 1;
      }
      results = await generateCollection(collectionName, options);
    } else if (selections[0] === "--category") {
      const categoryName = optionValue(args, "--category");
      if (!SOUNDS[categoryName]) {
        logger.error(`Unknown category: ${categoryName || "(missing)"}`);
        return 1;
      }
      results = await generateCategories([categoryName], options);
    } else if (selections[0] === "--single") {
      results = await generateSingle(optionValue(args, "--single"), options);
    } else {
      const tier = Number(optionValue(args, "--tier"));
      if (![1, 2, 3].includes(tier)) {
        logger.error("--tier must be 1, 2, or 3");
        return 1;
      }
      results = await generateByTier(tier, options);
    }
    return results.failed > 0 ? 1 : 0;
  } catch (error) {
    logger.error(error.message);
    return 1;
  }
}

module.exports = {
  CATEGORY_OUTPUT_MAP,
  COLLECTIONS,
  SOUNDS,
  buildApiRequest,
  countSounds,
  expandSoundAssets,
  findSound,
  generateCategory,
  generateCollection,
  generateSingle,
  generateSound,
  getCategoryAssets,
  getRuntimeOptions,
  looksLikeMp3,
  main,
  requestAudio,
  trimMp3ToActiveDuration,
  validateCatalog,
  writeFileAtomically,
};

if (require.main === module) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
