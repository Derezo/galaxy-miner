# Sound Generator Modules

This directory contains the procedural sound generators for Galaxy Miner's 8-bit audio system.

## Overview

Each module generates a category of game sounds using the core audio engine (`../core/`). All sounds are generated procedurally from mathematical waveforms, envelopes, and effects.

## Generator Modules

### 1. weapons.py (20 sounds)
Player weapon sounds across 5 tiers with variations:
- **Tier 1 - Burst Laser**: Short pulse wave bursts (3 variations)
- **Tier 2 - Dual Laser**: Double shots with delay (3 variations)
- **Tier 3 - Pulse Cannon**: Chunky bass-heavy blasts (3 variations)
- **Tier 4 - Beam Weapon**: Sustained sweeping beams (3 variations)
- **Tier 5 - Tesla Cannon**: Complex electrical arcs (5 variations)

Export path: `output/weapons/weapon_player_t{tier}_{variation}.wav`

### 2. npc_weapons.py (15 sounds)
Faction-specific weapon sounds (3 variations per faction):
- **Pirate**: Aggressive, distorted (100-800Hz)
- **Scavenger**: Unstable, sputtering (200-1200Hz)
- **Swarm**: Deep organic pulses (30-200Hz)
- **Void**: Ethereal, resonant (80-600Hz)
- **Rogue Miner**: Industrial, harsh (300-2000Hz)

Export path: `output/weapons/weapon_{faction}_{variation}.wav`

### 3. impacts.py (30 sounds)
Hit feedback sounds scaling with tier:
- **Shield Hits**: High-frequency pings, bitcrushed (5 tiers × 3 variations)
- **Hull Hits**: Low-frequency thuds, distorted (5 tiers × 3 variations)

Export paths:
- `output/impacts/hit_shield_t{tier}_{variation}.wav`
- `output/impacts/hit_hull_t{tier}_{variation}.wav`

### 4. destruction.py (25 sounds)
Death and explosion sounds:
- **Faction Deaths**: Per-faction characteristics × 3 sizes (small/medium/large)
  - Pirate: Metallic explosion with debris
  - Scavenger: Sputtering breakdown
  - Swarm: Organic squelch and dissolve
  - Void: Implosion with ethereal release
  - Rogue Miner: Industrial grinding
- **Player Death**: Epic 1.2-second multi-phase explosion

Export paths:
- `output/destruction/death_{faction}_{size}.wav`
- `output/destruction/death_player.wav`

### 5. bosses.py (8 sounds)
Swarm Queen boss sounds:
- **Phase Transitions**: 4 increasingly intense power-ups (1.3-2.2s each)
- **Web Snare**: Sticky organic capture
- **Acid Burst**: Sizzling corrosive spray
- **Roar**: Deep menacing growl with tremolo
- **Death Sequence**: 7.5-second dramatic multi-phase explosion

Export paths:
- `output/bosses/queen_phase_{1-4}.wav`
- `output/bosses/queen_{attack_type}.wav`
- `output/bosses/queen_death.wav`

### 6. mining.py (12 sounds)
Mining and resource collection:
- **Drill Sounds**: Loopable 1-second drills, tiers 1-5
- **Mining Complete**: Satisfying arpeggio chime
- **Cargo Warning**: Two-tone alert beep
- **Loot Pickups**: By rarity (common, uncommon, rare, ultrarare)

Export paths:
- `output/mining/drill_t{tier}.wav`
- `output/mining/complete.wav`
- `output/mining/cargo_warning.wav`
- `output/mining/loot_{rarity}.wav`

### 7. environment.py (10+ sounds)
Ambient and environmental effects:
- **Star Proximity**: 3 sizes - bass drones scaling with intensity
- **Wormhole Transit**: Swirling doppler effect (2s)
- **Wormhole Ambient**: Loopable ethereal hum
- **Comet Warning**: Approaching whoosh with beeps
- **Comet Collision**: Massive impact
- **Asteroid Crack**: Breaking rock sound
- **Engine Hum**: Loopable ambient
- **Space Ambient**: Deep space atmosphere

Export path: `output/environment/{type}.wav`

