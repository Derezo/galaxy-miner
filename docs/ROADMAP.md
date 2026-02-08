# Galaxy Miner Development Roadmap

**Last Updated:** February 7, 2026
**Version:** 1.2

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

**Status:** RESOLVED (December 2025)
**Priority:** Critical

Resolved by migrating to modular handlers (Option B). Network handlers are now organized in `/client/js/network/` with 88 handlers across 10 modules. The original issue was duplicate socket event handlers causing silent data loss (e.g., `miningTargetPos` dropped for rogue miner beams). See `/client/js/network/README.md` for architecture details.

---

### Fleet/Party System UI and Mechanics

**Status:** IMPLEMENTED (January 2026)
**Priority:** Critical

Fleet/party system allowing players to group for cooperative play. Includes fleet creation/invite/leave, roster UI with member health bars, fleet chat channel, shared radar markers, leader management (kick/promote), and auto-team damage distribution. Maximum fleet size: 4 players.

Implemented in January 2026. See `/server/socket/fleet.js` and `/client/js/ui/fleet-panel.js`.

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

**Relic Effects (5 existing relics):**
- **Ancient Star Map:** Reveals faction bases and wormholes within 5 sectors (passive)
- **Void Crystal:** +10% damage against Void Entities and Swarm (passive)
- **Swarm Hive Core:** Immunity to Swarm aggro (toggleable)
- **Pirate Treasure:** Unlocks Pirate Reputation system (future expansion hook)
- **Wormhole Gem:** Smooth wormhole transit without position snap (automatic)

**Implementation:**
- New `RelicsPanel.js` with gallery view and activation toggles
- Effect hooks in `combat.js`, `wormhole.js`, and AI aggro checks
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

**Implementation:**
- New `friendships` database table with status tracking
- Friends panel UI with status indicators and request notifications
- Socket events for add/accept/remove/status/whisper

---

### Cooperative Mission System

**Priority:** Medium
**Estimated Effort:** 4-6 weeks
**Dependencies:** Fleet System, Events System (partially exists in `/server/game/events.js`)

**Description:**
Procedurally generated cooperative objectives that reward fleet teamwork. Missions spawn dynamically based on fleet activity and provide structured goals beyond free-roam mining/combat.

**Mission Types (5 planned):**
- **Faction Base Assault** (2-4 players): Destroy enemy base within time limit; rewards credits, components, rare resources
- **Mining Expedition** (1-4 players): Collect rare resources from hazardous sectors with 2x yield multiplier
- **Convoy Escort** (2-4 players): Escort NPC trader convoy across 3 sectors through pirate ambushes
- **Queen Hunt** (3-4 players): Locate and defeat Swarm Queen; guaranteed relic and component drops
- **Rescue Operation** (1-2 players): Retrieve stranded NPC using tractor beam mechanics

**Implementation:**
- Extend `/server/game/events.js` into full mission system
- Mission board UI panel (similar to marketplace)
- Mission state tracking in fleet data with `active_missions` database table
- Dynamic mission spawning based on server population and activity
- Mission progress HUD overlay
- Completion notification with loot distribution

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
- Fleet transfer socket events with server-side validation
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

**Upgrade Requirements (scaling costs):**
- Tiers 6-8: 20K-100K credits, 3-8 components, increasing rare/ultra-rare resources
- Tier 9: 200K credits, 12 components, requires 1x Ancient Cipher
- Tier 10: 500K credits, 20 components, requires 3x Ancient Cipher + 1x unique relic

**Tier 10 Capstone Effects:**
- **Engine T10:** 450 units/sec speed, 3s boost duration, reduced afterburner cooldown
- **Weapon T10:** 60 damage, 600 range, new "Overcharge" mega-shot ability (3x damage, 15s cooldown)
- **Shield T10:** 2000 HP capacity, 12 HP/sec recharge, new "Shield Burst" AoE ability (30s cooldown)

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

