# Relics System

Relics are permanent, unique-per-player artifacts. They are stored in the `relics` table and their gameplay values live in `shared/constants.js` under `RELIC_TYPES`. Combat, mining, loot, wormhole, respawn, and plunder effects are validated by the server; client relic state only controls presentation and input hints.

## Implemented relics

| Relic | Effect |
| --- | --- |
| Ancient Star Map | Shows up to 8 faction-base and boss bearings between normal radar range and 2× range as cyan-ticked edge diamonds. The server sends a sparse contact array every 500 ms and deliberately omits health, combat state, and loot. |
| Void Crystal | Adds 10% weapon damage against Void and Swarm NPCs and bases. The bonus also applies to chain-lightning damage after falloff. |
| Swarm Hive Core | Adds the nearest active Swarm hive as a death-respawn option. Choosing it destroys the host hive and triggers the configured 500-unit rejection effect; implosion, NPC-death, and wreckage events are delivered only within each recipient's radar broadcast range. |
| Pirate Treasure | Adds 10% to the owner's own NPC-wreckage credit share. Each teammate is checked independently, including when somebody else collects the wreckage. |
| Wormhole Gem | Unlocks wormhole destination selection and transit. |
| Scrap Siphon | Collects up to 3 eligible wreckages within 300 units at 50% of normal collection time. Completed collections still pass through the Scavenger theft hook, which observes the relic and suppresses rage. |
| Mining Rites | Multiplies integer mining yield by 2 before cargo capacity is applied. The former 5× value was reduced because it overwhelmed resource scarcity and upgrade pacing. |
| Skull and Bones | Plunders finite base reserves without destroying the base, subject to range, cargo, player cooldown, base cooldown, and faction aggro. |
| Subspace Warp Drive | Extends thrust-boost duration to 2.5× and applies a 0.75 boost-cooldown multiplier. Wormhole transit runs at 2.5× speed (5 s becomes 2 s) with a 0.75 transit-cooldown multiplier (60 s becomes 45 s). |

## Server-authoritative effect flow

Pure effect arithmetic is centralized in `server/game/relic-effects.js`. Ownership is read through the case-insensitive `hasRelic` query and cached for five seconds to keep database reads out of hot combat paths. A successful new relic insert invalidates that cache immediately.

- `server/game/engine.js` applies Void Crystal before NPC/base damage is committed.
- `server/game/mining.js` applies the configured Mining Rites multiplier, then caps the result to available cargo.
- `server/socket/helpers.js` calculates Pirate Treasure per recipient rather than increasing the shared team pool for non-owners.
- `server/socket/relic.js` owns plunder cooldowns, reserves, cargo allocation, and nearby broadcasts; `server/game/plunder-transactions.js` commits credits and all granted resource rows atomically.

Client-side descriptions and animations are not proof of ownership and cannot grant an effect.

## Skull and Bones plunder rules

Press `M` within 200 units of a base edge. A successful plunder starts a 15-second cooldown for that authenticated player and a 90-second alert cooldown for that base. Reconnecting does not clear either server-owned state.

Owned relics are durable SQLite state. Plunder cooldowns and finite combat-base reserves, active wormhole transit/cooldowns, and boost windows/cooldowns are authoritative but process-local maps. Reconnecting to the same process preserves that authority; authentication explicitly returns remaining plunder and boost timing. A server process restart clears those ephemeral maps and rebuilds active base lifecycle state. A multi-process deployment would need a shared state store before these mechanics could span workers safely.

Reserves are finite:

- Rogue Miner claims expose only their currently accumulated `claimCredits`; an empty claim does not generate fallback credits.
- Scavenger yards expose only resources and credits already present in their scrap pile. Cargo overflow remains in the pile.
- Pirate, Swarm, Void, and assimilated combat bases receive one finite resource-cache roll per base lifecycle plus a small type-specific credit reserve. Deactivating and reactivating the base does not reroll it.
- A real destruction/respawn or faction assimilation starts a new base lifecycle and therefore a new reserve.

Credits have no cargo cost. Resources are allocated in whole units up to the ship's current `CARGO_CAPACITY`; unclaimed finite-cache resources remain available after the base alert expires. A full cargo hold cannot consume a resources-only reserve. Nearby players receive the visual event through sector rooms rather than a global `io.emit`.

Successful plunder makes same-faction NPCs within 600 units hostile to the authenticated player.

## Acquisition and duplicate policy

Boss-tier faction loot can roll relics from its faction pool. Several encounters also have explicit drops:

- Barnacle King: Scrap Siphon
- Rogue Foreman: Mining Rites
- Pirate Dreadnought: Skull and Bones
- Void Leviathan: an additional 25% Subspace Warp Drive roll
- Destroyed Pirate Outpost: an additional 5% Pirate Treasure roll

The database enforces `UNIQUE(user_id, relic_type)`. `INSERT OR IGNORE` is inspected after every relic drop:

- A new row is returned in `results.relics` and immediately synchronized to the live client.
- A duplicate is returned in `results.duplicateRelics`, grants no second relic, and never produces a false “Relic acquired” notification.
- There is currently no duplicate conversion payout. This is deliberate: a future conversion policy must define its economy value before it is enabled.

## Storage

```sql
CREATE TABLE relics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relic_type TEXT NOT NULL,
  obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, relic_type)
);
```

Relics are returned with authentication data and copied into `Player.relics` and `UIState.relics`. `RelicsPanel` renders its effect text directly from shared metadata.

## Key files

| Responsibility | File |
| --- | --- |
| Definitions and balance | `shared/constants.js` |
| Pure server calculations | `server/game/relic-effects.js` |
| Combat integration | `server/game/engine.js` |
| Mining integration | `server/game/mining.js` |
| Credit shares and acquisition | `server/socket/helpers.js` |
| Plunder authority | `server/socket/relic.js` |
| Strategic radar feed | `server/game/engine.js`, `client/js/ui/radar/entities.js` |
| Atomic plunder rewards | `server/game/plunder-transactions.js` |
| Collection UI | `client/js/ui/panels/RelicsPanel.js` |

## See also

- [Loot Pools](loot-pools.md)
- [Resources](resources.md)
- [Wreckage System](wreckage-system.md)
- [NPC Factions](npc-factions.md)