### 8. ui.py (19 sounds)
User interface feedback:
- **Chat**: Receive notification
- **Notifications**: Error, warning, success, info
- **Panels**: Open/close whooshes
- **Market**: Buy, sell, list, cancel
- **Upgrades**: Purchase fanfare
- **Relics**: Mystical chime
- **Buttons**: Click, hover
- **Controls**: Tab switch, slider tick, toggle on/off

Export path: `output/ui/{type}.wav`

### 9. movement.py (12 sounds)
Ship movement and physics:
- **Engine Thrust**: Loopable tiers 1-5 (escalating power)
- **Boost**: Activation + sustain loop
- **Shields**: Recharge buildup, absorption crackle
- **Engine Control**: Start, stop
- **Collision**: Impact sound

Export paths:
- `output/movement/engine_t{tier}.wav`
- `output/movement/boost_{type}.wav`
- `output/movement/shield_{type}.wav`
- `output/movement/{action}.wav`

## Usage

### Generate All Sounds
```bash
python main.py
```

### Generate Specific Category
```bash
python main.py --category weapons
python main.py --category bosses
```

### List Categories
```bash
python main.py --list
```

### Run Individual Generator
```bash
python -m generators.weapons
python -m generators.ui
```

## Design Principles

### 8-Bit Aesthetic
- Bitcrush effects (4-6 bits typically)
- Simple waveforms (square, pulse, sawtooth, triangle)
- Noise generators for texture
- No sample-based synthesis

### Procedural Generation
- All sounds generated from code
- Deterministic with variation parameters
- No external audio files required
- Instant regeneration with tweaks

### Performance Scaling
- Tier-based sounds scale in power/complexity
- Consistent duration patterns for animations
- Loopable sounds have crossfades
- Appropriate sample rates (44.1kHz)

### Faction Identity
- Each NPC faction has sonic signature
- Consistent characteristics across categories
- Pirate: aggressive, metallic
- Scavenger: unstable, erratic
- Swarm: organic, low frequency
- Void: ethereal, resonant
- Rogue Miner: industrial, harsh

## Sound Budget

Total: ~151 sounds across 9 categories

| Category      | Count | Notes                           |
|---------------|-------|---------------------------------|
| weapons       | 20    | Player weapons, all tiers       |
| npc_weapons   | 15    | 5 factions × 3 variations      |
| impacts       | 30    | Shield + hull × tiers          |
| destruction   | 25    | Faction deaths + player        |
| bosses        | 8     | Queen-specific sounds          |
| mining        | 12    | Drills, pickups, completion    |
| environment   | 10+   | Ambient and hazards            |
| ui            | 19    | Interface feedback             |
| movement      | 12    | Engines, boost, shields        |

## Core Dependencies

All generators depend on modules in `../core/`:
- `oscillators.py` - Waveform generation
- `envelopes.py` - Amplitude shaping
- `effects.py` - Audio processing
- `mixer.py` - Layer mixing and normalization
- `export.py` - WAV file export

## File Organization

```
generators/
├── __init__.py           # Package initialization
├── README.md             # This file
├── weapons.py            # Player weapons
├── npc_weapons.py        # Faction weapons
├── impacts.py            # Hit sounds
├── destruction.py        # Explosions
├── bosses.py             # Boss sounds
├── mining.py             # Mining/loot
├── environment.py        # Ambient/hazards
├── ui.py                 # Interface
└── movement.py           # Ship movement

output/                   # Generated WAV files
├── weapons/
├── impacts/
├── destruction/
├── bosses/
├── mining/
├── environment/
├── ui/
└── movement/
```

## Extending

To add a new sound category:

1. Create `generators/new_category.py`
2. Implement `generate_all()` function
3. Add individual generator functions
4. Import in `generators/__init__.py`
5. Register in `main.py` CATEGORIES dict
6. Update this README

## Technical Notes

- Sample rate: 44100 Hz
- Bit depth: 16-bit PCM (WAV export)
- Loopable sounds: 1-2 second duration with crossfades
- One-shot sounds: 0.05-2.0 second duration
- Boss death sequence: 7.5 seconds (longest sound)
- All sounds normalized to -1 to -18 dB depending on type