**New Relics (10 planned):**
- **Time-Worn Compass** (Rare): Shows direction to nearest wormhole
- **Stellar Catalyst** (Ultra-Rare): -50% star gravity, immune to star heat
- **Mining Savant's Toolkit** (Rare): 25% chance to double mining yield
- **Void Beacon** (Ultra-Rare): Reveals Void Rifts within 10 sectors, +20% Void damage
- **Pirate's Signet Ring** (Rare): Pirates ignore player unless attacked
- **Quantum Harmonizer** (Ultra-Rare): No wormhole transit cooldown
- **Swarm Pheromone Emitter** (Rare): Tamed Swarm Drone companion
- **Shield Resonance Core** (Rare): Shield regenerates during damage (50% rate)
- **Turbo Injector Module** (Rare): -50% boost cooldown
- **Ancient Data Chip** (Ultra-Rare): Unlocks lore entries in Codex panel

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

**Hull Types (5 planned):**
- **Interceptor:** +30% speed, -20% HP, -30% cargo (PvP/scouting)
- **Hauler:** +100% cargo, +25% mining yield, -20% speed (trading/gathering)
- **Battlecruiser:** +50% HP, +40% shields, -30% speed (tanking)
- **Mining Barge:** +50% mining speed/cargo, -30% weapon damage (dedicated mining)
- **Balanced:** Default stats, no bonuses or penalties

**Implementation:**
- New `hull_type` field on ships table and `owned_hulls` table for purchased hulls
- Hull selection UI on account creation
- "Shipyard" panel for purchasing additional hulls (100,000 credits each)
- Hull-specific ship graphics in `/client/js/graphics/ships.js`
- Hull indicator icon in HUD
- Active hull can be swapped at spawn points (wormholes, future stations)

---

### Visual Customization System

**Priority:** Low
**Estimated Effort:** 2-3 weeks

**Description:**
Cosmetic customization options for ship appearance. Provides personalization and long-term goals without affecting gameplay balance.

**Customization Options:**
- **Ship Decals/Emblems:** 30+ unlockable emblems via achievements, relics, and missions
- **Engine Trail Colors:** Custom thrust trail colors via RGB picker or presets (5000 credits each)
- **Shield Visual Themes:** Alternative shield visuals (Crystalline, Plasma, Quantum, Void)
- **Ship Skins:** Full ship retextures (Stealth Black, Chrome, Neon, Prismatic); future monetization option

**Implementation:**
- New UI panel: `CustomizationPanel.js` (extends `ShipCustomizationPanel.js`)
- New `unlocked_cosmetics` table and active cosmetic fields on ships table
- Cosmetic rendering in ship graphics modules
- Decal overlay system in `/client/js/graphics/ships.js`
- "Fashion Hunter" achievement for unlocking 50% of cosmetics

---

## Phase 3: Profile & Account Systems

Enhance player identity and account management.

### Extended Profile Customization

**Priority:** Medium
**Estimated Effort:** 2 weeks

**Description:**
Expand player profiles with customizable elements, bio text, and achievement displays. Makes player identity more visible in social interactions.

**Profile Elements:**
- **Display Name:** Separate from login username, 20 char limit, profanity filtered
- **Bio/Tagline:** Short text (200 chars), shown in profile modal and fleet roster
- **Selected Title:** Achievement-based unlockable titles (e.g., "Captain", "Swarm Slayer")
- **Featured Achievement:** Pin one achievement for display in player tooltips
- **Play Statistics:** Playtime, credits earned, NPCs destroyed, resources mined, wormholes traversed

**Implementation:**
- Extend `profile-modal.js` with edit mode
- New `profiles` table with display name, bio, title, stats fields
- Title system tied to achievement completion
- Profile data sent to clients on player connection (for tooltips)

---

### Achievement/Badge System

**Priority:** Medium
**Estimated Effort:** 3-4 weeks
**Dependencies:** Statistics Tracking

**Description:**
Comprehensive achievement system with 50+ achievements across various categories. Achievements unlock titles, cosmetics, and provide long-term goals.

**Achievement Categories (50+ achievements across 6 categories):**
- **Combat:** NPC kills, boss defeats, skill-based (e.g., "Untouchable", "Queen Slayer")
- **Mining:** Resource milestones from 1K to 100K, rare/ultra-rare tiers
- **Exploration:** Wormhole traversals, star system visits, distance traveled
- **Social:** Fleet participation, marketplace transactions, gifting
- **Collection:** Relic milestones (5, all Ancient, all 15)
- **Progression:** Upgrade tier milestones (T2, T5, T10), credit accumulation

**Implementation:**
- New module: `/server/game/achievements.js`
- Achievement progress tracking via event hooks
- Database tables: `achievement_progress`, `unlocked_achievements`
- Achievement notification toast on unlock
- Achievement panel UI showing progress bars

