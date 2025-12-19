#!/bin/bash

################################################################################
# Production Deployment Script for Galaxy Miner
#
# Deploys Galaxy Miner from local machine to production VPS via SSH.
# Creates a compressed archive locally and transfers via scp (no git on VPS).
#
# Features:
# - Local archive creation (no git dependency on VPS)
# - Compressed transfer via scp
# - SSH-based deployment to mittonvillage.com
# - PM2 process management with graceful reload
# - Nginx reverse proxy configuration (idempotent)
# - SSL/TLS certificate setup via Let's Encrypt (idempotent)
# - Pre-deployment validation and backups
# - Health check verification
# - Deployment locking (prevent concurrent deploys)
# - Dry-run mode for previewing changes
#
# Usage: ./scripts/deploy-production.sh [options]
#   --skip-backup     Skip pre-deployment backup
#   --skip-nginx      Skip Nginx configuration deployment
#   --skip-ssl        Skip SSL certificate setup
#   --dry-run         Show what would be changed without making changes
#   --help            Show this help message
#
# Environment: Deploys to production VPS with PM2, Nginx
################################################################################

set -e
set -o pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

# Get the real user's home directory (handles sudo properly)
if [ -n "$SUDO_USER" ]; then
    REAL_USER="$SUDO_USER"
    REAL_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
else
    REAL_USER="$USER"
    REAL_HOME="$HOME"
fi

# Remote server configuration
REMOTE_HOST="${REMOTE_HOST:-mittonvillage.com}"
REMOTE_USER="${REMOTE_USER:-root}"
SSH_KEY="${SSH_KEY:-$REAL_HOME/.ssh/id_ed25519}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/var/www/galaxy-miner}"
PM2_APP_NAME="${PM2_APP_NAME:-galaxy-miner}"
DOMAIN="${DOMAIN:-galaxyminer.mittonvillage.com}"

# Script configuration
SKIP_BACKUP=false
SKIP_NGINX=false
SKIP_SSL=false
SKIP_TESTS=false
FORCE_DEPLOY=false
DRY_RUN=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
LOCK_FILE="/tmp/galaxy-miner-deploy.lock"

# Deployment package configuration
DEPLOY_PACKAGE_NAME="galaxy-miner-deploy.tar.gz"
DEPLOY_PACKAGE_PATH="/tmp/$DEPLOY_PACKAGE_NAME"

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --skip-nginx)
                SKIP_NGINX=true
                shift
                ;;
            --skip-ssl)
                SKIP_SSL=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --force)
                FORCE_DEPLOY=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo ""
                echo "Deploys Galaxy Miner from local machine to production VPS via SSH."
                echo "Creates a compressed archive locally and transfers via scp."
                echo ""
                echo "Options:"
                echo "  --skip-backup   Skip pre-deployment backup"
                echo "  --skip-tests    Skip pre-deployment tests"
                echo "  --skip-nginx    Skip Nginx configuration deployment"
                echo "  --skip-ssl      Skip SSL certificate setup"
                echo "  --force         Force deployment even if tests fail"
                echo "  --dry-run       Show what would be changed without making changes"
                echo "  --help          Show this help message"
                echo ""
                echo "Configuration (can be set via environment variables):"
                echo "  REMOTE_HOST:    $REMOTE_HOST"
                echo "  REMOTE_USER:    $REMOTE_USER"
                echo "  REMOTE_APP_DIR: $REMOTE_APP_DIR"
                echo "  SSH_KEY:        $SSH_KEY"
                echo "  DOMAIN:         $DOMAIN"
                echo ""
                echo "Example:"
                echo "  $0                         # Full deployment"
                echo "  $0 --skip-nginx --skip-ssl # Deploy code only"
                echo "  $0 --dry-run               # Preview changes"
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                exit 1
                ;;
        esac
    done
}

# Logging functions
log() {
    mkdir -p "$LOG_DIR"
    echo -e "$1" | tee -a "$LOG_FILE"
}

log_step() {
    log "\n${BLUE}==>${BOLD} $1${NC}"
}

log_success() {
    log "${GREEN}✓ $1${NC}"
}

log_warning() {
    log "${YELLOW}⚠  $1${NC}"
}

log_error() {
    log "${RED}✗ $1${NC}"
}

