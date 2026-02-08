# Galaxy Miner Deployment Guide

This guide covers deploying Galaxy Miner to production environments.

## Prerequisites

- Node.js 18.0.0 or higher (18.11+ for `--watch` development flag)
- A Linux server (Ubuntu/Debian recommended)
- A domain name (optional, but recommended)
- Reverse proxy (nginx/Caddy) for HTTPS termination

---

## Quick Start

```bash
# Clone repository
git clone https://github.com/your-repo/galaxy-miner.git
cd galaxy-miner

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Edit .env with your settings
nano .env

# Start server
npm start
```

---

## Environment Configuration

Copy `.env.example` to `.env` and configure for your environment.

### Required Settings (Production)

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_SECRET` | Token signing secret (min 32 chars) | **Required** |
| `NODE_ENV` | Set to `production` | `development` |

**Generate a secure session secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Server Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3388` |
| `HOST` | Bind address | `0.0.0.0` |

### Authentication Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `TOKEN_EXPIRY_MS` | Session token lifetime | `86400000` (24h) |
| `LOGIN_RATE_LIMIT` | Max logins/minute/IP | `5` |
| `REGISTER_RATE_LIMIT` | Max registrations/minute/IP | `3` |

### Game Timing

| Variable | Description | Default |
|----------|-------------|---------|
| `POSITION_SAVE_INTERVAL_MS` | Save player positions | `5000` (5s) |
| `WRECKAGE_DESPAWN_TIME_MS` | Loot despawn time | `120000` (2m) |
| `TRANSIT_DURATION_MS` | Wormhole transit time | `5000` (5s) |
| `WORMHOLE_RANGE` | Entry distance | `100` units |
| `SELECTION_TIMEOUT_MS` | Destination pick timeout | `30000` (30s) |

### Debugging

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG` | Enable verbose logging | `true` (dev), `false` (prod) |

**Production logging behavior (`DEBUG=false`):**
- `logger.log()`, `logger.info()`, `logger.warn()` are silenced
- `logger.error()` always logs (errors and exceptions)
- `logger.network()` always logs (connections, auth events)

---

## Database Management

Galaxy Miner uses SQLite with better-sqlite3 for persistence.

### Database Location

```
/data/galaxy-miner.db      # Main database
/data/galaxy-miner.db-wal  # Write-ahead log (auto-created)
/data/galaxy-miner.db-shm  # Shared memory (auto-created)
```

### Schema Auto-Migration

On startup, the server automatically:
1. Creates the `data/` directory if needed
2. Creates the database if it doesn't exist
3. Applies `/server/schema.sql`
4. Runs migrations for new columns

### Backup Database

```bash
# Stop server first for clean backup
cp data/galaxy-miner.db data/galaxy-miner.db.backup

# Or with timestamp
cp data/galaxy-miner.db "data/backup-$(date +%Y%m%d-%H%M%S).db"
```

### Reset Database

```bash
# Remove database files
rm -f data/galaxy-miner.db*

# Restart server (creates fresh database)
npm start
```

### Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Player accounts (username, password hash) |
| `ships` | Ship state (position, tiers, credits, health) |
| `inventory` | Player cargo (resources by type) |
| `marketplace` | Active trade listings |
| `world_changes` | Depleted resources with respawn timers |
| `chat_messages` | Global chat history |
| `components` | Upgrade components for tier 6+ |
| `relics` | Player relics (permanent collectibles) |
| `active_buffs` | Temporary power-ups with expiry |

---

## Running in Production

### Using npm start

```bash
NODE_ENV=production npm start
```

### Using PM2 (Recommended)

PM2 provides process management, auto-restart, and logging.

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start server/index.js --name galaxy-miner

# Set to start on boot
pm2 startup
pm2 save

# View logs
pm2 logs galaxy-miner

# Monitor
pm2 monit

# Restart after updates
pm2 restart galaxy-miner
```

**PM2 ecosystem file** (`ecosystem.config.js` in project root):

The production ecosystem config includes memory limits, logging paths, automatic daily restart (4 AM cron), and exponential backoff on crash. See the file for full settings. Key options:

- `instances: 1` -- game state requires a single process
- `max_memory_restart: '1500M'` -- auto-restart on memory leak
- `cron_restart: '0 4 * * *'` -- daily restart for stability
- `exp_backoff_restart_delay: 100` -- exponential backoff on repeated crashes

```bash
# Start with ecosystem file
pm2 start ecosystem.config.js --env production
```

### Using systemd

Create `/etc/systemd/system/galaxy-miner.service`:

```ini
[Unit]
Description=Galaxy Miner Game Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/galaxy-miner
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=galaxy-miner
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable galaxy-miner
sudo systemctl start galaxy-miner

# Check status
sudo systemctl status galaxy-miner

# View logs
journalctl -u galaxy-miner -f
```

---

## Reverse Proxy Setup

### nginx

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3388;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

### Caddy

```caddyfile
yourdomain.com {
    reverse_proxy localhost:3388
}
```

Caddy automatically handles HTTPS certificates via Let's Encrypt.

---

## Health Checks

