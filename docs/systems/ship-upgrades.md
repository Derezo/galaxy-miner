# Ship Upgrades System

Galaxy Miner has eight upgradeable ship components. Every component starts at tier 1 and can reach tier 5. `shared/constants.js` is the balance authority; the client upgrade panel derives its figures from those same constants, and `server/database.js` applies purchases atomically.

## Costs and purchase rules

| New tier | Credits |
| ---: | ---: |
| 2 | 100 |
| 3 | 400 |
| 4 | 3,000 |
| 5 | 9,000 |

Each component therefore costs 12,500 credits to take from tier 1 to tier 5, or 100,000 credits for all eight components. Credits and every listed resource are checked and deducted in one SQLite transaction. A failed purchase changes neither the ship nor its inventory.

The client requests an upgrade with:

```javascript
socket.emit('ship:upgrade', { component: 'engine' });
```

Valid component keys are `engine`, `weapon`, `shield`, `mining`, `cargo`, `radar`, `energy_core`, and `hull`. The server replies with `upgrade:success` or `upgrade:error`. The credit/resource debits, tier write, and response snapshot are produced in one transaction, so a response-snapshot failure rolls the purchase back. A success contains the authoritative post-purchase inventory and is followed by the same snapshot in `inventory:update`. The client keeps both the component button and terminal indicator disabled while a request is in flight. After an error or timeout, inventory-only events may refresh displayed balances but only `ship:data`, authentication, or a late authoritative success resolves the uncertain tier state.

## Authoritative component effects

### Engine

Maximum speed is:

```text
BASE_SPEED * TIER_MULTIPLIER^(tier - 1)
180 * 1.4^(tier - 1)
```

| Tier | Maximum speed |
| ---: | ---: |
| 1 | 180 u/s |
| 2 | 252 u/s |
| 3 | 353 u/s |
| 4 | 494 u/s |
| 5 | 691 u/s |

### Weapons

Base damage and base cooldown use the same 1.4 tier multiplier. The Energy Core reduction is applied after the weapon-tier cooldown calculation. Weapon range is an explicit per-tier table rather than a derived multiplier.

| Tier | Base damage | Base cooldown | Range |
| ---: | ---: | ---: | ---: |
| 1 | 10.0 | 500 ms | 200 |
| 2 | 14.0 | 357 ms | 210 |
| 3 | 19.6 | 255 ms | 360 |
| 4 | 27.4 | 182 ms | 400 |
| 5 | 38.4 | 130 ms | 400 |

Tier 5 enables the Tesla Cannon: the primary target and up to two chain targets receive 100%, 50%, and 25% damage respectively, with a 150-unit search range per jump.

### Shields

Shield capacity uses its own 2× multiplier:

```text
DEFAULT_SHIELD_HP * SHIELD_TIER_MULTIPLIER^(tier - 1)
60 * 2^(tier - 1)
```

| Tier | Shield capacity |
| ---: | ---: |
| 1 | 60 HP |
| 2 | 120 HP |
| 3 | 240 HP |
| 4 | 480 HP |
| 5 | 960 HP |

The base recharge rate is 2 HP/s after a 3-second damage delay. Energy Core adds its tier bonus to that rate.

### Mining Beam

Cycle time is `3000 ms / 1.4^(tier - 1)`. Yield is the explicit integer progression `1, 2, 3, 5, 8`. Mining range remains 50 units.

| Tier | Cycle time | Base yield |
| ---: | ---: | ---: |
| 1 | 3.00 s | 1 |
| 2 | 2.14 s | 2 |
| 3 | 1.53 s | 3 |
| 4 | 1.09 s | 5 |
| 5 | 0.78 s | 8 |

Mining Rites applies its 2× relic multiplier to this integer yield before the server caps the result to remaining cargo capacity.

### Cargo Hold

| Tier | Capacity |
| ---: | ---: |
| 1 | 100 |
| 2 | 250 |
| 3 | 500 |
| 4 | 750 |
| 5 | 2,000 |

Marketplace escrow counts toward cargo use. Mining, wreckage collection, team shares, and plunder all enforce capacity on the server.

### Radar

`RADAR_TIERS` is the canonical range table. Server broadcast range is twice the recipient's radar range.

| Tier | Radar range | Broadcast range | Feature level |
| ---: | ---: | ---: | --- |
| 1 | 500 | 1,000 | Basic object dots |
| 2 | 750 | 1,500 | Shapes and heading indicators |
| 3 | 1,125 | 2,250 | Faction identity and wormholes |
| 4 | 1,688 | 3,376 | Weapon fire, loot rarity, tooltips |
| 5 | 2,531 | 5,062 | Sector map, paths, threat zones |

### Energy Core

| Tier | Weapon cooldown reduction | Shield recharge bonus | Boost duration | Boost speed | Boost cooldown |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 5% | +1 HP/s | 1.00 s | 2.0× | 15 s |
| 2 | 10% | +2 HP/s | 1.25 s | 2.0× | 13 s |
| 3 | 15% | +3 HP/s | 1.50 s | 2.2× | 11 s |
| 4 | 20% | +4 HP/s | 1.75 s | 2.3× | 9 s |
| 5 | 25% | +5 HP/s | 2.00 s | 2.5× | 7 s |