log_info() {
    log "${CYAN}ℹ  $1${NC}"
}

log_dry_run() {
    log "${YELLOW}[DRY-RUN]${NC} $1"
}

# Deployment lock management (prevents concurrent deployments)
acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid
        lock_pid=$(cat "$LOCK_FILE" 2>/dev/null)
        if kill -0 "$lock_pid" 2>/dev/null; then
            log_error "Another deployment is in progress (PID: $lock_pid)"
            log_info "If this is stale, remove: $LOCK_FILE"
            exit 1
        else
            log_warning "Removing stale lock file from PID $lock_pid"
            rm -f "$LOCK_FILE"
        fi
    fi
    echo $$ > "$LOCK_FILE"
    log_success "Deployment lock acquired"
}

release_lock() {
    rm -f "$LOCK_FILE" 2>/dev/null || true
}

# Cleanup function for temp files
cleanup() {
    if [ -f "$DEPLOY_PACKAGE_PATH" ]; then
        rm -f "$DEPLOY_PACKAGE_PATH"
        log_info "Cleaned up local deployment package"
    fi
    release_lock
}

# SSH helper function
ssh_exec() {
    ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=yes \
        -o ConnectTimeout=30 \
        -o ServerAliveInterval=10 \
        -o BatchMode=yes \
        "$REMOTE_USER@$REMOTE_HOST" "$@"
}

# SCP helper function
scp_to() {
    scp -i "$SSH_KEY" \
        -o StrictHostKeyChecking=yes \
        -o ConnectTimeout=30 \
        "$1" "$REMOTE_USER@$REMOTE_HOST:$2"
}

# Initialize SSH known_hosts (secure host key verification)
init_ssh_known_hosts() {
    if ! ssh-keygen -F "$REMOTE_HOST" &>/dev/null; then
        log_info "Adding $REMOTE_HOST to known_hosts..."
        ssh-keyscan -H "$REMOTE_HOST" >> "$REAL_HOME/.ssh/known_hosts" 2>/dev/null
        log_success "Host key added to known_hosts"
    fi
}

# Check local prerequisites
check_local_prerequisites() {
    log_step "Checking local prerequisites"

    local has_errors=false

    # Check tar
    if ! command -v tar &> /dev/null; then
        log_error "tar is not installed"
        has_errors=true
    else
        log_success "tar is installed"
    fi

    # Check node
    if ! command -v node &> /dev/null; then
        log_error "node is not installed"
        has_errors=true
    else
        local node_version
        node_version=$(node --version)
        log_success "node is installed ($node_version)"
    fi

    # Check SSH key
    if [ ! -f "$SSH_KEY" ]; then
        log_error "SSH key not found: $SSH_KEY"
        has_errors=true
    else
        log_success "SSH key found: $SSH_KEY"
    fi

    # Check .env.production exists
    if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
        log_error ".env.production not found"
        has_errors=true
    else
        log_success ".env.production found"
    fi

    # Check ecosystem.config.js exists
    if [ ! -f "$PROJECT_ROOT/ecosystem.config.js" ]; then
        log_error "ecosystem.config.js not found"
        has_errors=true
    else
        log_success "ecosystem.config.js found"
    fi

    # Check package.json exists
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "package.json not found"
        has_errors=true
    else
        log_success "package.json found"
    fi

    if [ "$has_errors" = true ]; then
        log_error "Prerequisites check failed"
        exit 1
    fi
}

# Check SSH connectivity
check_ssh_connectivity() {
    log_step "Checking SSH connectivity"

    if $DRY_RUN; then
        log_dry_run "Would test SSH connection to $REMOTE_USER@$REMOTE_HOST"
        return
    fi

    if ssh_exec "echo 'SSH connection successful'" &> /dev/null; then
        log_success "SSH connection to $REMOTE_HOST verified"
    else
        log_error "Cannot connect to $REMOTE_HOST via SSH"
        exit 1
    fi
}

