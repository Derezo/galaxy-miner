# Galaxy Miner

A real-time multiplayer browser-based space mining game. Navigate a procedurally generated galaxy, mine resources, fight NPCs, upgrade your ship, and trade with other players.

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher (18.11+ recommended for development with `--watch`)
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd galaxy-miner

# Install dependencies
npm install
```

### Running the Game

#### Production Mode
```bash
npm start
```

#### Development Mode (with auto-reload)
```bash
npm run dev
```

The server will start on `http://0.0.0.0:3388`. Open your browser and navigate to:
```
http://localhost:3388
```

### First-Time Setup

On first run, the application will:
1. Automatically create the SQLite database at `/data/galaxy-miner.db`
2. Apply the schema from `/server/schema.sql`
3. Generate the procedurally generated galaxy (using seed `GALAXY_ALPHA_2025`)

To reset the database, simply delete all files in `/data/` and restart the server.

## Technology Stack

### Backend
- **Node.js** (v18+) - Server runtime
- **Express** - Web server framework
- **Socket.io** - Real-time bidirectional communication
- **SQLite** with better-sqlite3 - Persistent data storage
- **bcrypt** - Secure password hashing

### Frontend
- **Vanilla JavaScript** (ES6+) - No frameworks, no build step
- **HTML5 Canvas** - 2D rendering engine
- **Socket.io Client** - Real-time server communication
- **Web Audio API** - Spatial audio system

### Shared
- Shared constants and utilities in `/shared/` used by both client and server
- Deterministic procedural generation ensures world consistency

## Project Structure

```
galaxy-miner/
├── client/              # Frontend (served directly, no build step)
│   ├── index.html       # Entry point
│   ├── js/              # Game client code
│   │   ├── game.js      # Client game loop (60 FPS)
│   │   ├── renderer.js  # Canvas rendering system
│   │   ├── player.js    # Local player state & prediction
│   │   ├── network.js   # Socket.io client handlers
│   │   ├── graphics/    # Visual effects (ships, weapons, particles)
│   │   ├── ui/          # Component-based UI system
│   │   └── audio/       # Web Audio API spatial audio
│   └── assets/          # Static assets (audio, images)
│
├── server/              # Backend
│   ├── index.js         # Application entry point
│   ├── server.js        # Express + Socket.io setup
│   ├── socket.js        # Socket event handlers
│   ├── auth.js          # Authentication system
│   ├── database.js      # SQLite queries
│   ├── schema.sql       # Database schema
│   └── game/            # Game systems
│       ├── engine.js    # Game loop (20 ticks/second)
│       ├── combat.js    # Combat mechanics
│       ├── mining.js    # Mining system
│       ├── npc.js       # NPC spawning & management
│       ├── loot.js      # Loot generation
│       └── ai/          # Modular AI strategies
│
├── shared/              # Shared code (client + server)
│   ├── constants.js     # Game constants
│   ├── physics.js       # Orbital mechanics
│   └── logger.js        # Logging utility
│
├── data/                # Runtime data (auto-created)
│   └── galaxy-miner.db  # SQLite database
│
├── docs/                # Comprehensive documentation
│   ├── README.md        # Documentation index
│   ├── architecture/    # System architecture docs
│   ├── systems/         # Game system documentation
│   └── api/             # API reference
│
├── tests/               # Test suite
└── tools/               # Development tools
    └── audio-generator/ # Sound effect generation
```

## Available Scripts

### Development
```bash
npm run dev             # Start development server with auto-reload
```

### Production
```bash
npm start               # Start production server
```

### Testing
```bash
npm test                # Run test suite
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate test coverage report
```

## Game Features

- Real-time multiplayer with Socket.io
- Procedurally generated infinite galaxy
- 26 resource types across 4 rarity tiers
- 5 NPC factions with unique AI behaviors
- Ship upgrade system (8 components, 5 tiers each)
- Player-to-player marketplace
- Team multiplayer with shared credits
- Spatial audio system
- Faction bases and wormhole transit
- Loot pools with buffs, components, and relics

## Development

### Architecture

Galaxy Miner uses a client-server architecture with real-time communication:

- **Server**: Authoritative game state, runs at 20 ticks per second
- **Client**: Local prediction and interpolation, renders at 60 FPS
- **Communication**: Socket.io events for all game actions
- **Persistence**: SQLite database with WAL mode for better concurrency

