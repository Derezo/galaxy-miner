# Resources System

Galaxy Miner has 27 resources across four rarity bands. Resources are whole cargo units used for ship upgrades, traded through the marketplace, mined from deterministic world objects, and recovered from faction wreckage. `shared/constants.js` is authoritative for names, categories, values, and upgrade requirements.

## Economic roles

Every resource now has at least one concrete upgrade sink. Common and uncommon materials establish component identity, rare materials specialize tier-4 builds, and ultrarare materials gate tier 5.

| Resource | Rarity | Base value | Primary upgrade role |
| --- | --- | ---: | --- |
| Iron | Common | 5 | Weapons, mining gear, cargo frames, hulls |
| Carbon | Common | 5 | Early engines and mining assemblies |
| Silicon | Common | 6 | Early shields and radar electronics |
| Hydrogen | Common | 4 | Engines and energy cores |
| Phosphorus | Common | 5 | Tier-2 energy core |
| Nickel | Common | 5 | Weapons, cargo plating, hulls |
| Sulfur | Common | 6 | Tier-2 shields |
| Nitrogen | Common | 4 | Tier-3 and tier-4 energy-core coolant (8 and 18 units) |
| Copper | Uncommon | 15 | Weapons, mining, cargo, radar |
| Titanium | Uncommon | 20 | Broad tier-3 structural material and tier-4 frames |
| Helium-3 | Uncommon | 25 | Engines and energy cores |
| Ice Crystals | Uncommon | 18 | Tier-3 shields |
| Silver | Uncommon | 18 | Shields, cargo, radar |
| Cobalt | Uncommon | 22 | Weapons, mining equipment, hulls |
| Lithium | Uncommon | 20 | Shields, radar, energy cores |
| Neon | Uncommon | 15 | Tier-3 radar |
| Platinum | Rare | 50 | Broad tier-4 component catalyst |
| Dark Matter | Rare | 75 | Tier-4/5 weapons, shields, mining, energy cores |
| Quantum Crystals | Rare | 100 | Advanced shields and radar |
| Gold | Rare | 60 | Tier-4 shields, mining, radar |
| Uranium | Rare | 80 | Advanced weapons and energy cores |
| Iridium | Rare | 90 | Advanced weapons, mining, cargo, hulls |
| Xenon | Rare | 70 | Advanced engines and radar |
| Exotic Matter | Ultrarare | 200 | Tier-5 engines, shields, radar, energy cores |
| Antimatter | Ultrarare | 300 | Tier-5 engines and energy cores |
| Neutronium | Ultrarare | 250 | Tier-5 weapons, mining, cargo, energy cores, hulls |
| Void Crystals | Ultrarare | 350 | Tier-5 shields, cargo, radar, hulls |

Nitrogen previously had flavor text and drop sources but no consumption path. Its 26-unit cumulative energy-core requirement makes Swarm common drops relevant to high-energy builds without adding a new table or crafting subsystem.

## Mining

- Base range: 50 world units, with the configured orbital-position tolerance applied by the server.
- Base completion time: 3000 ms.
- Mining cycle time improves through `TIER_MULTIPLIER`; base yield uses the explicit per-tier sequence 1, 2, 3, 5, and 8.
- Mining Rites applies its shared 2× multiplier to the integer yield. This replaces the former hard-coded 5× multiplier, which compressed progression and flooded common-resource supply.
- Final yield is capped to free cargo space before inventory mutation.
- A successfully mined object is depleted authoritatively and respawns after the configured 30–60 minute window.

Client and server procedural generation use the same `GALAXY_ALPHA_2025` seed. Effect code must not generate extra sectors from rendering or input loops.

Generated StarSystem planets retain a finite initial snapshot, while live stars, planets, orbital bases, and belt asteroids resolve analytically from their owning system at a shared physics time. Binary stars carry explicit primary/secondary roles on both sides. A mining request is rejected if the server cannot resolve a finite authoritative target position; client coordinates may only be used inside the configured synchronization tolerance.

Comet definitions are exposed to every sector overlapped by the deterministic bounds of their Bezier path. Client visibility and server hazard processing deduplicate overlapping sector entries by the comet's stable ID, so an object is rendered and applied at most once per frame or server update.

### Planet rarity distribution

Each planet resource slot uses one deterministic random draw. That single draw chooses both the rarity band and the item within the band, so changing from the old uniform selection does not shift later procedural-generation draws.

| Rarity | Probability per slot |
| --- | ---: |
| Common | 65% |
| Uncommon | 23% |
| Rare | 9% |
| Ultrarare | 3% |

Pools are derived from `RESOURCE_TYPES[*].rarity` rather than duplicated resource lists. If a rarity pool is empty, its probability is redistributed proportionally across the available pools. An entirely empty resource definition produces no resources; legacy definitions with resource keys but no rarity metadata fall back to uniform selection.

## Cargo invariants

Capacity is set by cargo tier: 100, 250, 500, 750, and 2000 units for tiers 1–5. Inventory resources are non-negative integers.

Mining and Skull and Bones plunder both calculate remaining capacity on the server. Plunder divides a reserve into granted and unclaimed portions without mutating the input calculation or losing overflow; a resources-only plunder cannot consume a reserve when cargo is full.

Wreckage team distribution keeps common/uncommon materials shareable while rare/ultrarare drops remain with the collector. Credit rewards are separate from cargo capacity.

## Faction supply identities

- Pirates: structural metals, trade metals, and stolen exotic stock.
- Scavengers: salvage metals and high-value recovered alloys.
- Swarm: organic gases and crystals, including the main common Nitrogen supply.
- Void: no common resource pool; anomaly gases, exotics, and Void Crystals.
- Rogue Miners: industrial metals, mining catalysts, and advanced crystals.

These identities make hunting and trade routes part of upgrade planning instead of making every faction an interchangeable resource source.

## Values and trading

`RESOURCE_TYPES[*].baseValue` is a reference valuation: the cargo UI uses it to estimate inventory value and prefill a suggested listing price, and the server-side price helper falls back to it when no listing exists. It is not an NPC buyback price or a guaranteed payout. Marketplace sellers choose a positive integer price per unit, so completed exchange prices can diverge with supply and demand. Listings escrow cargo, and listing, purchase, and cancellation mutations are validated and committed atomically by the server.

## Key files

| Responsibility | File |
| --- | --- |
| Definitions and upgrade sinks | `shared/constants.js` |
| Deterministic world resources | `shared/resource-selection.js`, `shared/star-system.js`, `server/world.js`, `client/js/world.js` |
| Mining authority | `server/game/mining.js` |
| Faction drop supply | `server/game/loot-pools.js` |
| Cargo and inventory persistence | `server/database.js` |
| Upgrade purchase validation | `server/socket/ship.js` |

## See also

- [Ship Upgrades](ship-upgrades.md)
- [Relics](relics.md)
- [Loot Pools](loot-pools.md)
- [Wreckage System](wreckage-system.md)
