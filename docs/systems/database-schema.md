# Database Schema

Complete SQLite database schema reference for Galaxy Miner.

## Table of Contents

- [Overview](#overview)
- [Schema File](#schema-file)
- [Tables](#tables)
  - [users](#users)
  - [ships](#ships)
  - [inventory](#inventory)
  - [marketplace](#marketplace)
  - [world_changes](#world_changes)
  - [chat_messages](#chat_messages)
  - [components](#components)
  - [relics](#relics)
  - [active_buffs](#active_buffs)
- [Relationships](#relationships)
- [Indexes](#indexes)
- [Migrations](#migrations)
- [Backup and Recovery](#backup-and-recovery)

## Overview

[Documentation to be added - Database architecture, SQLite choice rationale, and schema design principles]

## Schema File

The database schema is defined in `/server/schema.sql` and automatically applied on server startup.

[Documentation to be added - Schema initialization process]

## Tables

### users

Stores user credentials and account information.

[Documentation to be added - Table structure, columns, constraints, and relationships]

```sql
-- Schema to be documented
```

### ships

Stores player ship state including position, health, upgrades, and credits.

[Documentation to be added - Table structure, columns, constraints, and relationships]

```sql
-- Schema to be documented
```

### inventory

Stores player cargo resources.

[Documentation to be added - Table structure, columns, constraints, and relationships]

```sql
-- Schema to be documented
```

### marketplace

Stores active marketplace listings for player-to-player trading.

[Documentation to be added - Table structure, columns, constraints, and relationships]

```sql
-- Schema to be documented
```

### world_changes

Tracks depleted resources with respawn timers.

[Documentation to be added - Table structure, columns, constraints, and relationships]

```sql
-- Schema to be documented
```

### chat_messages

Stores global chat message history.

[Documentation to be added - Table structure, columns, constraints, and relationships]

```sql
-- Schema to be documented
```

### components

Stores upgrade components for tier 6+ ship upgrades (future feature).

[Documentation to be added - Table structure, columns, constraints, and relationships]

```sql
-- Schema to be documented
```

### relics

Stores rare collectible relics found by players.

[Documentation to be added - Table structure, columns, constraints, and relationships]

```sql
-- Schema to be documented
```

### active_buffs

Stores temporary power-ups with expiry times.

[Documentation to be added - Table structure, columns, constraints, and relationships]

```sql
-- Schema to be documented
```

## Relationships

[Documentation to be added - Entity relationship diagram and foreign key relationships]

## Indexes

[Documentation to be added - Index strategy and performance optimizations]

## Migrations

[Documentation to be added - Schema versioning and migration strategy]

## Backup and Recovery

[Documentation to be added - Backup procedures and data recovery]

## Code Examples

### Prepared Statements
```javascript
// Example to be added
```

### Transactions
```javascript
// Example to be added
```

## See Also

- [Authentication System](authentication.md)
- [Resources System](resources.md)
- [Marketplace System](../api/socket-events.md#marketplace-events)