The server provides a health endpoint:

```bash
curl http://localhost:3388/health
# Returns: {"status":"ok","uptime":12345.67}
```

Use this for:
- Load balancer health checks
- Monitoring systems
- Container orchestration readiness probes

---

## Security Checklist

### Before Production

- [ ] Set `SESSION_SECRET` to a strong random value
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS (via reverse proxy)
- [ ] Restrict database file permissions
- [ ] Configure firewall (only expose port 80/443)
- [ ] Regular database backups

### Firewall (UFW)

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

### File Permissions

```bash
# Restrict database access
chmod 600 data/galaxy-miner.db*
chown www-data:www-data data/galaxy-miner.db*
```

---

## Monitoring

### Log Files

With PM2:
```bash
pm2 logs galaxy-miner --lines 100
```

With systemd:
```bash
journalctl -u galaxy-miner -f
```

### Key Metrics to Monitor

- Active WebSocket connections
- Database file size
- Memory usage
- CPU usage
- Network bandwidth

### Simple Monitoring Script

```bash
#!/bin/bash
# monitor.sh - Basic health check

HEALTH=$(curl -s http://localhost:3388/health)
STATUS=$(echo $HEALTH | jq -r '.status')
UPTIME=$(echo $HEALTH | jq -r '.uptime')

if [ "$STATUS" != "ok" ]; then
    echo "ALERT: Galaxy Miner is down!"
    # Add notification (email, Slack, etc.)
fi

echo "Status: $STATUS, Uptime: ${UPTIME}s"
```

---

## Updates and Deployment

### Automated Deployment Script

The project includes a full deployment script at `scripts/deploy-production.sh` that handles the entire deployment pipeline from local machine to production VPS via SSH:

```bash
# Full deployment (tests, backup, transfer, PM2 reload, Nginx, SSL)
./scripts/deploy-production.sh

# Deploy code only, skip infrastructure
./scripts/deploy-production.sh --skip-nginx --skip-ssl

# Preview what would happen without making changes
./scripts/deploy-production.sh --dry-run
```

The script performs these steps in order:
1. Runs the test suite locally (fails deployment if tests fail, unless `--force`)
2. Connects to the remote VPS via SSH
3. Creates a compressed backup of the current deployment (last 5 kept)
4. Packages the project (excluding `node_modules`, tests, `.git`, database files)
5. Transfers and extracts the archive on the remote server
6. Runs `npm ci --omit=dev` for production dependencies
7. Deploys `.env.production` as `.env` on the remote (hash-compared, only if changed)
8. Starts or restarts the PM2 process
9. Deploys Nginx config and reloads (idempotent, only if changed)
10. Sets up SSL via Let's Encrypt/certbot (idempotent, skips if cert exists)
11. Verifies the health endpoint; rolls back automatically on failure

Configuration is via environment variables or defaults:
- `REMOTE_HOST` (default: `mittonvillage.com`)
- `REMOTE_USER` (default: `root`)
- `REMOTE_APP_DIR` (default: `/var/www/galaxy-miner`)
- `DOMAIN` (default: `galaxyminer.mittonvillage.com`)

The script requires `.env.production` and `ecosystem.config.js` to exist locally.

### Zero-Downtime Update (with PM2)

```bash
cd /path/to/galaxy-miner
git pull origin main
npm install
pm2 reload galaxy-miner
```

### Manual Update

```bash
# Pull changes
git pull origin main

# Install any new dependencies
npm install

# Restart
pm2 restart galaxy-miner
# or
sudo systemctl restart galaxy-miner
```

---

## Troubleshooting

### Server Won't Start

1. Check Node.js version: `node --version` (needs 18+)
2. Check port availability: `lsof -i :3388`
3. Check logs: `pm2 logs` or `journalctl -u galaxy-miner`

### Database Errors

1. Check file permissions on `data/` directory
2. Ensure disk space available
3. Try removing WAL files: `rm data/*.db-wal data/*.db-shm`

### WebSocket Disconnections

1. Check nginx/Caddy proxy_read_timeout settings
2. Verify WebSocket upgrade headers in proxy config
3. Check for firewall blocking connections

### High Memory Usage

1. Check for memory leaks in game engine
2. Monitor connected player count
3. Consider `max_memory_restart` with PM2

### SSL/HTTPS Issues

1. Verify certificate paths in nginx config
2. Check certificate expiration
3. Test with: `curl -v https://yourdomain.com/health`

---

## Development to Production Checklist

1. [ ] Update `.env` with production values
2. [ ] Set `NODE_ENV=production`
3. [ ] Set strong `SESSION_SECRET`
4. [ ] Configure reverse proxy with HTTPS
5. [ ] Set up process manager (PM2/systemd)
6. [ ] Configure firewall
7. [ ] Set up database backups
8. [ ] Configure monitoring
9. [ ] Test health endpoint
10. [ ] Test WebSocket connections

---

## Related Documentation

- [Architecture Overview](/docs/architecture/overview.md)
- [Database Schema](/docs/systems/database-schema.md)
- [Authentication](/docs/systems/authentication.md)