The Subspace Warp Drive multiplies boost duration by 2.5 and boost cooldown by 0.75; separately, it makes wormhole transit 2.5× faster and multiplies that cooldown by 0.75. Active boost and cooldown state are server-owned and included in an authentication snapshot after reconnect; they are process-memory state rather than database rows.

### Hull

Hull maximum is `120 * 1.4^(tier - 1)` and is stored as a rounded integer. Damage-type resistance is capped at 50%.

| Tier | Hull HP | Kinetic | Energy | Explosive |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 120 | 5% | 8% | 3% |
| 2 | 168 | 10% | 15% | 6% |
| 3 | 235 | 15% | 22% | 9% |
| 4 | 329 | 20% | 28% | 12% |
| 5 | 461 | 25% | 35% | 15% |

## Exact resource requirements

### Engine

| Tier | Credits | Resources |
| ---: | ---: | --- |
| 2 | 100 | 5 Hydrogen, 3 Carbon |
| 3 | 400 | 12 Hydrogen, 5 Helium-3, 4 Titanium |
| 4 | 3,000 | 20 Helium-3, 10 Xenon, 5 Platinum |
| 5 | 9,000 | 15 Xenon, 3 Antimatter, 2 Exotic Matter |

### Weapons

| Tier | Credits | Resources |
| ---: | ---: | --- |
| 2 | 100 | 5 Iron, 3 Nickel |
| 3 | 400 | 6 Titanium, 5 Cobalt, 4 Copper |
| 4 | 3,000 | 8 Iridium, 5 Uranium, 8 Platinum |
| 5 | 9,000 | 12 Uranium, 5 Dark Matter, 2 Neutronium |

### Shields

| Tier | Credits | Resources |
| ---: | ---: | --- |
| 2 | 100 | 5 Silicon, 3 Sulfur |
| 3 | 400 | 6 Ice Crystals, 5 Lithium, 4 Silver |
| 4 | 3,000 | 6 Quantum Crystals, 8 Dark Matter, 10 Gold |
| 5 | 9,000 | 12 Quantum Crystals, 2 Void Crystals, 3 Exotic Matter |

### Mining Beam

| Tier | Credits | Resources |
| ---: | ---: | --- |
| 2 | 100 | 6 Iron, 3 Carbon |
| 3 | 400 | 8 Titanium, 5 Copper, 4 Cobalt |
| 4 | 3,000 | 10 Platinum, 6 Iridium, 8 Gold |
| 5 | 9,000 | 12 Iridium, 3 Neutronium, 5 Dark Matter |

### Cargo Hold

| Tier | Credits | Resources |
| ---: | ---: | --- |
| 2 | 100 | 6 Iron, 4 Nickel |
| 3 | 400 | 9 Titanium, 6 Copper, 3 Silver |
| 4 | 3,000 | 25 Titanium, 8 Platinum, 5 Iridium |
| 5 | 9,000 | 15 Iridium, 4 Neutronium, 1 Void Crystal |

### Radar

| Tier | Credits | Resources |
| ---: | ---: | --- |
| 2 | 100 | 4 Copper, 5 Silicon |
| 3 | 400 | 5 Silver, 6 Neon, 4 Lithium |
| 4 | 3,000 | 10 Gold, 5 Quantum Crystals, 8 Xenon |
| 5 | 9,000 | 10 Quantum Crystals, 4 Exotic Matter, 2 Void Crystals |

### Energy Core

| Tier | Credits | Resources |
| ---: | ---: | --- |
| 2 | 100 | 6 Hydrogen, 3 Phosphorus |
| 3 | 400 | 8 Helium-3, 6 Lithium, 2 Uranium, 8 Nitrogen |
| 4 | 3,000 | 10 Uranium, 6 Dark Matter, 20 Helium-3, 18 Nitrogen |
| 5 | 9,000 | 5 Antimatter, 3 Exotic Matter, 2 Neutronium |

### Hull

| Tier | Credits | Resources |
| ---: | ---: | --- |
| 2 | 100 | 8 Iron, 5 Nickel |
| 3 | 400 | 10 Titanium, 6 Cobalt, 10 Iron |
| 4 | 3,000 | 10 Iridium, 10 Platinum, 15 Titanium |
| 5 | 9,000 | 5 Neutronium, 15 Iridium, 1 Void Crystal |

## Persistence semantics

Purchased component tiers, cargo, credits, current/max health, and owned relics persist in SQLite. Short-lived action state such as boost windows, weapon cooldown maps, mining sessions, and plunder cooldowns is held by the authoritative server process. Reconnecting to that same process does not reset boost or plunder cooldowns, but a server process restart clears in-memory action state.

## Key files

| Responsibility | File |
| --- | --- |
| Balance and requirements | `shared/constants.js` |
| Atomic upgrade transaction | `server/database.js` |
| Upgrade socket validation | `server/socket/ship.js` |
| Client presentation | `client/js/ui/panels/ShipUpgradePanel.js` |

## See also

- [Resources](resources.md)
- [Relics](relics.md)
- [Socket events](../api/socket-events.md)