### Key Concepts

- **Procedural Generation**: Both client and server use the same seed for consistent world generation
- **Proximity Updates**: Players only receive updates for entities within radar range
- **Client Prediction**: Local player movement predicted on client, validated by server
- **State Synchronization**: Server is source of truth, clients reconcile on mismatch

### Development Workflow

#### Environment Setup

```bash
# Install Node.js 18+ (nvm recommended)
nvm use                  # Uses .nvmrc (Node 18)
npm install              # Install all dependencies
cp .env.example .env     # Create local config (defaults are fine for dev)
npm run dev              # Start with auto-reload on file changes
```

The server starts at `http://localhost:3388`. No build step is needed -- client files are served directly.

#### Database Reset

The SQLite database is auto-created on first startup. To wipe all data and start fresh:

```bash
rm -f data/galaxy-miner.db*
npm run dev
```

The procedural world regenerates identically from the seed. Only player accounts and inventory are lost.

#### Running Tests

```bash
npm test                 # Run full test suite (vitest)
npm run test:watch       # Watch mode for TDD
npm run test:coverage    # Coverage report with v8

# Run a specific test file
npx vitest run tests/unit/server/auth.test.js

# Run tests matching a description
npx vitest run -t "username validation"
```

Tests use in-memory SQLite databases for isolation. Test utilities are in `/tests/setup.js`.

#### Debug Mode

Set `DEBUG=true` in `.env` (the default for development) to enable all logging categories. When `DEBUG=false` (production), only `logger.error()` and `logger.network()` output remains active.

#### Audit Scripts

```bash
npm run audit:network    # Check socket event handler consistency (client vs server)
npm run audit:handlers   # Detect duplicate socket handler registrations
```

These are useful after modifying socket event handlers to ensure client and server stay in sync.

#### Deployment

Production deployment is handled by `scripts/deploy-production.sh`, which packages the project, transfers it via SCP, and manages PM2/Nginx/SSL on the remote VPS. See [Deployment Guide](/docs/deployment.md) for full details.

## Documentation

Comprehensive documentation is available in the `/docs/` directory:

- [Documentation Index](/docs/README.md) - Complete documentation table of contents
- [Architecture Overview](/docs/architecture/overview.md) - System architecture and design
- [Game Loop](/docs/architecture/game-loop.md) - Client and server game loop details
- [Socket.io Events](/docs/api/socket-events.md) - Complete API reference
- [AI System](/docs/architecture/ai-system.md) - Modular AI architecture
- [Ship Upgrades](/docs/systems/ship-upgrades.md) - Upgrade system mechanics
- [NPC Factions](/docs/systems/npc-factions.md) - Faction behaviors and spawning
- [UI System](/docs/systems/ui-system.md) - Component-based UI architecture
- [Database Schema](/docs/systems/database-schema.md) - SQLite schema reference

## Configuration

Server configuration can be customized via environment variables. See `.env.example` for available options:

```bash
cp .env.example .env
# Edit .env with your preferred settings
```

## Contributing

Contributions are welcome! When contributing:

1. Follow the existing code style and architecture patterns
2. Update documentation for any system changes
3. Add tests for new features
4. Ensure all tests pass before submitting
5. Update the relevant `/docs/` files if adding/changing systems

### Code Organization Guidelines

- **Client code**: Keep rendering, game logic, and UI separate
- **Server code**: Maintain separation between systems (combat, mining, AI)
- **Shared code**: Only put truly shared logic in `/shared/`
- **Documentation**: Update `/docs/` when changing game mechanics

## Performance

Current architecture supports:
- 50+ concurrent players
- Unlimited procedurally generated sectors
- Thousands of NPCs with sector-based activation
- Proximity-based updates to optimize network traffic

## Security

- Server-side validation for all game state changes
- bcrypt password hashing with salt rounds
- SQL injection prevention via prepared statements
- Position and action validation to prevent cheating

## Support

For questions about the codebase:
1. Check the documentation in `/docs/`
2. Review `CLAUDE.md` for quick reference
3. Examine the relevant source code files
4. Reach out to the development team

## Roadmap

See [ROADMAP.md](/docs/ROADMAP.md) for planned features and future development.

---

Built with Node.js, Express, Socket.io, and vanilla JavaScript.