# Check remote prerequisites
check_remote_prerequisites() {
    log_step "Checking remote prerequisites"

    if $DRY_RUN; then
        log_dry_run "Would check remote prerequisites (node, npm, pm2, nginx, certbot)"
        return
    fi

    # Check Node.js
    if ssh_exec "command -v node" &> /dev/null; then
        local node_version
        node_version=$(ssh_exec "node --version")
        log_success "Remote node: $node_version"
    else
        log_error "node is not installed on remote server"
        exit 1
    fi

    # Check npm
    if ssh_exec "command -v npm" &> /dev/null; then
        log_success "Remote npm installed"
    else
        log_error "npm is not installed on remote server"
        exit 1
    fi

    # Check PM2
    if ssh_exec "command -v pm2" &> /dev/null; then
        log_success "Remote pm2 installed"
    else
        log_warning "pm2 not found, will attempt to install"
        ssh_exec "npm install -g pm2"
        log_success "pm2 installed globally"
    fi

    # Check Nginx
    if ssh_exec "command -v nginx" &> /dev/null; then
        log_success "Remote nginx installed"
    else
        log_error "nginx is not installed on remote server"
        exit 1
    fi

    # Check certbot (only if SSL not skipped)
    if [ "$SKIP_SSL" = false ]; then
        if ssh_exec "command -v certbot" &> /dev/null; then
            log_success "Remote certbot installed"
        else
            log_warning "certbot not found, SSL setup will be skipped"
            SKIP_SSL=true
        fi
    fi
}

# Create remote backup
create_remote_backup() {
    log_step "Creating remote backup"

    if [ "$SKIP_BACKUP" = true ]; then
        log_info "Skipping backup (--skip-backup)"
        return
    fi

    if $DRY_RUN; then
        log_dry_run "Would create backup of $REMOTE_APP_DIR"
        return
    fi

    local backup_dir="/var/backups/galaxy-miner"
    local backup_name="backup-$(date +%Y%m%d-%H%M%S).tar.gz"

    # Check if app directory exists
    if ssh_exec "[ -d $REMOTE_APP_DIR ]"; then
        ssh_exec "mkdir -p $backup_dir"
        ssh_exec "cd $REMOTE_APP_DIR && tar -czf $backup_dir/$backup_name --exclude='node_modules' --exclude='logs' ."
        log_success "Backup created: $backup_dir/$backup_name"

        # Keep only last 5 backups
        ssh_exec "cd $backup_dir && ls -t *.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm --"
        log_info "Old backups cleaned up (keeping last 5)"
    else
        log_info "No existing deployment to backup"
    fi
}

# Run pre-deployment validation (tests)
run_pre_deployment_validation() {
    log_step "Running pre-deployment validation"

    if [ "$SKIP_TESTS" = true ]; then
        log_info "Skipping tests (--skip-tests)"
        return
    fi

    if $DRY_RUN; then
        log_dry_run "Would run tests and validation"
        return
    fi

    # Run tests
    log_info "Running test suite..."
    if ! (cd "$PROJECT_ROOT" && npm test 2>&1 | tee -a "$LOG_FILE"); then
        log_error "Tests failed"
        if [ "$FORCE_DEPLOY" = false ]; then
            exit 1
        fi
        log_warning "Continuing despite test failure (--force)"
    else
        log_success "Tests passed"
    fi

    # Validate critical files exist
    local critical_files=(
        "server/index.js"
        "server/database.js"
        "server/schema.sql"
        "client/index.html"
        "package.json"
    )

    for file in "${critical_files[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$file" ]; then
            log_error "Critical file missing: $file"
            exit 1
        fi
    done

    log_success "Pre-deployment validation passed"
}

# Initialize database on remote (if not exists)
initialize_remote_database() {
    log_step "Checking database"

    if $DRY_RUN; then
        log_dry_run "Would check/initialize database"
        return
    fi

    # Check if database exists
    if ssh_exec "[ -f $REMOTE_APP_DIR/data/galaxy-miner.db ]"; then
        log_info "Database already exists, preserving data"
    else
        log_info "Database not found, will be created on first run"
        # The database is auto-created by server/database.js on startup
        # Just ensure the data directory exists with correct permissions
        ssh_exec "mkdir -p $REMOTE_APP_DIR/data && chmod 755 $REMOTE_APP_DIR/data"
        log_success "Data directory prepared"
    fi
}