---

### Statistics Tracking

**Priority:** Medium
**Estimated Effort:** 2 weeks

**Description:**
Persistent statistics tracking for player actions. Powers achievements and provides interesting data for player profiles.

**Tracked Statistics (16 metrics):**
- Combat: NPCs destroyed (by faction), damage dealt/taken, deaths, bosses defeated
- Economy: Credits earned/spent, resources mined/sold (by type)
- Exploration: Playtime, wormholes traversed, sectors explored, distance traveled
- Progression: Fleet missions completed, relics found, longest survival streak

**Implementation:**
- New `statistics` table tracking all metrics with JSON blobs for per-type/per-faction breakdowns
- Statistics updated in real-time during gameplay
- Periodic database flush (every 60 seconds)
- Statistics panel in profile modal
- Leaderboards for competitive stats (future expansion)

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
- New `user_settings` table storing settings as JSON blob
- Client loads settings on login
- Auto-save on settings change (debounced 2 seconds)
- Local fallback if server settings unavailable

---

## Phase 4: Mobile & Accessibility

Expand platform support and improve accessibility for diverse players.

### Touch-Optimized Controls

**Status:** IMPLEMENTED (December 2025)
**Priority:** High

Full mobile device support with touch-friendly UI and controls. Includes virtual joystick, action buttons (fire, context action, menu), auto-fire system, device detection with responsive CSS, and safe area/notch support. See `/client/js/mobile/README.md` for details.

**Remaining Items:**
- Mobile settings panel (joystick size, sensitivity)
- Gesture support (swipe, pinch, long-press)
- Haptic feedback
- Portrait mode gameplay option

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

**Features:**
- Toggle in settings with customizable position, size, and deadzone
- Keyboard/mouse input remains available alongside virtual controls
- Gamepad API support with standard Xbox/PlayStation controller mapping
- Button remapping and on-screen prompts when gamepad detected

**Implementation:** Virtual joystick library (e.g., nipplejs), gamepad API integration in `input.js`, gamepad settings panel

---

### Screen Reader Support

**Priority:** Low
**Estimated Effort:** 3-4 weeks

**Description:**
Accessibility improvements for screen reader users and players with visual impairments. While Galaxy Miner is inherently visual, core features can be made accessible.

**Accessibility Features:**
- **ARIA Labels:** All UI buttons, panels, and form inputs labeled; dynamic content changes announced
- **Keyboard Navigation:** Full keyboard nav for all panels, tab order optimization, visible focus indicators
- **Audio Cues:** Distinct sounds for UI interactions and important events; optional TTS for chat
- **High Contrast Mode:** Alternative color scheme, reduced transparency, larger text option

**Implementation:** ARIA role attributes across all UI components, keyboard enhancements in `input.js`, high contrast stylesheet, screen reader testing with NVDA/JAWS

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

**Completed:**
- ~~Fleet/Party System UI and Mechanics~~ -- IMPLEMENTED (January 2026)
- ~~Touch-Optimized Controls (Mobile Support)~~ -- IMPLEMENTED (December 2025)
- ~~Duplicate Network Handler Definitions~~ -- RESOLVED (December 2025)

**Immediate (Next 1-2 Months):**
1. Component Crafting System (Tier 6+ Upgrades)
2. Relic Activation Effects

**High Priority (3-6 Months):**
3. Fleet Formation System with Shared Buffs
4. Team Chat Channels
5. New Faction: Nomad Traders
6. Additional Upgrade Tiers (6-10)
7. Ship Hull Variants

**Medium Priority (6-12 Months):**
8. Friend List and Invite System
9. Cooperative Mission System
10. New Faction: Forgotten Ancients
11. Unique Relic Abilities (Expanded)
12. Extended Profile Customization
13. Achievement/Badge System
14. Statistics Tracking
15. Responsive UI Scaling

**Low Priority (12+ Months):**
16. Visual Customization System
17. Settings Sync Across Sessions
18. Virtual Joystick Option
19. Screen Reader Support

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

**v1.2 (February 7, 2026):**
- Validated roadmap against current implementation
- Marked Fleet/Party System as IMPLEMENTED
- Condensed RESOLVED and IMPLEMENTED sections
- Removed embedded schemas and code examples from future items
- Documentation consolidation pass completed (see docs/archive/)

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
