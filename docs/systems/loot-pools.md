# Loot Pools System

NPC and faction-base wreckage uses a centralized faction-first generator in `server/game/loot-pools.js`. A source type selects a faction and difficulty template; the template determines slot counts and rarity weights; the faction determines which resources, buffs, components, and relics can fill those rolls.

Credits are attached by the NPC/base reward flow outside this module. Collection, cargo limits, team allocation, relic ownership, and durable inventory writes are handled by the server socket helpers.

## Generation flow

```text
NPC/base type
  -> faction + tier mapping
  -> guaranteed and bonus resource slots
  -> rarity roll restricted to non-empty faction buckets
  -> resource selection and quantity roll
  -> duplicate resources combined
  -> independent buff/component/relic rolls
  -> encounter-specific relic rolls
```

Rarity weights are renormalized over buckets that the faction can actually supply. This matters for Void enemies, whose common bucket is empty: a common result cannot silently erase a guaranteed slot.

## Faction pools

| Faction | Common | Uncommon | Rare | Ultrarare |
| --- | --- | --- | --- | --- |
| Pirate | Iron, Carbon, Nickel | Copper, Titanium, Helium-3 | Platinum, Dark Matter, Quantum Crystals | Exotic Matter, Antimatter |
| Scavenger | Iron, Nickel, Silicon | Copper, Silver, Cobalt, Lithium | Gold, Platinum, Iridium | Exotic Matter |
| Swarm | Carbon, Phosphorus, Nitrogen, Hydrogen, Sulfur | Helium-3, Ice Crystals | Dark Matter, Quantum Crystals | Exotic Matter, Antimatter, Void Crystals |
| Void | None | Neon | Xenon, Dark Matter, Quantum Crystals | Exotic Matter, Antimatter, Neutronium, Void Crystals |
| Rogue Miner | Iron, Silicon | Copper, Titanium, Cobalt, Lithium | Gold, Uranium, Iridium, Platinum, Quantum Crystals | Exotic Matter |

| Faction | Buff pool | Component pool | Boss relic pool |
| --- | --- | --- | --- |
| Pirate | Shield Boost, Speed Burst, Damage Amp | Engine Core, Weapon Matrix | Pirate Treasure, Skull and Bones |
| Scavenger | Shield Boost, Speed Burst | Mining Capacitor, Engine Core | Pirate Treasure, Ancient Star Map, Scrap Siphon |
| Swarm | Speed Burst, Damage Amp | Engine Core, Mining Capacitor | Swarm Hive Core |
| Void | Damage Amp, Radar Pulse | Weapon Matrix, Shield Cell | Void Crystal, Wormhole Gem, Ancient Star Map, Subspace Warp Drive |
| Rogue Miner | Shield Boost, Radar Pulse | Mining Capacitor, Shield Cell | Ancient Star Map, Pirate Treasure, Mining Rites |

## Tier templates

Each bonus slot rolls independently. Resource results from multiple slots are combined by type before wreckage is spawned.

| Tier | Guaranteed slots | Bonus slots | Rarity weights (C/U/R/UR) | Buff | Component | Faction relic |
| --- | ---: | --- | --- | ---: | ---: | ---: |
| Low | 1 | 2 at 80% each | 60% / 35% / 5% / 0% | 5% | 1% | None |
| Mid | 2 | 2 at 85% each | 40% / 45% / 14% / 1% | 15% | 5% | None |
| High | 2 | 3 at 90% each | 20% / 45% / 30% / 5% | 25% | 10% | None |
| Boss | 3 | 3 at 95% each | 10% / 30% / 45% / 15% | 50% | 30% | 15% |
| Base | 2 | 2 at 70% each | 5% / 15% / 60% / 20% | 40% | 50% | None |

Quantity ranges depend on the selected rarity:

| Tier | Common | Uncommon | Rare | Ultrarare |
| --- | --- | --- | --- | --- |
| Low | 2–5 | 1–3 | 1–2 | 1 |
| Mid | 2–6 | 2–4 | 1–3 | 1 |
| High | 3–6 | 2–5 | 2–4 | 1–2 |
| Boss | 3–8 | 3–6 | 2–5 | 1–3 |
| Base | 1–2 | 2–4 | 3–8 | 1–3 |

The 15% boss relic roll selects one entry uniformly from that faction's boss relic pool. Bases do not use the generic relic roll, though the Pirate Outpost has an explicit Pirate Treasure chance described below.

## NPC and base mapping

