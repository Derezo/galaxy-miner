# Galaxy Miner Documentation

Welcome to the Galaxy Miner technical documentation. This documentation provides comprehensive information about the game's architecture, systems, and APIs.

## Table of Contents

### Getting Started
- [Project Overview](../CLAUDE.md) - Quick reference for developers
- [Architecture Overview](architecture/overview.md) - System architecture and design principles
- [Game Loop](architecture/game-loop.md) - Client and server game loop architecture

### API Reference
- [Socket.io Events](api/socket-events.md) - Complete list of client-server events

### Core Systems
- [Authentication](systems/authentication.md) - User authentication and session management
- [Database Schema](systems/database-schema.md) - SQLite database structure
- [Networking](systems/networking.md) - Client-server communication protocol
- [Resources](systems/resources.md) - Resource types, values, and generation

### Game Systems
- [Ship Upgrades](systems/ship-upgrades.md) - Ship component upgrade system
- [NPC Factions](systems/npc-factions.md) - Faction behaviors and spawn mechanics
- [AI System](architecture/ai-system.md) - Modular AI architecture
- [Loot Pools](systems/loot-pools.md) - Loot generation and drop mechanics
- [Relics](systems/relics.md) - Rare collectible system
- [Components](systems/components.md) - Upgrade component system for tier 6+

### Advanced Features
- [Wormhole Transit](systems/wormhole-transit.md) - Instant travel system
- [Team Multiplayer](systems/team-multiplayer.md) - Team formation and features

### UI & Client
- [UI System](systems/ui-system.md) - Component-based UI architecture

## Documentation Standards

This documentation follows these principles:

- **Accuracy**: All code examples are tested and validated
- **Completeness**: Covers both happy paths and edge cases
- **Maintainability**: Kept in sync with codebase changes
- **Accessibility**: Clear language for developers of all levels
- **Practical**: Focus on working examples over theory

## Contributing to Documentation

When updating game systems, please update the relevant documentation:

1. Update the corresponding system documentation
2. Add code examples where applicable
3. Document breaking changes clearly
4. Update API references if events change

## Quick Links

- **Game Constants**: `/shared/constants.js`
- **Server Entry Point**: `/server/index.js`
- **Client Entry Point**: `/client/index.html`
- **Database Schema**: `/server/schema.sql`

## Support

For questions or clarifications about the documentation, please refer to the codebase or reach out to the development team.