# Rollback to previous deployment
rollback_deployment() {
    log_error "Deployment failed, initiating rollback..."

    # Find latest backup
    local latest_backup
    latest_backup=$(ssh_exec "ls -t /var/backups/galaxy-miner/*.tar.gz 2>/dev/null | head -1" || echo "")

    if [ -z "$latest_backup" ]; then
        log_error "No backup found for rollback - manual intervention required"
        return 1
    fi

    log_info "Restoring from backup: $latest_backup"

    ssh_exec "
        cd $REMOTE_APP_DIR &&
        pm2 stop $PM2_APP_NAME 2>/dev/null || true &&
        rm -rf server client shared package.json ecosystem.config.js 2>/dev/null || true &&
        tar -xzf $latest_backup &&
        npm ci --omit=dev &&
        pm2 restart $PM2_APP_NAME 2>/dev/null || pm2 start ecosystem.config.js &&
        pm2 save
    " 2>&1 | tee -a "$LOG_FILE"

    if [ $? -eq 0 ]; then
        log_success "Rollback complete"
    else
        log_error "Rollback failed - manual intervention required"
        return 1
    fi
}

# Create deployment package locally
create_deploy_package() {
    log_step "Creating deployment package"

    if $DRY_RUN; then
        log_dry_run "Would create deployment package at $DEPLOY_PACKAGE_PATH"
        return
    fi

    # Remove old package if exists
    rm -f "$DEPLOY_PACKAGE_PATH"

    log_info "Packaging application files..."

    # Create archive excluding unnecessary files
    tar -czf "$DEPLOY_PACKAGE_PATH" \
        -C "$PROJECT_ROOT" \
        --exclude='node_modules' \
        --exclude='logs' \
        --exclude='*.log' \
        --exclude='.git' \
        --exclude='.gitignore' \
        --exclude='.env' \
        --exclude='.env.local' \
        --exclude='.env.development' \
        --exclude='tests' \
        --exclude='*.test.js' \
        --exclude='*.spec.js' \
        --exclude='.claude' \
        --exclude='coverage' \
        --exclude='.nyc_output' \
        --exclude='data/*.db' \
        --exclude='data/*.db-shm' \
        --exclude='data/*.db-wal' \
        .

    local package_size
    package_size=$(du -h "$DEPLOY_PACKAGE_PATH" | cut -f1)
    log_success "Deployment package created: $package_size"
}

# Transfer and extract package on remote
transfer_and_extract() {
    log_step "Transferring to remote server"

    if $DRY_RUN; then
        log_dry_run "Would transfer package to $REMOTE_HOST and extract to $REMOTE_APP_DIR"
        return
    fi

    # Create remote directories
    ssh_exec "mkdir -p $REMOTE_APP_DIR"
    ssh_exec "mkdir -p $REMOTE_APP_DIR/logs"
    ssh_exec "mkdir -p $REMOTE_APP_DIR/data"

    # Transfer package
    log_info "Uploading deployment package..."
    scp_to "$DEPLOY_PACKAGE_PATH" "/tmp/$DEPLOY_PACKAGE_NAME"
    log_success "Package uploaded"

    # Stop PM2 process before extraction (if running)
    if ssh_exec "pm2 describe $PM2_APP_NAME &> /dev/null" 2>/dev/null; then
        log_info "Stopping PM2 process for deployment..."
        ssh_exec "pm2 stop $PM2_APP_NAME" 2>/dev/null || true
    fi

    # Extract package (preserving data directory)
    log_info "Extracting on remote server..."
    ssh_exec "cd $REMOTE_APP_DIR && tar -xzf /tmp/$DEPLOY_PACKAGE_NAME --overwrite"
    log_success "Package extracted"

    # Clean up remote package
    ssh_exec "rm -f /tmp/$DEPLOY_PACKAGE_NAME"

    # Ensure data directory permissions
    ssh_exec "chmod 755 $REMOTE_APP_DIR/data"

    log_success "Code deployed"
}

# Install dependencies on remote
install_dependencies() {
    log_step "Installing dependencies"

    if $DRY_RUN; then
        log_dry_run "Would run npm ci --omit=dev on remote"
        return
    fi

    log_info "Installing production dependencies (this may take a moment)..."
    ssh_exec "cd $REMOTE_APP_DIR && npm ci --omit=dev"
    log_success "Dependencies installed"
}

