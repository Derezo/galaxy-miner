# Authentication System

User authentication, session management, and security in Galaxy Miner.

## Table of Contents

- [Overview](#overview)
- [Registration Flow](#registration-flow)
- [Login Flow](#login-flow)
- [Token-Based Authentication](#token-based-authentication)
- [Session Management](#session-management)
- [Password Security](#password-security)
- [Logout Flow](#logout-flow)
- [Security Considerations](#security-considerations)
- [Database Schema](#database-schema)
- [Client Implementation](#client-implementation)
- [Server Implementation](#server-implementation)

## Overview

Galaxy Miner uses a token-based authentication system built on:

- **Password Hashing**: bcrypt with 10 salt rounds for secure password storage
- **Session Storage**: In-memory Map (MVP - suitable for single-server deployments)
- **Token Format**: UUID v4 (122 bits of entropy)
- **Token Expiry**: 24 hours (configurable, with sliding expiration)
- **Rate Limiting**: IP-based per-minute limits to prevent brute force attacks

**Architecture Flow:**

```
┌──────────┐
│  Client  │  1. auth:register / auth:login / auth:token
└────┬─────┘
     │
     ▼
┌────────────────────────┐
│  Socket Handler        │  2. Validate inputs & rate limits
│  /server/socket.js     │
└────┬───────────────────┘
     │
     ▼
┌────────────────────────┐
│  Auth Module           │  3. Verify credentials / Create user
│  /server/auth.js       │
└────┬───────────────────┘
     │
     ▼
┌────────────────────────┐
│  Database Module       │  4. Query/insert user data
│  /server/database.js   │
└────┬───────────────────┘
     │
     ▼
┌────────────────────────┐
│  Session Store (Map)   │  5. Create/validate session token
└────┬───────────────────┘
     │
     ▼
┌──────────┐
│  Client  │  6. Receive token + player data
└──────────┘
```

## Registration Flow

[Documentation to be added - Step-by-step registration process, validation, and error handling]

## Login Flow

[Documentation to be added - Login process, credential verification, and session creation]

## Token-Based Authentication

[Documentation to be added - JWT/token implementation, token storage, and validation]

## Session Management

[Documentation to be added - Session lifecycle, timeout handling, and persistence]

## Password Security

[Documentation to be added - Bcrypt hashing, salt rounds, and password policies]

## Logout Flow

[Documentation to be added - Session cleanup and logout process]

## Security Considerations

[Documentation to be added - Security best practices, threat model, and mitigations]

### Rate Limiting
[Documentation to be added]

### SQL Injection Prevention
[Documentation to be added]

### XSS Protection
[Documentation to be added]

## Database Schema

[Documentation to be added - Users table structure and relationships]

## Client Implementation

[Documentation to be added - Client-side auth handling, token storage, and UI flow]

## Server Implementation

[Documentation to be added - Server-side auth middleware, handlers, and validation]

## Code Examples

### Registration
```javascript
// Example to be added
```

### Login
```javascript
// Example to be added
```

### Token Authentication
```javascript
// Example to be added
```

## See Also

- [Socket.io Events - Authentication](../api/socket-events.md#authentication-events)
- [Database Schema](database-schema.md)
- [Networking System](networking.md)