| Faction | Low | Mid | High | Boss | Base |
| --- | --- | --- | --- | --- | --- |
| Pirate | Pirate Scout | Pirate Fighter | Pirate Captain | Pirate Dreadnought | Pirate Outpost |
| Scavenger | Scavenger Scrapper, Scavenger Salvager | Scavenger Collector | Scavenger Hauler | Barnacle King | Scavenger Yard |
| Swarm | Swarm Drone, Swarm Worker | Swarm Warrior | — | Swarm Queen | Swarm Hive |
| Void | Void Whisper | Void Shadow | Void Phantom | Void Leviathan | Void Rift |
| Rogue Miner | Rogue Prospector | Rogue Driller | Rogue Excavator | Rogue Foreman | Mining Claim |

An `assimilated_*` source is treated as a Swarm base for rewards even when it retains the geometry of its original hub.

## All relic acquisition sources

All nine defined relics are obtainable from the live loot tables.

| Relic | Sources |
| --- | --- |
| Ancient Star Map | Scavenger, Void, or Rogue Miner boss faction-relic roll |
| Void Crystal | Void boss faction-relic roll |
| Swarm Hive Core | Swarm Queen faction-relic roll |
| Pirate Treasure | Pirate, Scavenger, or Rogue Miner boss faction-relic roll; destroyed Pirate Outpost has an additional 5% roll |
| Wormhole Gem | Void boss faction-relic roll |
| Scrap Siphon | Scavenger boss faction-relic roll; guaranteed in Barnacle King loot |
| Mining Rites | Rogue Miner boss faction-relic roll; guaranteed in Rogue Foreman loot |
| Skull and Bones | Pirate boss faction-relic roll; guaranteed in Pirate Dreadnought loot |
| Subspace Warp Drive | Void boss faction-relic roll; Void Leviathan has an additional independent 25% roll |

Relics are unique per player in SQLite. A duplicate does not create a second owned relic or a conversion payout; see [Relics](relics.md).

## Team allocation

Damage contributors define the reward team. Credit and item allocation follow different rules:

- Credits use the configured team pool multiplier: 1× for one contributor, 1.5× for two, 2× for three, and 2.5× for four or more. The integer pool is divided across contributors without rounding inflation. Any remainder is distributed deterministically.
- Pirate Treasure is applied to each recipient's own credit share, not to the shared pool for players who do not own it.
- With no contribution record, the collector is treated as the solo credit owner.
- Common and uncommon resources are divided across damage contributors. The contributing collector receives the remainder; if the collector did not contribute, the first contributor receives it.
- Rare and ultrarare resources, buffs, components, and relics go to the collector. Teammates receive a rare-drop notification.
- Every resource share is capped independently by its recipient's server-authoritative cargo space. Rejected or overflow units remain in the wreckage settlement instead of disappearing.
- Credits do not consume cargo capacity.

For example, a three-contributor wreckage with 100 base credits creates a 200-credit team pool before owner-specific Pirate Treasure bonuses. A stack of common Iron is split among the three contributors, while a rare Iridium stack remains with the collector.

## Loot item format

```javascript
[
  { type: 'credits', amount: 100 },
  { type: 'resource', resourceType: 'IRON', quantity: 8, rarity: 'common' },
  { type: 'buff', buffType: 'SHIELD_BOOST' },
  { type: 'component', componentType: 'WEAPON_MATRIX' },
  { type: 'relic', relicType: 'VOID_CRYSTAL' }
]
```

`generateLoot(npcType)` produces resource and special-item entries. Credits are supplied by the calling combat/base system.

## Extending the system

1. Define the NPC/base combat type in the appropriate faction system.
2. Add its faction and tier to `NPC_LOOT_MAPPING`.
3. Reuse an existing faction pool, or deliberately update `FACTION_LOOT` and the resource-economy documentation.
4. Add focused generation and acquisition tests. Empty rarity buckets must remain safe.

## Key files

| Responsibility | File |
| --- | --- |
| Faction pools, templates, mapping | `server/game/loot-pools.js` |
| Wreckage lifecycle | `server/game/loot.js` |
| Team allocation and durable collection | `server/socket/helpers.js` |
| Faction and item definitions | `shared/constants.js` |
| NPC/base reward integration | `server/game/npc.js`, `server/game/engine.js` |

## See also

- [Relics](relics.md)
- [Resources](resources.md)
- [Wreckage](wreckage-system.md)
- [NPC Factions](npc-factions.md)