# Deploy environment file
deploy_env_file() {
    log_step "Deploying environment configuration"

    local local_env="$PROJECT_ROOT/.env.production"
    local remote_env="$REMOTE_APP_DIR/.env"

    if $DRY_RUN; then
        log_dry_run "Would deploy .env.production to $remote_env"
        return
    fi

    # Check if env file changed using hash comparison
    local local_hash
    local remote_hash
    local_hash=$(md5sum "$local_env" | cut -d' ' -f1)
    remote_hash=$(ssh_exec "md5sum $remote_env 2>/dev/null | cut -d' ' -f1" || echo "none")

    if [ "$local_hash" != "$remote_hash" ]; then
        scp_to "$local_env" "$remote_env"
        ssh_exec "chmod 600 $remote_env"
        log_success "Environment file deployed"
    else
        log_info "Environment file unchanged, skipping"
    fi
}

# Deploy with PM2
deploy_pm2() {
    log_step "Deploying with PM2"

    if $DRY_RUN; then
        log_dry_run "Would start/reload PM2 process"
        return
    fi

    # Check if PM2 process exists
    if ssh_exec "pm2 describe $PM2_APP_NAME &> /dev/null" 2>/dev/null; then
        log_info "Restarting PM2 process..."
        ssh_exec "cd $REMOTE_APP_DIR && pm2 restart $PM2_APP_NAME --update-env"
    else
        log_info "Starting PM2 process for the first time..."
        ssh_exec "cd $REMOTE_APP_DIR && pm2 start ecosystem.config.js"
    fi

    # Save PM2 process list
    ssh_exec "pm2 save"

    log_success "PM2 deployment complete"
}

# Deploy Nginx configuration
deploy_nginx() {
    log_step "Deploying Nginx configuration"

    if [ "$SKIP_NGINX" = true ]; then
        log_info "Skipping Nginx deployment (--skip-nginx)"
        return
    fi

    local local_nginx="$PROJECT_ROOT/deploy/nginx/galaxyminer.mittonvillage.com.conf"
    local remote_nginx="/etc/nginx/sites-available/galaxyminer.mittonvillage.com"
    local enabled_nginx="/etc/nginx/sites-enabled/galaxyminer.mittonvillage.com"
    local nginx_changed=false

    if $DRY_RUN; then
        log_dry_run "Would deploy Nginx config to $remote_nginx"
        return
    fi

    # Check if nginx config changed
    local local_hash
    local remote_hash
    local_hash=$(md5sum "$local_nginx" | cut -d' ' -f1)
    remote_hash=$(ssh_exec "md5sum $remote_nginx 2>/dev/null | cut -d' ' -f1" || echo "none")

    if [ "$local_hash" != "$remote_hash" ]; then
        scp_to "$local_nginx" "$remote_nginx"
        nginx_changed=true
        log_success "Nginx config deployed"
    else
        log_info "Nginx config unchanged, skipping"
    fi

    # Enable site if not already enabled
    if ! ssh_exec "[ -L $enabled_nginx ]"; then
        log_info "Enabling Nginx site..."
        ssh_exec "ln -sf $remote_nginx $enabled_nginx"
        nginx_changed=true
    fi

    # Test and reload Nginx if config changed
    if [ "$nginx_changed" = true ]; then
        log_info "Testing Nginx configuration..."
        if ssh_exec "nginx -t" 2>&1; then
            ssh_exec "systemctl reload nginx"
            log_success "Nginx reloaded"
        else
            log_error "Nginx config test failed - NOT reloading"
            exit 1
        fi
    fi
}

# Setup SSL certificate
setup_ssl() {
    log_step "Setting up SSL certificate"

    if [ "$SKIP_SSL" = true ]; then
        log_info "Skipping SSL setup (--skip-ssl)"
        return
    fi

    local cert_path="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

    if $DRY_RUN; then
        log_dry_run "Would setup SSL certificate for $DOMAIN"
        return
    fi

    # Check if certificate already exists
    if ssh_exec "[ -f $cert_path ]"; then
        log_success "SSL certificate already exists"

        # Check expiration
        local expiry_info
        expiry_info=$(ssh_exec "certbot certificates 2>/dev/null | grep -A3 '$DOMAIN' | grep 'Expiry'" || echo "")
        if [ -n "$expiry_info" ]; then
            log_info "Certificate expiry: $expiry_info"
        fi
    else
        log_info "Requesting new SSL certificate..."

        # Create webroot directory for certbot
        ssh_exec "mkdir -p /var/www/certbot"

        # Request certificate
        if ssh_exec "certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --non-interactive --agree-tos --email admin@mittonvillage.com"; then
            log_success "SSL certificate obtained"

            # Reload Nginx to use new certificate
            ssh_exec "systemctl reload nginx"
        else
            log_error "Failed to obtain SSL certificate"
            log_warning "You may need to setup DNS first or run certbot manually"
        fi
    fi
}

