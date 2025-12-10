# Galaxy Miner Development Roadmap

**Last Updated:** December 9, 2025
**Version:** 1.0

This roadmap outlines the planned development direction for Galaxy Miner, organized by priority and implementation phases. Features are designed to enhance multiplayer social gameplay and expand content depth while maintaining the game's focus on emergent player-driven experiences.

---

## Table of Contents

1. [Immediate Post-Refactor](#immediate-post-refactor)
2. [Phase 1: Multiplayer & Social (High Priority)](#phase-1-multiplayer--social-high-priority)
3. [Phase 2: Content Expansion (High Priority)](#phase-2-content-expansion-high-priority)
4. [Phase 3: Profile & Account Systems](#phase-3-profile--account-systems)
5. [Phase 4: Mobile & Accessibility](#phase-4-mobile--accessibility)
6. [Phase 5: Future Considerations](#phase-5-future-considerations)

---

## Immediate (Post-Refactor)

These items address existing systems that are partially implemented or need immediate attention.

### Technical Debt: Duplicate Network Handler Definitions

**Status:** Critical architectural issue identified
**Priority:** Critical
**Estimated Effort:** 1-2 days

**Description:**
The client networking code has duplicate socket event handlers defined in two locations:
- `/client/js/network.js` - Main network module (actively used)
- `/client/js/network/npc.js` - Modular handler file (NOT being used)

This caused a significant bug where `miningTargetPos` was being sent correctly by the server but silently dropped on the client because `network.js:276` builds its own `npcData` object and was missing the `miningTargetPos` field. The `network/npc.js` file had the correct implementation but wasn't being loaded.

**Issues Caused:**
- Rogue miner mining beams not rendering (took extensive debugging to identify)
- Confusion about which handler is authoritative
- Risk of similar bugs when adding new NPC properties

**Resolution Options:**

**Option A: Consolidate to network.js (Quick fix)**
- Remove `/client/js/network/` directory entirely
- Ensure all socket handlers are in `/client/js/network.js`
- Simpler architecture, single source of truth

**Option B: Migrate to modular handlers (Better long-term)**
- Update `network.js` to import and register handlers from `/client/js/network/*.js`
- Remove duplicate handler definitions from `network.js`
- Each module handles its own events (npc.js, player.js, combat.js, etc.)
- Better separation of concerns, easier to maintain

**Recommended:** Option B - The modular structure is cleaner, but requires ensuring the module files are actually loaded and registered.

**Files Affected:**
- `/client/js/network.js` - Remove duplicate handlers or convert to import-based
- `/client/js/network/npc.js` - Already has correct handler, needs to be loaded
- `/client/index.html` - May need script imports for network modules

---

### Fleet/Party System UI and Mechanics

**Status:** Foundation exists (team damage tracking), needs UI and formal mechanics
**Priority:** Critical
**Estimated Effort:** 3-4 weeks

**Description:**
Implement a formal fleet/party system that allows players to group together for cooperative play. The damage contribution system in `loot.js` already tracks team participation, but lacks UI and structured team management.

**Implementation Details:**
- Fleet creation and invite system (socket events: `fleet:create`, `fleet:invite`, `fleet:accept`, `fleet:leave`)
- Fleet roster UI panel showing member names, ships, health bars, and positions
- Fleet-only chat channel separate from global chat
- Shared fleet marker on radar for easy member tracking
- Auto-team damage distribution (already partially implemented)
- Fleet leader designation with kick/promote capabilities
- Maximum fleet size: 4 players (balanced for boss fights)

**Database Changes:**
```sql
CREATE TABLE fleets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  leader_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fleet_members (
  fleet_id INTEGER NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(fleet_id, user_id)
);
```

**New Socket Events:**
- `fleet:create` - Create a new fleet
- `fleet:invite` - Invite player to fleet
- `fleet:accept` / `fleet:decline` - Respond to invitation
- `fleet:leave` - Leave current fleet
- `fleet:kick` - Leader removes member
- `fleet:chat` - Fleet-only chat message
- `fleet:update` - Broadcast fleet roster changes

---

### Component Crafting System (Tier 6+ Upgrades)

**Status:** Database table exists, no implementation
**Priority:** High
**Estimated Effort:** 2-3 weeks

**Description:**
Enable progression beyond tier 5 using rare upgrade components. Components drop from NPCs (especially bosses) and can be crafted into tier 6+ upgrades. This extends the upgrade progression system defined in `CONSTANTS.COMPONENT_TYPES` and utilizes the existing `components` database table.

**Implementation Details:**
- Components drop from mid-tier and boss NPCs (defined in `loot-pools.js`)
- Four component types: Engine Core, Weapon Matrix, Shield Cell, Mining Capacitor
- Tier 6-10 upgrades require both credits and specific component quantities
- New "Components" inventory tab in terminal UI
- Crafting UI shows requirements and allows upgrade if materials are available
- Component trading on marketplace (new item category)

**Upgrade Requirements (Example - Tier 6 Weapon):**
- 3x Weapon Matrix (rare drop from pirate_captain, pirate_dreadnought)
- 20,000 credits
- 50x Iridium, 20x Uranium, 10x Neutronium

**New UI Components:**
- `ComponentsPanel.js` - Displays component inventory with icons
- Extended `ShipUpgradePanel.js` - Shows tier 6+ requirements and crafting

**Loot Pool Integration:**
- Update `loot-pools.js` to include component drops for boss-tier NPCs
- Component drop rates: ~5% for mid-tier, ~15% for bosses, ~30% for queens

---

### Relic Activation Effects

**Status:** Relic system exists, effects dormant
**Priority:** Medium
**Estimated Effort:** 2 weeks

**Description:**
Activate the relic system with specific gameplay effects. Relics are ultra-rare collectibles defined in `CONSTANTS.RELIC_TYPES` and stored in the `relics` database table. Currently, they are collectible but have no mechanical impact.

**Implementation Details:**

**Ancient Star Map:**
- Effect: Reveals all faction bases and wormholes within 5 sectors on radar
- Activation: Passive (always active when owned)
- UI: Enhanced radar overlay showing hidden locations

**Void Crystal:**
- Effect: +10% damage against Void Entities and Swarm
- Activation: Passive
- Implementation: Damage modifier in `combat.js`

**Swarm Hive Core:**
- Effect: Immunity to Swarm aggro (Swarm NPCs ignore player)
- Activation: Toggle on/off in Relics panel
- Implementation: AI aggro checks skip player with active effect

**Pirate Treasure:**
- Effect: Unlocks "Pirate Reputation" system (future expansion hook)
- Activation: Passive
- Current: Placeholder for future faction reputation mechanics

**Wormhole Gem:**
- Effect: Allows instant wormhole transit without position snap (smooth travel)
- Activation: Automatic when near wormhole
- Implementation: Already partially implemented in `wormhole.js`, needs activation check

**New UI:**
- `RelicsPanel.js` - Gallery view of collected relics with activation toggles
- Relic tooltip on radar for activated effects
- Active relic indicator in HUD

---

## Phase 1: Multiplayer & Social (High Priority)

Focus on features that promote player interaction, cooperation, and emergent social gameplay.

### Fleet Formation System with Shared Buffs

**Priority:** High
**Estimated Effort:** 3-4 weeks
**Dependencies:** Fleet/Party System UI

**Description:**
Advanced fleet mechanics that provide tactical advantages for coordinated play. Fleets that maintain formation receive shared buffs based on fleet composition and positioning.

**Formation Types:**

**Diamond Formation (4 players):**
- Leader at front, 2 flankers, 1 rear guard
- Buff: +15% shield recharge for all members
- Maintained when within 200 units of formation positions

**Line Formation (2-4 players):**
- All players in horizontal line
- Buff: +20% weapon range
- Good for defensive positions

**Wedge Formation (3-4 players):**
- V-shaped attack formation
- Buff: +10% damage, +15% speed
- Aggressive formation for boss fights

**Formation Mechanics:**
- Visual indicators for formation positions on radar
- Real-time formation integrity percentage (affects buff strength)
- Breaking formation loses buff after 5 seconds
- Auto-formation suggestion based on fleet size

**Implementation:**
- New module: `/server/game/formations.js`
- Formation state tracking in fleet data structure
- Buff application in `combat.js` and ship movement calculations
- Client-side formation overlay renderer in `/client/js/graphics/formations.js`

---

### Team Chat Channels

**Priority:** High
**Estimated Effort:** 1 week
**Dependencies:** Fleet/Party System UI

**Description:**
Dedicated chat channels for fleet members, separate from global chat. Reduces chat noise and enables private team coordination.

**Features:**
- `/fleet` command or dedicated fleet chat tab in chat UI
- Fleet messages highlighted with distinct color (cyan)
- Fleet chat history persisted during session
- "Player is typing..." indicator for fleet members
- Quick chat macros for common callouts ("Help!", "Incoming!", "On my way")

**Implementation:**
- Extend `chat.js` (client) and socket chat handlers (server)
- Filter chat messages by channel in `UIState`
- New socket events: `fleet:chat:send`, `fleet:chat:message`

---

### Friend List and Invite System

**Priority:** Medium
**Estimated Effort:** 2-3 weeks

**Description:**
Persistent friend list with online status tracking, direct invites, and friend-specific features. Lays foundation for future social features.

**Features:**
- Add/remove friends via username search
- Friend requests with accept/decline
- Friend list panel showing online/offline status
- Last seen timestamp for offline friends
- "Invite to Fleet" button for online friends
- Whisper/DM system for private messaging
- Friend location indicator on radar (if in same sector)

**Database Schema:**
```sql
CREATE TABLE friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, blocked
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, friend_id)
);

CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_status ON friendships(status);
```

**UI Components:**
- `FriendsPanel.js` - Friend list with status indicators
- Friend request notifications (toast notifications)
- Online friends indicator in HUD

**Socket Events:**
- `friend:add` - Send friend request
- `friend:accept` - Accept request
- `friend:remove` - Unfriend
- `friend:status` - Online/offline status updates
- `friend:whisper` - Private message

---

### Cooperative Mission System

**Priority:** Medium
**Estimated Effort:** 4-6 weeks
**Dependencies:** Fleet System, Events System (partially exists in `/server/game/events.js`)

**Description:**
Procedurally generated cooperative objectives that reward fleet teamwork. Missions spawn dynamically based on fleet activity and provide structured goals beyond free-roam mining/combat.

**Mission Types:**

**Faction Base Assault:**
- Objective: Destroy enemy faction base within time limit
- Requirements: 2-4 players
- Rewards: Bonus credits (split), guaranteed component drop, rare resources
- Difficulty scales with fleet size and average ship tier

**Mining Expedition:**
- Objective: Collect specific rare resources from hazardous sectors
- Requirements: 1-4 players
- Hazards: High NPC density, environmental dangers (star proximity, comets)
- Rewards: 2x resource multiplier, XP bonus (future expansion)

**Convoy Escort:**
- Objective: Escort NPC trader convoy across 3 sectors
- Requirements: 2-4 players
- Enemies: Waves of pirate ambushes
- Rewards: High credits, reputation (future), rare loot

**Queen Hunt:**
- Objective: Locate and defeat Swarm Queen
- Requirements: 3-4 players recommended
- Challenge: Multi-phase boss fight with mechanics (already implemented)
- Rewards: Guaranteed relic drop, ultrarare components, 5000 credits split

**Rescue Operation:**
- Objective: Retrieve stranded NPC from dangerous location
- Requirements: 1-2 players
- Mechanics: Tow/escort mechanics (tractor beam extended use)
- Rewards: Faction reputation, unique ship cosmetics

**Implementation:**
- Extend `/server/game/events.js` into full mission system
- Mission board UI panel (similar to marketplace)
- Mission state tracking in fleet data
- Dynamic mission spawning based on server population and activity
- Mission progress HUD overlay
- Completion notification with loot distribution

**Database Schema:**
```sql
CREATE TABLE active_missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fleet_id INTEGER REFERENCES fleets(id) ON DELETE CASCADE,
  mission_type TEXT NOT NULL,
  objective_data TEXT NOT NULL, -- JSON blob
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);
```

---

### Shared Resource Trading Within Fleets

**Priority:** Low
**Estimated Effort:** 1-2 weeks
**Dependencies:** Fleet System

**Description:**
Instant resource/credit transfers between fleet members without marketplace fees. Enables cooperative resource pooling and mutual aid.

**Features:**
- "Gift" button in cargo panel when in fleet
- Select fleet member and resource quantity to transfer
- No transaction fees (bypasses marketplace)
- Transfer history log in fleet panel
- Anti-abuse: Max 1000 credits or 100 resources per transfer per minute
- Confirmation dialog for large transfers (>500 credits or >50 resources)

**Implementation:**
- New socket events: `fleet:transfer:request`, `fleet:transfer:confirm`
- Transfer validation in server-side fleet module
- Update `inventory.js` handlers to support fleet transfers
- Transfer animation/notification in UI

---

## Phase 2: Content Expansion (High Priority)

Expand gameplay variety through new factions, ship customization, and progression depth.

### New NPC Faction: Nomad Traders

**Priority:** High
**Estimated Effort:** 3-4 weeks

**Description:**
Neutral faction focused on trading and commerce. Unlike hostile factions, Nomad Traders provide mobile trading opportunities and rare goods in remote sectors.

**Faction Details:**
- **Behavior:** Non-hostile, wanders between sectors with rare goods
- **Spawn Hub:** `nomad_caravan` (mobile, moves between systems)
- **AI Strategy:** `wanderer` (new AI module, navigates star lanes)
- **Ships:** `nomad_merchant`, `nomad_guard`, `nomad_hauler`
- **Interaction:** Trading UI when within range (no combat unless attacked)
- **Goods:** Sells rare resources at 1.5x marketplace price, buys common resources at 0.8x
- **Special:** Occasionally sells exclusive cosmetic items and ship decals

**Implementation:**
- New AI module: `/server/game/ai/wanderer.js`
- Trading interaction system (extends marketplace logic)
- Faction color palette: earthy tones (browns, tans)
- Peaceful aggro logic: Becomes hostile if attacked, then flees
- Nomad ship graphics: `/client/js/graphics/npc-ships.js` additions
- Caravan movement patterns: Follows wormhole connections between systems

**Reward for Protection:**
- If player defends Nomad Trader from pirate attack, receive reputation bonus
- High reputation unlocks better prices and exclusive goods

---

### New NPC Faction: Forgotten Ancients

**Priority:** Medium
**Estimated Effort:** 4-5 weeks

**Description:**
Mysterious end-game faction encountered in deep space (far from stars). Ancient, powerful, and enigmatic. Provides challenging combat and unique rewards for experienced players.

**Faction Details:**
- **Behavior:** Territorial guardians of ancient structures
- **Spawn Hub:** `ancient_monolith` (only spawns 1.5+ sectors from any star)
- **AI Strategy:** `sentinel` (new AI, stationary defense until provoked)
- **Ships:** `ancient_sentinel`, `ancient_guardian`, `ancient_overseer` (all tier 4-5 difficulty)
- **Appearance:** Geometric, crystalline ships with cyan/purple energy signatures
- **Combat:** Uses unique "temporal" weapons that apply slow debuffs
- **Rewards:** Ancient technology components, unique relics, "Ancient Cipher" items

**Ancient Structures:**
- `ancient_monolith` - Indestructible structure that spawns Ancient NPCs
- Scanning monolith (2 minute channel) grants cryptic lore messages
- Collecting 10 "Ancient Ciphers" unlocks special ship skin (future)

**Implementation:**
- New AI module: `/server/game/ai/sentinel.js`
- Temporal weapon mechanics: Projectiles apply 30% slow for 3 seconds
- Ancient faction color palette: Cyan/purple/silver
- Monolith structure graphics (large, crystalline, animated)
- Deep space spawn logic: Requires `minDistFromStar: 1.5` in placement strategy
- Unique death effect: "Crystallize" (freeze and shatter)

---

### Additional Upgrade Tiers (6-10)

**Priority:** High
**Estimated Effort:** 2-3 weeks
**Dependencies:** Component Crafting System

**Description:**
Extend ship component progression from tier 5 to tier 10 using component crafting. Provides long-term progression goals for veteran players.

**Upgrade Requirements:**

**Tier 6:**
- Cost: 20,000 credits
- Components: 3x specific component type
- Resources: 50x rare, 20x ultra-rare

**Tier 7:**
- Cost: 50,000 credits
- Components: 5x specific component type
- Resources: 80x rare, 40x ultra-rare

**Tier 8:**
- Cost: 100,000 credits
- Components: 8x specific component type
- Resources: 120x rare, 60x ultra-rare

**Tier 9:**
- Cost: 200,000 credits
- Components: 12x specific component type
- Resources: 200x rare, 100x ultra-rare
- Special: Requires 1x Ancient Cipher (Forgotten Ancients content)

**Tier 10:**
- Cost: 500,000 credits
- Components: 20x specific component type
- Resources: 500x rare, 200x ultra-rare
- Special: Requires 3x Ancient Cipher + 1x unique relic

**Tier 10 Component Effects:**

**Engine Tier 10:**
- Speed: 450 units/sec (from 330 at T5)
- Thrust boost duration: 3 seconds (from 2s at T5)
- New: Afterburner cooldown reduced to 3 seconds

**Weapon Tier 10:**
- Damage: 60 (from 30 at T5)
- Range: 600 units (from 400 at T5)
- New: "Overcharge" mode - hold fire button for 2s to fire mega-shot (3x damage, 15s cooldown)

**Shield Tier 10:**
- Capacity: 2000 HP (from 800 at T5)
- Recharge: 12 HP/sec (from 7 at T5)
- New: "Shield Burst" - active ability that damages nearby enemies on activation (30s cooldown)

**Implementation:**
- Extend `UPGRADE_REQUIREMENTS` in `constants.js` for tiers 6-10
- Update upgrade UI to show component requirements
- Balance testing for tier 10 endgame power level
- Visual upgrades: Ship glow intensity increases with tier
- Achievement: "Master Engineer" for reaching tier 10 in all components

---

### Unique Relic Abilities

**Priority:** Medium
**Estimated Effort:** 2 weeks
**Dependencies:** Relic Activation Effects

**Description:**
Expand the relic system with 10 additional unique relics, each with specific gameplay effects. Creates collectible goals and horizontal progression.

**New Relics:**

**Time-Worn Compass (Rare):**
- Effect: Always shows direction to nearest wormhole on radar
- Drop: Random from any wreckage in deep space

**Stellar Catalyst (Ultra-Rare):**
- Effect: Reduces star gravity by 50%, immune to star heat damage
- Drop: Pirate Dreadnought, Void Phantom

**Mining Savant's Toolkit (Rare):**
- Effect: 25% chance to double mining yield
- Drop: Rogue Miner bosses

**Void Beacon (Ultra-Rare):**
- Effect: Reveals all Void Rifts within 10 sectors, +20% damage to Void Entities
- Drop: Void Phantom, Ancient Overseer

**Pirate's Signet Ring (Rare):**
- Effect: Pirates ignore player if not attacked first
- Drop: Pirate Captain, Pirate Dreadnought

**Quantum Harmonizer (Ultra-Rare):**
- Effect: Wormhole transit has no cooldown (instant re-entry)
- Drop: Ancient Overseer (5% chance)

**Swarm Pheromone Emitter (Rare):**
- Effect: Tamed Swarm Drone follows player, provides weak combat support
- Drop: Swarm Queen (guaranteed)

**Shield Resonance Core (Rare):**
- Effect: Shield regenerates even while taking damage (50% normal rate)
- Drop: Void Entities, Ancient Sentinels

**Turbo Injector Module (Rare):**
- Effect: Boost cooldown reduced by 50%
- Drop: Pirate ships, Nomad Hauler

**Ancient Data Chip (Ultra-Rare):**
- Effect: Unlocks lore entries in "Codex" panel (future expansion)
- Drop: Ancient Overseer, Ancient Monolith scan

**Implementation:**
- Add to `CONSTANTS.RELIC_TYPES`
- Update loot pools in `loot-pools.js`
- Implement effects in relevant game systems (`combat.js`, `wormhole.js`, `mining.js`)
- Relic gallery UI with collection progress tracker
- "Relic Hunter" achievement for collecting all relics

---

### Ship Hull Variants

**Priority:** Medium
**Estimated Effort:** 3-4 weeks

**Description:**
Introduce multiple ship hull types with different stat distributions and playstyles. Players select hull type at account creation or purchase additional hulls with credits.

**Hull Types:**

**Interceptor (Speed Specialist):**
- Base speed: +30%
- Hull HP: -20%
- Cargo capacity: -30%
- Best for: PvP, scouting, hit-and-run tactics

**Hauler (Cargo Specialist):**
- Cargo capacity: +100%
- Speed: -20%
- Mining yield: +25%
- Best for: Resource gathering, trading

**Battlecruiser (Tank Specialist):**
- Hull HP: +50%
- Shield HP: +40%
- Speed: -30%
- Best for: Boss fights, tanking damage

**Mining Barge (Mining Specialist):**
- Mining speed: +50%
- Mining range: +30 units
- Cargo capacity: +50%
- Weapon damage: -30%
- Best for: Dedicated miners

**Balanced (Default):**
- No bonuses or penalties
- Current default ship stats

**Implementation:**
- New database field: `ships.hull_type` (default: 'balanced')
- Hull selection UI on account creation
- "Shipyard" panel for purchasing additional hulls (100,000 credits each)
- Hull-specific ship graphics in `/client/js/graphics/ships.js`
- Hull indicator icon in HUD
- Active hull can be swapped at spawn points (wormholes, future stations)

**Database Schema:**
```sql
-- Add hull_type column to ships table
ALTER TABLE ships ADD COLUMN hull_type TEXT DEFAULT 'balanced';

-- New table for owned hulls
CREATE TABLE owned_hulls (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hull_type TEXT NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, hull_type)
);
```

---

### Visual Customization System

**Priority:** Low
**Estimated Effort:** 2-3 weeks

**Description:**
Cosmetic customization options for ship appearance. Provides personalization and long-term goals without affecting gameplay balance.

**Customization Options:**

**Ship Decals/Emblems:**
- Unlockable emblems displayed on ship hull
- Examples: Skull, Star, Flame, Gear, Lightning Bolt, etc.
- Unlocked via achievements, relic collection, missions
- 30+ decals planned

**Engine Trail Colors:**
- Custom thrust trail color (currently matches ship color)
- RGB color picker or preset palette
- Unlocked via credits or rare drops (5000 credits per color unlock)

**Shield Visual Themes:**
- Alternative shield visuals beyond default hexagon
- Themes: Crystalline, Plasma, Quantum, Void
- Unlocked via achievements or purchases

**Ship Skins (Advanced):**
- Full ship retexture (different color schemes)
- Premium skins: Stealth Black, Chrome, Neon, Prismatic
- Future monetization option (cosmetic-only)

**Implementation:**
- New UI panel: `CustomizationPanel.js` (extends `ShipCustomizationPanel.js`)
- Database table for unlocked cosmetics
- Cosmetic rendering in ship graphics modules
- Decal overlay system in `/client/js/graphics/ships.js`
- "Fashion Hunter" achievement for unlocking 50% of cosmetics

**Database Schema:**
```sql
CREATE TABLE unlocked_cosmetics (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cosmetic_type TEXT NOT NULL, -- 'decal', 'trail', 'shield_theme', 'skin'
  cosmetic_id TEXT NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, cosmetic_type, cosmetic_id)
);

ALTER TABLE ships ADD COLUMN active_decal TEXT;
ALTER TABLE ships ADD COLUMN active_trail TEXT;
ALTER TABLE ships ADD COLUMN active_shield_theme TEXT;
ALTER TABLE ships ADD COLUMN active_skin TEXT;
```

---

## Phase 3: Profile & Account Systems

Enhance player identity and account management.

### Extended Profile Customization

**Priority:** Medium
**Estimated Effort:** 2 weeks

**Description:**
Expand player profiles with customizable elements, bio text, and achievement displays. Makes player identity more visible in social interactions.

**Profile Elements:**

**Display Name:**
- Separate from username (login)
- Can include spaces and special characters
- 20 character limit
- Profanity filter applied

**Bio/Tagline:**
- Short bio text (200 characters)
- Displayed in profile modal and fleet roster

**Selected Title:**
- Unlockable titles displayed before/after name
- Examples: "Captain", "Elite Miner", "Swarm Slayer", "Relic Hunter"
- Earned via achievements

**Featured Achievement:**
- Pin one achievement to profile for display
- Shows in player info tooltip on radar

**Play Statistics:**
- Total playtime
- Total credits earned
- NPCs destroyed
- Resources mined
- Wormholes traversed

**Implementation:**
- Extend `profile-modal.js` with edit mode
- New database fields in `users` or separate `profiles` table
- Title system tied to achievement completion
- Profile data sent to clients on player connection (for tooltips)

**Database Schema:**
```sql
CREATE TABLE profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  active_title TEXT,
  featured_achievement TEXT,
  total_playtime INTEGER DEFAULT 0,
  total_credits_earned INTEGER DEFAULT 0,
  npcs_destroyed INTEGER DEFAULT 0,
  resources_mined INTEGER DEFAULT 0,
  wormholes_traversed INTEGER DEFAULT 0
);
```

---

### Achievement/Badge System

**Priority:** Medium
**Estimated Effort:** 3-4 weeks
**Dependencies:** Statistics Tracking

**Description:**
Comprehensive achievement system with 50+ achievements across various categories. Achievements unlock titles, cosmetics, and provide long-term goals.

**Achievement Categories:**

**Combat Achievements:**
- "First Blood" - Destroy first NPC
- "Pirate Bane" - Destroy 100 pirate NPCs
- "Queen Slayer" - Defeat Swarm Queen
- "Untouchable" - Destroy 10 NPCs without taking damage
- "Dreadnought Hunter" - Defeat 10 boss NPCs

**Mining Achievements:**
- "Prospector" - Mine 1,000 resources
- "Tycoon" - Mine 100,000 resources
- "Rare Find" - Mine 100 rare-tier resources
- "Exotic Collector" - Mine 50 ultra-rare resources

**Exploration Achievements:**
- "Wormhole Jumper" - Traverse 10 wormholes
- "Star Gazer" - Visit 50 different star systems
- "Deep Space Pioneer" - Reach 10 sectors from origin
- "Nomad" - Travel 100,000 units total

**Social Achievements:**
- "Teammate" - Join first fleet
- "Squad Leader" - Lead a fleet of 4 players
- "Merchant" - Complete 50 marketplace transactions
- "Wealthy Benefactor" - Gift 10,000 credits to fleet members

**Collection Achievements:**
- "Relic Hunter" - Collect 5 unique relics
- "Ancient Secrets" - Collect all Ancient faction relics
- "Completionist" - Collect all 15 relics

**Progression Achievements:**
- "Upgraded" - Reach tier 2 in any component
- "Elite" - Reach tier 5 in all components
- "Master Engineer" - Reach tier 10 in all components
- "Millionaire" - Accumulate 1,000,000 credits

**Implementation:**
- New module: `/server/game/achievements.js`
- Achievement progress tracking via event hooks
- Database table: `achievement_progress`, `unlocked_achievements`
- Achievement notification toast on unlock
- Achievement panel UI showing progress bars
- Steam-style achievement popup animation

**Database Schema:**
```sql
CREATE TABLE achievement_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  current_value INTEGER DEFAULT 0,
  PRIMARY KEY(user_id, achievement_id)
);

CREATE TABLE unlocked_achievements (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, achievement_id)
);
```

---

### Statistics Tracking

**Priority:** Medium
**Estimated Effort:** 2 weeks

**Description:**
Persistent statistics tracking for player actions. Powers achievements and provides interesting data for player profiles.

**Tracked Statistics:**
- Total playtime (seconds)
- Credits earned (lifetime)
- Credits spent (lifetime)
- NPCs destroyed (by faction)
- Damage dealt (total)
- Damage taken (total)
- Deaths (total)
- Resources mined (by type)
- Resources sold (by type)
- Wormholes traversed
- Sectors explored (unique)
- Fleet missions completed
- Relics found
- Bosses defeated
- Distance traveled
- Longest survival streak (time without death)

**Implementation:**
- Statistics updated in real-time during gameplay
- Periodic database flush (every 60 seconds)
- Statistics panel in profile modal
- Leaderboards for competitive stats (future expansion)

**Database Schema:**
```sql
CREATE TABLE statistics (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  playtime_seconds INTEGER DEFAULT 0,
  credits_earned INTEGER DEFAULT 0,
  credits_spent INTEGER DEFAULT 0,
  npcs_destroyed INTEGER DEFAULT 0,
  npcs_destroyed_by_faction TEXT, -- JSON blob
  damage_dealt INTEGER DEFAULT 0,
  damage_taken INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  resources_mined INTEGER DEFAULT 0,
  resources_mined_by_type TEXT, -- JSON blob
  wormholes_traversed INTEGER DEFAULT 0,
  sectors_explored INTEGER DEFAULT 0,
  missions_completed INTEGER DEFAULT 0,
  relics_found INTEGER DEFAULT 0,
  bosses_defeated INTEGER DEFAULT 0,
  distance_traveled REAL DEFAULT 0,
  longest_survival_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### Settings Sync Across Sessions

**Priority:** Low
**Estimated Effort:** 1 week

**Description:**
Persist client-side settings (audio volume, UI preferences, keybinds) to server for cross-device sync.

**Settings to Sync:**
- Audio volumes (master, sfx, ambient, ui)
- Audio enabled/disabled state
- UI scale preference
- Radar zoom level
- Keybind customization (WASD alternatives)
- Chat filter preferences
- FPS cap preference

**Implementation:**
- New API endpoint: `GET/POST /api/settings`
- Settings stored in database as JSON blob
- Client loads settings on login
- Auto-save on settings change (debounced 2 seconds)
- Local fallback if server settings unavailable

**Database Schema:**
```sql
CREATE TABLE user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings_json TEXT NOT NULL, -- JSON blob
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Phase 4: Mobile & Accessibility

Expand platform support and improve accessibility for diverse players.

### Touch-Optimized Controls

**Priority:** High
**Estimated Effort:** 3-4 weeks

**Description:**
Full mobile device support with touch-friendly UI and controls. Galaxy Miner's simple graphics make it ideal for mobile play.

**Touch Controls:**

**Virtual Joystick:**
- Left side: Movement joystick (WASD replacement)
- Right side: Aim joystick (mouse replacement)
- Semi-transparent overlay, customizable position

**Action Buttons:**
- Fire button (right side, large)
- Mining button (right side)
- Boost button (left side, near joystick)
- Auto-fire toggle (hold fire button for 2s)

**UI Adjustments:**
- Larger tap targets (minimum 44x44px)
- Simplified HUD layout for smaller screens
- Swipe gestures for terminal panel (swipe up to open, down to close)
- Pinch-to-zoom on radar
- Long-press for context menus

**Performance Optimizations:**
- Reduced particle effects on mobile (configurable)
- Lower render resolution option
- 30 FPS mode for battery saving
- Reduced radar update frequency

**Implementation:**
- Mobile detection in `input.js`
- New module: `/client/js/input-mobile.js`
- Virtual joystick library or custom implementation
- Responsive CSS breakpoints for UI panels
- Touch event handlers throughout UI

---

### Responsive UI Scaling

**Priority:** Medium
**Estimated Effort:** 2 weeks

**Description:**
Adaptive UI layout for various screen sizes, from mobile phones to ultrawide monitors.

**Breakpoints:**
- Mobile: <768px - Single column layout, collapsible panels
- Tablet: 768px-1024px - Compact two-column layout
- Desktop: 1024px-1920px - Standard layout (current)
- Ultrawide: >1920px - Expanded radar, persistent side panels

**Adaptive Elements:**
- HUD elements reposition based on screen size
- Terminal panel scales to viewport height
- Radar scales proportionally
- Chat panel auto-collapses on mobile
- Inventory grid adjusts column count

**Implementation:**
- CSS media queries in all UI stylesheets
- Dynamic UI scale multiplier in `hud.js`
- Responsive canvas sizing in `renderer.js`
- Viewport resize handlers for live adaptation

---

### Virtual Joystick Option

**Priority:** High (if mobile support added)
**Estimated Effort:** 1-2 weeks
**Dependencies:** Touch-Optimized Controls

**Description:**
Optional virtual joystick for desktop players who prefer gamepad-style controls. Also enables gamepad API support for physical controllers.

**Virtual Joystick Features:**
- Toggle in settings: "Enable Virtual Joystick"
- Keyboard/mouse input still available
- Customizable joystick position and size
- Deadzone configuration
- Button remapping

**Gamepad API Support:**
- Automatic detection of connected gamepads
- Standard Xbox/PlayStation controller layout
- Left stick: Movement
- Right stick: Aim (adjusts rotation)
- Right trigger: Fire
- Left trigger: Mining
- A button: Boost
- B button: Cancel/close UI
- Start: Open terminal

**Implementation:**
- Virtual joystick library (e.g., nipplejs)
- Gamepad API integration in `input.js`
- Gamepad settings panel
- On-screen button prompts when gamepad detected

---

### Screen Reader Support

**Priority:** Low
**Estimated Effort:** 3-4 weeks

**Description:**
Accessibility improvements for screen reader users and players with visual impairments. While Galaxy Miner is inherently visual, core features can be made accessible.

**Accessibility Features:**

**ARIA Labels:**
- All UI buttons and panels labeled
- Form inputs have descriptive labels
- Dynamic content changes announced

**Keyboard Navigation:**
- Full keyboard navigation for all UI panels
- Tab order optimization
- Visible focus indicators
- Keyboard shortcuts documented

**Audio Cues:**
- Distinct sound effects for UI interactions
- Audio notifications for important events (low health, incoming NPC)
- Text-to-speech for chat messages (optional)

**High Contrast Mode:**
- Alternative color scheme with higher contrast
- Reduced transparency
- Larger UI text option

**Implementation:**
- ARIA role attributes in all UI components
- Keyboard navigation enhancements in `input.js`
- High contrast stylesheet
- Screen reader testing with NVDA/JAWS

---

## Phase 5: Future Considerations

Long-term features that require significant development effort and may depend on player population growth.

### Player-Owned Structures

**Description:**
Allow players to construct and own permanent structures in the galaxy, such as mining stations, trading posts, or defense platforms. Structures provide passive benefits and create territorial gameplay.

**Structure Types:**
- Mining Station: Auto-mines resources in sector (offline income)
- Trading Post: Player-run marketplace with custom prices
- Defense Turret: Automated turret that fires at hostile NPCs
- Repair Station: Restores health/shield for small fee

**Considerations:**
- Requires persistent world state (structures survive logout)
- Structure health and destruction mechanics
- Structure ownership and permissions (fleet access)
- Structure maintenance costs
- Balancing offline income to avoid idle game mechanics

**Estimated Effort:** 8-12 weeks

---

### Guild/Corporation System

**Description:**
Large-scale organization system for 10-50 players. Guilds can pool resources, control territory, and compete for server-wide objectives.

**Guild Features:**
- Guild bank (shared resource pool)
- Guild territory (claimed sectors with benefits)
- Guild vs Guild combat events
- Guild rankings and leaderboards
- Guild chat and message board
- Officer ranks with permissions
- Guild customization (emblem, colors, motto)

**Considerations:**
- Guild management UI complexity
- Territory control mechanics
- Cross-guild interaction systems
- Balancing small vs large guilds

**Estimated Effort:** 12-16 weeks

---

### Seasonal Events

**Description:**
Limited-time events with unique content and rewards. Creates regular content updates and reasons to return.

**Event Examples:**
- **Meteor Shower Event:** Increased rare resource spawns for 2 weeks
- **Pirate Invasion:** Massive pirate armadas spawn near wormholes, bonus loot
- **Void Incursion:** Void Rifts triple in frequency, unique Void relics drop
- **Mining Rush:** Double mining yield and faster respawn times
- **Ancient Awakening:** Ancient Monoliths activate, new puzzles and rewards

**Event Mechanics:**
- Server-wide announcements when event starts
- Event-specific achievements and cosmetics
- Event leaderboard for top performers
- Exclusive "Seasonal" relic tier that cannot be obtained after event ends

**Considerations:**
- Event scheduling and duration
- Exclusive vs repeating rewards
- Balancing to not disadvantage players who miss events

**Estimated Effort:** 2-3 weeks per event (ongoing)

---

### Faction Reputation System

**Description:**
Persistent reputation with NPC factions that affects gameplay. Killing faction NPCs lowers reputation, trading/missions raise it.

**Reputation Effects:**
- **Friendly Reputation:** Faction NPCs ignore player, better trading prices
- **Neutral:** Default state, NPCs attack if provoked
- **Hostile:** Faction NPCs aggro on sight, increased difficulty

**Reputation Gains:**
- Complete missions for faction: +50 reputation
- Protect faction NPCs from other factions: +25 reputation
- Destroy rival faction NPCs: +10 reputation

**Reputation Losses:**
- Destroy friendly faction NPC: -100 reputation
- Destroy friendly faction base: -500 reputation

**Considerations:**
- Reputation persistence in database
- UI for tracking reputation levels
- Balancing reputation grind vs benefits
- Faction-specific rewards at high reputation

**Estimated Effort:** 4-6 weeks

---

### PvP Arena Mode

**Description:**
Optional PvP combat arena separate from main galaxy. Players queue for ranked or casual matches.

**Arena Features:**
- 1v1, 2v2, 4v4 match modes
- Standardized ship stats (balanced gameplay)
- Ranking system (Bronze → Diamond → Elite)
- Arena-specific cosmetic rewards
- Spectator mode

**Considerations:**
- Requires separate game server instance or instanced zones
- Matchmaking system implementation
- Balancing combat for competitive PvP (currently balanced for PvE)
- Anti-cheat considerations

**Estimated Effort:** 8-10 weeks

---

### Procedural Dungeons

**Description:**
Instanced procedurally generated dungeons for solo or fleet play. Dungeons are high-difficulty zones with guaranteed rare rewards.

**Dungeon Types:**
- **Derelict Space Station:** Navigate corridors, defeat waves of enemies
- **Asteroid Labyrinth:** Navigate tight asteroid tunnels, avoid hazards
- **Void Dimension:** Psychedelic void realm with reality-warping effects

**Dungeon Mechanics:**
- Time limit (15 minutes)
- Increasing difficulty waves
- Boss at end with unique mechanics
- Randomized layouts and enemy compositions
- Leaderboards for fastest clear times

**Considerations:**
- Instancing technology (separate world state per dungeon)
- Procedural generation algorithms for layouts
- Dungeon entry cost (credits or special keys)
- Balancing rewards vs main game progression

**Estimated Effort:** 10-14 weeks

---

### Dynamic Economy

**Description:**
Market prices fluctuate based on supply and demand. Creates dynamic trading opportunities and player-driven economic gameplay.

**Economy Features:**
- Resource prices increase when scarce, decrease when abundant
- Server-wide resource sinks (events, NPC purchases)
- Economic news ticker in marketplace
- Price history graphs
- Speculation opportunities (buy low, sell high)

**Considerations:**
- Economic simulation complexity
- Preventing market manipulation/exploits
- Balancing to avoid runaway inflation
- Player impact on economy at low population

**Estimated Effort:** 4-6 weeks

---

## Development Priorities Summary

**Immediate (Next 1-2 Months):**
1. Fleet/Party System UI and Mechanics
2. Component Crafting System (Tier 6+ Upgrades)
3. Relic Activation Effects

**High Priority (3-6 Months):**
4. Fleet Formation System with Shared Buffs
5. Team Chat Channels
6. New Faction: Nomad Traders
7. Additional Upgrade Tiers (6-10)
8. Ship Hull Variants
9. Touch-Optimized Controls (Mobile Support)

**Medium Priority (6-12 Months):**
10. Friend List and Invite System
11. Cooperative Mission System
12. New Faction: Forgotten Ancients
13. Unique Relic Abilities (Expanded)
14. Extended Profile Customization
15. Achievement/Badge System
16. Statistics Tracking
17. Responsive UI Scaling

**Low Priority (12+ Months):**
18. Visual Customization System
19. Settings Sync Across Sessions
20. Virtual Joystick Option
21. Screen Reader Support

**Future Considerations (No Timeline):**
- Player-Owned Structures
- Guild/Corporation System
- Seasonal Events
- Faction Reputation System
- PvP Arena Mode
- Procedural Dungeons
- Dynamic Economy

---

## Version History

**v1.0 (December 9, 2025):**
- Initial roadmap creation based on codebase analysis and user priorities
- Focus areas: Multiplayer/Social features and Content expansion
- Structured into 5 phases with detailed implementation plans

---

## Contributing to the Roadmap

This roadmap is a living document. Player feedback, technical discoveries, and changing priorities may shift feature timelines. Community input is encouraged via:

- GitHub Discussions (future)
- In-game feedback system (future)
- Discord server (future)

**Contact:** Check main README for project maintainer contact information.