# Verify deployment with health check
verify_deployment() {
    log_step "Verifying deployment"

    if $DRY_RUN; then
        log_dry_run "Would verify health endpoint at https://$DOMAIN/health"
        return 0
    fi

    # First wait for PM2 to report online
    log_info "Waiting for PM2 process to start..."
    local pm2_attempts=0
    while [ $pm2_attempts -lt 20 ]; do
        if ssh_exec "pm2 describe $PM2_APP_NAME 2>/dev/null | grep -q 'status.*online'"; then
            log_success "PM2 process is online"
            break
        fi
        pm2_attempts=$((pm2_attempts + 1))
        sleep 2
    done

    if [ $pm2_attempts -eq 20 ]; then
        log_error "PM2 process failed to start"
        log_info "Check PM2 logs: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs $PM2_APP_NAME'"
        return 1
    fi

    # Then check health endpoint
    local max_attempts=30
    local attempt=0
    local health_url="https://$DOMAIN/health"

    log_info "Waiting for health endpoint..."

    while [ $attempt -lt $max_attempts ]; do
        if ssh_exec "curl -sf http://localhost:3388/health" &> /dev/null; then
            log_success "Health check passed (local)"

            # Also check via domain if nginx is configured
            if [ "$SKIP_NGINX" = false ]; then
                sleep 2
                if curl -sf "$health_url" &> /dev/null; then
                    log_success "Health check passed (https://$DOMAIN)"
                else
                    log_warning "HTTPS health check failed (may need DNS setup)"
                fi
            fi
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 2
    done

    log_error "Health check timeout after $max_attempts attempts"
    log_info "Check PM2 logs: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs $PM2_APP_NAME'"
    return 1
}

# Show deployment summary
show_summary() {
    log_step "Deployment Summary"

    if $DRY_RUN; then
        log_info "This was a dry run - no changes were made"
        return
    fi

    log_success "Galaxy Miner deployed successfully!"
    log_info ""
    log_info "Application URL: https://$DOMAIN"
    log_info "Health endpoint: https://$DOMAIN/health"
    log_info ""
    log_info "Useful commands:"
    log_info "  View logs:     ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs $PM2_APP_NAME'"
    log_info "  Restart app:   ssh $REMOTE_USER@$REMOTE_HOST 'pm2 restart $PM2_APP_NAME'"
    log_info "  Stop app:      ssh $REMOTE_USER@$REMOTE_HOST 'pm2 stop $PM2_APP_NAME'"
    log_info "  App status:    ssh $REMOTE_USER@$REMOTE_HOST 'pm2 status'"
}

# Main deployment function
main() {
    parse_arguments "$@"

    echo -e "${BOLD}${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║              Galaxy Miner Production Deployment                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    if $DRY_RUN; then
        log_warning "DRY RUN MODE - No changes will be made"
    fi

    log_info "Target: $REMOTE_USER@$REMOTE_HOST:$REMOTE_APP_DIR"
    log_info "Domain: $DOMAIN"

    # Trap to cleanup on exit
    trap cleanup EXIT

    acquire_lock
    check_local_prerequisites
    run_pre_deployment_validation
    init_ssh_known_hosts
    check_ssh_connectivity
    check_remote_prerequisites
    create_remote_backup
    create_deploy_package
    transfer_and_extract
    install_dependencies
    deploy_env_file
    initialize_remote_database
    deploy_pm2
    deploy_nginx
    setup_ssl

    # Verify deployment with rollback on failure
    if ! verify_deployment; then
        rollback_deployment
        exit 1
    fi
    show_summary
}

# Run main
main "$@"
